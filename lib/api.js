import { NextResponse } from 'next/server';

export function ok(data, init) {
  return NextResponse.json(data, init);
}

export function fail(status, message) {
  return NextResponse.json({ error: message }, { status });
}

export function handle(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (err) {
      console.error(err);
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
