import { NextResponse } from 'next/server';
import { extractActor, logAudit } from './audit';
import { getSessionUser } from './auth';
import { authorizeApi } from './permissions';

const PUBLIC_API = new Set([
  '/api/login',
  '/api/company',
  '/api/health',
  // init ກວດເອງພາຍໃນ: ອະນຸຍາດສະເພາະ DB ຫວ່າງ (ຕິດຕັ້ງໃໝ່) ຫຼື admin + POS_ALLOW_INIT
  '/api/init',
]);

function isPublicRequest(pathname, method) {
  return method === 'GET' && PUBLIC_API.has(pathname) || pathname === '/api/login';
}

// ── ກັນ CSRF ────────────────────────────────────────────────────────────
// ປຽບທຽບສະເພາະ "host" ບໍ່ແມ່ນ origin ເຕັມ:
// ຫຼັງ reverse proxy (nginx / Cloudflare) browser ສົ່ງ https://ໂດເມນ
// ແຕ່ Node ຮັບເປັນ http://... → ຖ້າທຽບທັງ protocol ຈະປະຕິເສດຜິດໆ
// ຄວາມປອດໄພຍັງຄົງ: ໜ້າເວັບຂອງຄົນອື່ນຕັ້ງ Origin ໃຫ້ເປັນ host ຂອງເຮົາບໍ່ໄດ້
// ແລະ cookie session ເປັນ SameSite=Strict ຢູ່ແລ້ວ (lib/auth.js)
function allowedHosts(request) {
  const hosts = new Set();
  const add = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (v) hosts.add(v);
  };

  // host ຈິງທີ່ browser ເອີ້ນ — proxy ສົ່ງຕໍ່ມາທາງໃດທາງໜຶ່ງ
  for (const h of String(request.headers.get('x-forwarded-host') || '').split(',')) add(h);
  add(request.headers.get('host'));
  try { add(request.nextUrl.host); } catch { /* ບໍ່ມີ nextUrl */ }

  // ຕັ້ງເພີ່ມເອງໄດ້ (ຫຼາຍໂດເມນ / ຜ່ານ CDN) — POS_ALLOWED_ORIGINS=https://a.com,https://b.com
  for (const item of String(process.env.POS_ALLOWED_ORIGINS || '').split(',')) {
    const t = item.trim();
    if (!t) continue;
    try { add(new URL(t).host); } catch { add(t); }
  }
  return hosts;
}

function isSameOriginMutation(request) {
  if (!MUTATION_METHODS.has(request.method) || request.nextUrl.pathname === '/api/login') return true;

  // Sec-Fetch-Site ຕັ້ງໂດຍ browser ເອງ ປອມບໍ່ໄດ້ — ເຊື່ອຖືໄດ້ກວ່າ Origin
  // (ບໍ່ຖືກສົ່ງມາຕອນໃຊ້ HTTP ທຳມະດາໃນ LAN ຈຶ່ງຕ້ອງມີການທຽບ host ຕໍ່ໄປ)
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'same-origin' || fetchSite === 'none') return true;
  if (fetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true; // native clients and trusted LAN scripts

  let originHost;
  try { originHost = new URL(origin).host.toLowerCase(); } catch { return false; }
  return allowedHosts(request).has(originHost);
}

// ກວດສິດຕາມທີ່ຕັ້ງໄວ້ຢູ່ໜ້າ "User ແລະ ສິດ" — ແຜນທີ່ API → ເມນູ ຢູ່ lib/permissions.js
// (ແຫຼ່ງດຽວກັນກັບຝັ່ງ client ຈຶ່ງບໍ່ຫຼົງກັນ)
function isAllowedByPermissions(user, pathname, method) {
  return authorizeApi(user, pathname, method).allowed;
}

function isAllowedBusinessMutation(user, pathname, method) {
  if (user.role === 'admin') return true;
  if (pathname === '/api/init') return false;
  return true;
}

export function ok(data, init) {
  return NextResponse.json(data, init);
}

export function fail(status, message) {
  return NextResponse.json({ error: message }, { status });
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SKIP_AUDIT_PATTERNS = [
  /^\/api\/(login|logout|init)/,
  /^\/api\/audit-logs?\//,
];

function shouldAudit(request) {
  if (!MUTATION_METHODS.has(request?.method)) return false;
  const path = request?.nextUrl?.pathname || '';
  return !SKIP_AUDIT_PATTERNS.some(rx => rx.test(path));
}

// ຖ້າມີ session ໃຫ້ໃຊ້ຕົວຕົນຈາກ session (server-side) ແທນ header ທີ່ client ສົ່ງມາ
function mergeActor(request) {
  const base = extractActor(request);
  const u = request?.sessionUser;
  if (!u) return base;
  return { ...base, user_id: u.id, username: u.username, role: u.role };
}

export function handle(fn) {
  return async (request, context) => {
    const auditable = shouldAudit(request);
    try {
      const pathname = request?.nextUrl?.pathname || '';
      if (!isSameOriginMutation(request)) {
        const origin = request.headers.get('origin') || '(ບໍ່ມີ)';
        const expected = [...allowedHosts(request)].join(', ') || '(ບໍ່ຮູ້)';
        console.error(`[origin] ປະຕິເສດ ${request.method} ${pathname} — origin=${origin} expected host=${expected}`);
        return fail(403, `ຄຳຮ້ອງຂໍຖືກປະຕິເສດ (invalid origin) — ໄດ້ຮັບ ${origin} ແຕ່ເຊີເວີຮູ້ຈັກ ${expected}`);
      }
      // All business APIs require a server-side session. Only explicitly public
      // endpoints above may be called before login.
      if (pathname.startsWith('/api/') && !isPublicRequest(pathname, request.method)) {
        const sessionUser = await getSessionUser(request);
        if (!sessionUser) return fail(401, 'ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນ');
        request.sessionUser = sessionUser;
        if (!isAllowedBusinessMutation(sessionUser, pathname, request.method)) {
          return fail(403, 'ບໍ່ມີສິດດຳເນີນການນີ້');
        }
        if (!isAllowedByPermissions(sessionUser, pathname, request.method)) {
          return fail(403, 'ບໍ່ມີສິດດຳເນີນການນີ້ — ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ');
        }
      }
      const response = await fn(request, context);
      if (auditable) {
        const status = response?.status;
        logAudit(null, {
          actor: mergeActor(request),
          action: `${request.method} ${request.nextUrl.pathname}`,
          entity_type: 'http',
          entity_id: null,
          summary: status ? `${request.method} ${request.nextUrl.pathname} → ${status}` : null,
          payload: status >= 400 ? { status } : null,
        }).catch(() => {});
      }
      return response;
    } catch (err) {
      console.error(err);
      if (auditable) {
        logAudit(null, {
          actor: mergeActor(request),
          action: `${request.method} ${request.nextUrl.pathname}`,
          entity_type: 'http',
          summary: `${request.method} ${request.nextUrl.pathname} → error`,
          payload: { error: err.message },
        }).catch(() => {});
      }
      return NextResponse.json(
        { error: 'ລະບົບຂັດຂ້ອງ ກະລຸນາລອງໃໝ່', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function getQuery(request) {
  return Object.fromEntries(request.nextUrl.searchParams.entries());
}
