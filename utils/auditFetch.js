'use client';

// Wrap the global fetch() so every request to our own API carries actor
// headers (x-actor-id, x-actor-username, x-actor-role). The wrapper installs
// exactly once and is a no-op outside the browser.
//
// The headers are read from localStorage('pos_user') on every call, so logout
// or user switch takes effect immediately. This is a best-effort attribution
// only — server-side permission checks still apply.

let installed = false;

export function installAuditFetch() {
  if (typeof window === 'undefined' || installed) return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isLocal = url.startsWith('/') || url.startsWith(window.location.origin);
      if (!isLocal) return orig(input, init);

      const raw = localStorage.getItem('pos_user');
      const user = raw ? JSON.parse(raw) : null;
      if (!user) return orig(input, init);

      const merged = { ...init };
      const headers = new Headers(merged.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('x-actor-id') && user.id != null) headers.set('x-actor-id', String(user.id));
      if (!headers.has('x-actor-username') && user.username) headers.set('x-actor-username', String(user.username));
      if (!headers.has('x-actor-role') && user.role) headers.set('x-actor-role', String(user.role));
      merged.headers = headers;
      return orig(input, merged);
    } catch {
      return orig(input, init);
    }
  };
}
