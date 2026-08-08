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

function isSameOriginMutation(request) {
  if (!MUTATION_METHODS.has(request.method) || request.nextUrl.pathname === '/api/login') return true;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // native clients and trusted LAN scripts
  return origin === request.nextUrl.origin;
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
      if (!isSameOriginMutation(request)) return fail(403, 'ຄຳຮ້ອງຂໍຖືກປະຕິເສດ (invalid origin)');
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
