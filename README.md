# Fashinza — B2B Apparel Manufacturing Platform

Fashinza connects fashion brands with verified clothing manufacturers. Brands brief production projects and
upload tech packs; a rule-based engine matches verified factories; factories send itemised quotations; the
accepted quotation becomes an order that is tracked through eight gated production stages, sampling, AQL quality
control, milestone payments (sandbox) and delivery. Administrators verify factories, monitor orders and resolve
disputes, with every sensitive action recorded in an audit log.

Final Year Project · Department of Software Engineering · The University of Lahore.

## What is implemented

| Area | Status |
| --- | --- |
| Public website (home, how it works, brands, manufacturers, sustainability, about, FAQ, contact, privacy, terms) | Complete |
| Registration, login, logout, password change, password reset | Complete (reset link is written to the server log in development — no email service) |
| Role-based access (brand / manufacturer / admin) enforced on the server, tenant isolation | Complete, covered by integration tests |
| Organisation profiles, factory documents, manual verification | Complete |
| Project wizard with drafts, validation, private versioned tech-pack uploads with progress | Complete |
| Deterministic factory matching (`rules-v1`) with mandatory filters, weighted scores and explanations | Complete |
| Quotations: cost breakdown, server-side totals, revisions with history, expiry, accept/reject | Complete |
| Orders: 8 milestones, evidence-gated transitions, planned/actual dates, delay detection, messages | Complete |
| Sampling rounds with approve / reject / revise | Complete |
| QC with ISO 2859-1 AQL plans (level II), automatic pass/fail, rework and rollback to stitching | Complete |
| Milestone payments (30/40/30 default, editable), signed idempotent webhooks, refunds | **Sandbox provider only** — no real money |
| Persistent in-app notifications with unread count | Complete (email not configured) |
| Admin: overview, verification queue, users, orders, QC issues, disputes, payment events, audit log, enquiries | Complete |
| Real-time updates | Order pages refresh by polling every 30 s (no socket server) |

**Planned extensions (not in this build):** AI demand forecasting and size-split advice, message translation and
voice notes, demand aggregation across brands, IoT tracking, delay prediction, a real payment provider, email
delivery, S3 storage. The matching engine is a pure function (`src/lib/matching.ts`) so a separate (e.g. Python)
service can replace it without changing the rest of the app.

## Tech stack

- Next.js 16 (App Router, server actions, Turbopack) + React 19 + TypeScript, Tailwind CSS v4, Radix primitives, Lucide icons
- PostgreSQL + Prisma 7 (`@prisma/adapter-pg`), Zod (shared browser/server validation), decimal.js for money
- Cookie sessions (opaque token, SHA-256 hashed in the database), scrypt password hashing
- Vitest (unit + integration against PostgreSQL), Playwright (end-to-end, desktop + mobile)

## Prerequisites

- Node.js 20.19+ (22 recommended) and PostgreSQL 14+

## Setup

```bash
npm install                      # also runs prisma generate
cp .env.example .env             # fill in DATABASE_URL, APP_URL, PAYMENT_SANDBOX_SECRET, ADMIN_*
npm run db:deploy                # apply all migrations
npm run db:seed                  # create the admin (and demo organisations when SEED_DEMO=1)
npm run dev                      # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. With `SEED_DEMO=1` the seed also creates
`demo-brand@fashinza.test` and three verified demo factories (`demo-factory-knits@…`, `-denim@…`, `-wovens@…`),
all using `SEED_DEMO_PASSWORD`. Demo organisations are labelled “(Demo)”; no orders, payments or reviews are invented.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_URL` | Yes | Public base URL (reset links, sandbox webhook delivery) |
| `PAYMENT_PROVIDER` | Yes | `sandbox` (the only implemented provider) |
| `PAYMENT_SANDBOX_SECRET` | Yes | ≥32-char HMAC secret for webhook signatures |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | For seeding | First administrator account (password ≥12 chars) |
| `SEED_DEMO`, `SEED_DEMO_PASSWORD` | No | Create labelled demo organisations |
| `UPLOAD_DIR` | No | Private file storage directory (default `./uploads`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Email shown on the contact page |
| `TEST_DATABASE_URL`, `E2E_DATABASE_URL` | For tests | Disposable databases (names must contain `test` / `e2e`) |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / start |
| `npm run lint`, `npm run typecheck` | ESLint, TypeScript |
| `npm test` | Unit tests (matching, AQL tables, quotation maths, workflow rules, validation) |
| `npm run test:integration` | Services against a real PostgreSQL test database (auth, permissions, tenant isolation, matching, quotations, orders, milestones, sampling, QC/rework, payment webhooks, disputes, notifications) |
| `npm run test:e2e` | Playwright journeys for brand, manufacturer and admin plus mobile layout checks. Run `npm run build` first. **Empties and re-seeds the `E2E_DATABASE_URL` database.** |
| `npm run db:deploy` / `npm run db:seed` | Apply migrations / seed |

The integration and e2e suites truncate their databases and refuse to run unless the database name contains
`test` / `e2e`. Never point them at real data.

## Architecture

```
src/app/(public)/      Public website            src/server/services/  Business rules (one file per domain)
src/app/(auth)/        Login, register, reset    src/server/access.ts  Tenant scoping filters
src/app/(app)/         Authenticated workspace   src/server/auth/      Sessions, password hashing
src/app/api/           Files, uploads, webhooks, health
src/lib/               Pure logic: matching, aql, workflow, quotation-math, validation schemas
prisma/                Schema, migrations, seed  tests/{unit,integration,e2e}
```

Pages and server actions call `requireUser(roles)`; services then re-check ownership with the scoping helpers,
so hiding a button is never the only protection. Multi-step changes (accepting a quotation, completing a stage,
QC rework, webhook processing) run in database transactions; quotation acceptance locks the project row and
`Order.projectId` is unique, so duplicate orders are impossible.

Each brand or factory account is one organisation (its profile holds the organisation details). Multi-user
organisations are a possible extension.

## Security notes

- Passwords: scrypt (N=2^17). Sessions: random 256-bit token in an http-only, SameSite=Lax cookie; only its hash is stored.
- Rate limits on login, registration, password reset, contact form and uploads (in-memory; use Redis for multiple instances).
- Uploads: type and size checked, file signature sniffed, random keys, stored outside `public/`, served only through
  `/api/files/…` after an access check, with `nosniff` and a sandboxing CSP.
- Payment state changes only through webhooks with a verified HMAC signature and timestamp; each event id is
  processed once; amounts are cross-checked.
- Admin actions (verification, suspensions, refunds, disputes, enquiries) are written to an append-only audit log.

## Deployment

A `Dockerfile` (Next.js standalone output) and `docker-compose.yml` (PostgreSQL + app + migrate job) are included.
They have **not been tested** in this environment because Docker was not available.

```bash
docker compose build
docker compose run --rm migrate          # apply migrations
docker compose up -d app
```

Any Node host also works: `npm ci && npm run build && npm run db:deploy && npm start`. Keep `UPLOAD_DIR` on a
persistent volume. `GET /api/health` reports database connectivity for load balancers.

## Backup and restore

```bash
pg_dump --format=custom --file=fashinza-$(date +%F).dump "$DATABASE_URL"         # database
tar czf uploads-$(date +%F).tgz -C "$UPLOAD_DIR" .                                  # private files
pg_restore --clean --if-exists --dbname="$DATABASE_URL" fashinza-YYYY-MM-DD.dump    # restore database
tar xzf uploads-YYYY-MM-DD.tgz -C "$UPLOAD_DIR"                                     # restore files
```

Back up the database and the upload directory together; file records in the database point to keys in that directory.

## Known limitations

- Email delivery is not configured; notifications are in-app only.
- Payments use a sandbox provider; Fashinza is not an escrow service.
- Rate limiting is per process (in memory).
- Prisma's driver adapter logs a `pg` deprecation warning for nested reads inside transactions; it is upstream and harmless.
