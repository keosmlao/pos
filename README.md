# SMLAO POS

Next.js/PostgreSQL point-of-sale system for sales, inventory, purchasing,
customer credit, loyalty, reporting, branches, audit logs, and backups.

## Local setup

1. Copy `.env.example` to `.env` and use a dedicated PostgreSQL account.
2. Install dependencies with `npm ci`.
3. Start development with `npm run dev`.
4. Validate a release with `npm run lint`, `npm test`, and `npm run build`.

Never commit `.env`, database dumps, uploaded invoices, or backup files.

## Production

- Serve the application through HTTPS and keep `POS_COOKIE_SECURE=true`.
- Keep `/api/init` disabled (`POS_ALLOW_INIT=false`) during normal operation.
- Change bootstrap credentials immediately and remove them from the environment.
- Restrict PostgreSQL and the application port to trusted hosts.
- Monitor `GET /api/health` and application logs.
- Schedule off-machine encrypted copies of `backups/`.

## Backup verification

Scheduled backups are written atomically and verified immediately after creation.
Run `npm run backup:verify` to recheck all compressed backup files. Perform a
periodic restore rehearsal in a separate PostgreSQL database; verification proves
file integrity, while a restore rehearsal proves operational recoverability.

For a disposable database that already has the POS schema, set
`POS_RESTORE_DATABASE=pos_restore_test` and run `npm run backup:restore-rehearsal`.
The script refuses to run when the target name matches `PGDATABASE`.

Passwords and active sessions are intentionally excluded from exported business
data. Preserve administrator recovery credentials separately.
