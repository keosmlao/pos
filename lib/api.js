import { NextResponse } from 'next/server';
import { extractActor, logAudit } from './audit';

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

export function handle(fn) {
  return async (request, context) => {
    const auditable = shouldAudit(request);
    try {
      const response = await fn(request, context);
      if (auditable) {
        const status = response?.status;
        logAudit(null, {
          actor: extractActor(request),
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
          actor: extractActor(request),
          action: `${request.method} ${request.nextUrl.pathname}`,
          entity_type: 'http',
          summary: `${request.method} ${request.nextUrl.pathname} → error`,
          payload: { error: err.message },
        }).catch(() => {});
      }
      return NextResponse.json({ error: err.message }, { status: 500 });
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
