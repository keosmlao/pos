import { NextResponse } from 'next/server';
import { extractActor, logAudit } from './audit';
import { getSessionUser } from './auth';

// ອະນຸຍາດທຸກຄົນທີ່ login ແລ້ວ (ໜ້າ POS ໃຊ້ຕອນຂາຍ)
const SESSION_ONLY_PREFIXES = [
  // POS cashiers use laybys during normal checkout.
  '/admin/laybys',
];

// ຂໍ້ມູນອ້າງອີງທີ່ຫຼາຍໜ້າໃຊ້ຮ່ວມກັນ — GET ໄດ້ທຸກຄົນທີ່ login ແລ້ວ
// (POS ໃຊ້ branches/products, ໜ້າສ້າງບິນຊື້ໃຊ້ products/suppliers/currencies ຯລຯ)
const SHARED_READ_PREFIXES = [
  '/admin/products',
  '/admin/categories',
  '/admin/brands',
  '/admin/units',
  '/admin/suppliers',
  '/admin/branches',
  '/admin/currencies',
  '/admin/locations',
  '/admin/company',
  '/admin/settings/po-format',
];

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

// ຫຼັງບ້ານ (/api/admin/**) ເປັນຂອງ admin ເທົ່ານັ້ນ — cashier ເຂົ້າບໍ່ໄດ້ເດັດຂາດ.
// ຍົກເວັ້ນສະເພາະ endpoint ທີ່ໜ້າ POS ເອງຕ້ອງໃຊ້ຕອນຂາຍ (ຝາກຂາຍ + ຂໍ້ມູນອ້າງອີງ)
function isAllowedByPermissions(user, pathname, method) {
  if (user.role === 'admin') return true;
  const p = pathname.replace(/^\/api/, '');
  if (SESSION_ONLY_PREFIXES.some(x => p.startsWith(x))) return true;
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)
      && SHARED_READ_PREFIXES.some(x => p === x || p.startsWith(x + '/'))) {
    return true;
  }
  return false;
}

function isAllowedBusinessMutation(user, pathname, method) {
  if (user.role === 'admin') return true;
  const perms = user.permissions && typeof user.permissions === 'object' ? user.permissions : {};
  if (method === 'DELETE' && /^\/api\/orders\/\d+$/.test(pathname)) return !!perms['/admin/sales']?.delete;
  if (method === 'DELETE' && /^\/api\/returns\/\d+$/.test(pathname)) return !!perms['/admin/returns']?.delete;
  if (method === 'POST' && pathname === '/api/returns') return !!perms['/admin/returns']?.edit;
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
        if (pathname.startsWith('/api/admin') && !isAllowedByPermissions(sessionUser, pathname, request.method)) {
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
