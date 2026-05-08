# POS — Next.js Migration Notes

A 1:1 migration of the previous `frontend/` (React + Vite + react-router-dom) and
`backend/` (Express + pg) into a single Next.js 14 App Router app.

## Structure

```
nextjs/
├── app/
│   ├── layout.jsx            # root <html>; loads Noto Sans Lao + globals.css
│   ├── globals.css
│   ├── page.jsx              # "/" home (Login or POS)
│   ├── customer/page.jsx     # "/customer"
│   ├── admin/
│   │   ├── layout.jsx        # sidebar + admin role guard (was AdminLayout + RequireAdmin)
│   │   ├── page.jsx          # /admin → Dashboard
│   │   ├── products/page.jsx
│   │   ├── categories-brands/page.jsx
│   │   ├── suppliers/page.jsx
│   │   ├── purchases/page.jsx
│   │   ├── purchases/create/page.jsx
│   │   ├── debts/page.jsx
│   │   ├── pricing/page.jsx
│   │   ├── promotions/page.jsx
│   │   ├── sales/page.jsx
│   │   ├── currencies/page.jsx
│   │   └── cash-handovers/page.jsx
│   └── api/                  # all former Express routes
├── components/               # POS, Login, CustomerDisplay, SearchSelect
├── utils/                    # promotions.js, receiptPdfGenerator.js
├── data/laoLocations.js
├── lib/
│   ├── db.js                 # pg Pool (singleton across hot reloads)
│   ├── api.js                # handle/ok/fail/readJson helpers
│   ├── migrations.js         # lazy ALTER TABLE / CREATE TABLE per resource
│   ├── settings.js           # getSetting/setSetting helpers
│   ├── priceHistory.js       # logPriceChange helper
│   ├── supplierApi.js        # buildSupplierUrl/resolveCustCodes/fetchSupplierJson
│   ├── supplierSync.js       # syncSingleSupplier (used by products sync)
│   └── uploads.js            # FormData → public/uploads file writer
└── public/uploads/           # multer destination → static-served at /uploads/<file>
```

## Running

```bash
cd nextjs
npm install
# postgres must be running, schema initialized via GET /api/init on first boot
npm run dev          # http://localhost:3000
npm run build && npm start
```

`.env.local` controls the DB connection (PGUSER/PGHOST/PGDATABASE/PGPORT/PGPASSWORD).

## What changed (frontend)

- **Routing**: `react-router-dom` removed. `BrowserRouter`, `Routes`, `Route`,
  `Navigate`, `Outlet` are gone — Next.js file-system routing replaces them.
  - `Link to=` → `Link href=` from `next/link`
  - `useNavigate()` → `useRouter()` from `next/navigation`
  - `useLocation().pathname` → `usePathname()` from `next/navigation`
- **Per-page client boundary**: every page/component that uses hooks, state, or
  browser APIs has `'use client'` at the top.
- **Admin route guard**: previously `<RequireAdmin>` wrapper around `<AdminLayout>`.
  Now `app/admin/layout.jsx` reads `localStorage` in `useEffect` and redirects to
  `/` via `router.replace` if not admin (renders `null` until the check passes,
  to avoid flashing protected UI).
- **`location.state` for navigation payloads**: the previous app used React
  Router's `navigate(path, { state })`. App Router has no equivalent. Replaced
  with `sessionStorage.setItem('navState', JSON.stringify(state))` written by
  the source page and consumed once by the destination (`PurchasesCreate`
  reads + clears `navState` on mount). Only `Purchases → PurchasesCreate`
  uses this; all other navigations use `router.push` directly.
- **HTTP base URL**: still `'/api'` everywhere. Same-origin → no proxy needed
  (Vite's `vite.config.js` proxy is gone).

## What changed (backend)

- Each Express router → one or more Next route handlers under `app/api/`.
- `req.body` → `await request.json()` (via `readJson` helper).
- `req.query` → `request.nextUrl.searchParams`.
- `req.params` → `context.params` (only available in `[param]` folders).
- `res.json` / `res.status(N).json` → `NextResponse.json` (via `ok` / `fail`).
- The Express global error handler is replaced by the `handle()` wrapper in
  `lib/api.js` — every route is wrapped so thrown errors become 500 JSON.
- Express `app.use` mount paths translate to folder layout, e.g.:
  - `app.use('/api/admin/products', adminProducts)` →
    `app/api/admin/products/route.js`
  - `router.get('/:id/movements', ...)` →
    `app/api/admin/products/[id]/movements/route.js`
- `/api/currencies` was an Express alias for the admin currencies router.
  Replaced by `app/api/currencies/route.js` re-exporting `GET, POST` from
  `app/api/admin/currencies/route.js`.

### Schema migrations

The Express files ran `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` at module
load via top-level IIFEs. Next.js route modules don't have that lifecycle, so
those migrations moved into `lib/migrations.js` as idempotent `ensureXSchema()`
functions called at the top of the route handlers that need them. They flip a
module-scoped boolean after the first successful run.

The big one-shot init (CREATE TABLEs, seed products, seed users) stayed in
`app/api/init/route.js`. Hit `GET /api/init` once after first DB setup.

### Uploads

- Multer is gone. Each upload route reads `await request.formData()` and the
  shared `lib/uploads.js#saveUpload` writes the file to `public/uploads/`.
- Files in `public/uploads/` are served by Next.js at `/uploads/<filename>`,
  matching the previous `/uploads` static mount in Express.
- Existing files from `backend/uploads/` were copied into `public/uploads/`.

### Supplier API integration

`backend/src/lib/supplierApi.js` ported verbatim to `lib/supplierApi.js`. The
big sync routine (formerly inline in `routes/admin/products.js`) lives in
`lib/supplierSync.js`. The smaller `sync-invoices` flow in
`routes/admin/purchases.js` uses `lib/supplierApi.js` directly.

## What was NOT migrated

- `smlapi/` (separate Express service for external supplier integration) is
  untouched — it's a different microservice and the prompt scoped to
  frontend + backend only. The new Next app talks to it the same way the old
  backend did (via env-configured supplier `api_url`).
- Auth model is unchanged: server returns a user object on POST /api/login,
  client stores it in `localStorage`, admin gating is still client-side only.
  This is a pre-existing limitation, not introduced by the migration. If you
  want server-enforced auth, add a Next.js `middleware.ts` and switch from
  localStorage to httpOnly cookies — out of scope for the 1:1 port.

## Known gotchas

- **`pg` and Edge runtime**: route handlers default to the Node runtime, which
  is what we want (pg uses Node sockets). `next.config.js` has
  `serverComponentsExternalPackages: ['pg']` to keep it from being bundled.
- **Hot reload + connection pool**: `lib/db.js` stashes the pool on
  `globalThis.__pgPool` in dev so HMR doesn't leak connections.
- **`useRouter` from the right module**: it's `next/navigation`, NOT
  `next/router` (that's the old Pages Router API).
- **The original frontend stored login passwords in localStorage** under the
  key `pos_remember`. That behaviour is preserved as-is.
