# Fashinza on the MERN stack

This folder documents the port of Fashinza from Next.js 16 + Prisma/PostgreSQL to **MongoDB + Express + React + Node**
(branch `mern`). The original Next.js app at the repository root (`src/`, `prisma/`, `tests/`, `public/`) is unchanged
and still works; it is the specification the new app was ported from. Every page URL, form, validation message,
business rule, permission check, notification, audit entry, label and visual detail is meant to behave and look the
same.

- `docs/mern/api.md` is the binding contract: endpoints, request and response shapes, error messages, collections,
  indexes and ownership.
- This file covers setup, commands, architecture, the mapping from the Next app, and known limitations.

> **Status, plainly:** the MERN app has **not yet been run against a MongoDB database**. MongoDB could not be started
> on the development machine (MongoDB 8.0 refuses to start on its Ubuntu kernel 7.0), so every database-backed check
> is still pending: the integration tests, the seed script, signed-in use of any page and the end-to-end suite. What
> has been run is listed under [Verification status](#verification-status).

---

## 1. Requirements

- Node.js 22 or newer, npm 10.
- MongoDB running as a **replica set** (a single-node set named `rs0` is enough). The server uses multi-document
  transactions (accepting a quotation, stage changes, QC rework, webhook processing, …), and MongoDB only allows
  those on a replica set. Any MongoDB version with transaction support should work; none has been tested yet.

### Setting up a single-node replica set

With a local `mongod` (version, package source and service manager are your choice):

```bash
mongod --replSet rs0 --bind_ip 127.0.0.1 --port 27017 --dbpath /path/to/data
# once, in another terminal:
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

Then `mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0` (the default `MONGODB_URI`) works. A hosted MongoDB that is
already a replica set works too; put its connection string in `MONGODB_URI`.

On the development machine, MongoDB 8.0 does not start under the Ubuntu 7.0 kernel. Options are an older MongoDB
series that runs there, a container, or a hosted cluster; that choice was postponed and nothing was installed.

## 2. Install

From the repository root (npm workspaces: `shared`, `server`, `client`):

```bash
npm install
```

The root `postinstall` still runs `prisma generate` for the Next app. The MERN packages do not need it.

## 3. Configuration (environment variables)

The server reads, in this order (later wins, real environment variables win over both files):

1. the **root `.env`**, shared with the Next app (read only; the MERN code never writes it);
2. **`server/.env`**, optional, for MERN-only overrides (git-ignored).

| Variable | Used for | Default |
|---|---|---|
| `MONGODB_URI` | application database | `mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0` |
| `PORT` | API (and, in production, the whole app) | `4000` |
| `SERVER_URL` | the server's own base URL; the sandbox payment provider posts its signed webhooks here | `http://localhost:<PORT>` |
| `APP_URL` | base of the password-reset link written to the server log in development | `http://localhost:3000` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥ 12 chars), `ADMIN_NAME` | administrator created or updated by the seed | required by the seed |
| `SEED_DEMO=1`, `SEED_DEMO_PASSWORD` | demo organisations, projects and orders in the seed | off |
| `PAYMENT_PROVIDER` | only `sandbox` is implemented, as today | `sandbox` |
| `PAYMENT_SANDBOX_SECRET` (≥ 32 chars) | HMAC key of the sandbox webhooks | required for payments |
| `UPLOAD_DIR` | private uploads; must be outside `public/` and `client/` (the server refuses to start otherwise) | `./uploads` (repo root) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | contact address shown on the site (inlined into the client at build time, as Next did) | `contact@fashinza.example` |
| `RATE_LIMIT_SCALE` | multiplies every rate limit (tests) | `1` |
| `NODE_ENV=production` | `Secure` session cookie, no reset links in logs | development |
| `TEST_MONGODB_URI` | integration tests; the database name must contain `test` and differ from `MONGODB_URI` | `mongodb://127.0.0.1:27017/fashinza_test?replicaSet=rs0` |
| `VITE_API_TARGET` | where the Vite dev server proxies `/api` | `http://localhost:4000` |

Two root `.env` values point at the Next app and need overriding in `server/.env` for the MERN app:

```bash
# server/.env (example; values are yours)
APP_URL=http://localhost:5173        # so the logged password-reset link opens the MERN client (dev)
MONGODB_URI=mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0
```

`DATABASE_URL` / `TEST_DATABASE_URL` in the root `.env` belong to the Next app and are ignored by the MERN server.

## 4. Commands (repository root)

| Command | What it does |
|---|---|
| `npm run mern:dev` | API on :4000 (`node --watch`) and Vite on :5173 side by side; Vite proxies `/api` to the API. Open http://localhost:5173. Ctrl+C stops both. |
| `npm run mern:build` | builds the client into `client/dist` |
| `npm run mern:start` | `NODE_ENV=production node server/src/index.js`: one process on :4000 serving the API, `client/dist` (with SPA fallback) and the photos in `public/`. Run `mern:build` first. The script uses POSIX shell syntax for `NODE_ENV`. |
| `npm run mern:seed` | administrator from `ADMIN_EMAIL`/`ADMIN_PASSWORD`; with `SEED_DEMO=1` the demo workspace (needs MongoDB) |
| `npm run mern:test` | shared tests and server unit tests (no database needed) |
| `npm run mern:test:integration` | server integration tests against `TEST_MONGODB_URI` (needs MongoDB; refuses any database whose name lacks `test`) |
| `npm run mern:test:e2e` | Playwright end-to-end suite in `tests-mern/e2e` (config `playwright.mern.config.js`). Drops and re-seeds the MongoDB database `fashinza_e2e` (override with `E2E_MONGODB_URI`; refuses any name without `e2e`), then starts the production server (`node server/src/index.js`) on :4100 with sandbox payments, `RATE_LIMIT_SCALE=50` and uploads in `/tmp/fashinza-mern-e2e-uploads`. Builds nothing: run `mern:build` first. Needs MongoDB. |

Inside a workspace: `npm run lint` and `npm run preview` in `client/`; `npx eslint server shared` from the root.

The original app's commands (`npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run db:*`) are
unchanged.

## 5. Architecture

```
shared/   @fashinza/shared   plain JS ported from src/lib: zod validation, matching rules, AQL, workflow,
                             quotation maths, labels, constants, formatting, FAQ, image metadata, enums
server/   @fashinza/server   Node 22 + Express 5 + Mongoose 8
  src/index.js               entry: listens at once, connects to MongoDB in the background and keeps retrying
  src/app.js                 app factory (used by supertest): security headers → /api/webhooks (raw body)
                             → Origin check + body parsing → 16 routers → /api 404 → static files + SPA fallback
  src/config.js, db.js       env loading; connection, transactions (withTransaction), error classifiers
  src/models/                33 collections mapped from prisma/schema.prisma (unique indexes kept)
  src/auth/                  scrypt hashes (original parameters), opaque session tokens (SHA-256 stored)
  src/middleware/            requireUser / requireOnboardedUser, Origin check, body parsing, errors
  src/services/              ports of src/server/services/* and the server actions
  src/routes/                one router per area (see docs/mern/api.md §6)
  src/payments/provider.js   sandbox payment provider (signed webhooks; no money moves)
  src/lib/                   form parsing, storage (uploads), access scoping, serialisation, rate limits, …
  scripts/seed.js            port of prisma/seed.ts
  scripts/mern-dev.js        runs API + client for `npm run mern:dev`
  tests/unit, tests/integration
client/   @fashinza/client   React 19 + Vite + React Router 7 (data mode) + Tailwind CSS v4
  src/router.jsx             every URL of the Next app; gates and role redirects run before page loaders
  src/layouts/               root, public, auth and app-shell layouts (the Next route groups)
  src/pages/                 one module per page: default component + optional loader(...)
  src/components/            ports of src/components (same markup and classes)
  src/lib/api.js, session.js API calls, form submission, sign-in gates
  src/styles/globals.css     the original stylesheet (all tokens, light and dark themes)
```

Request flow in development: browser → Vite :5173 → `/api/*` proxied to Express :4000 (Host header kept, so the
Origin check matches). In production Express serves everything on one port.

### Behaviour when MongoDB is unreachable

- The server still starts, serves the client app, its assets and the public photos, and keeps retrying the
  connection (backing off to 30 s), logging each failure.
- `GET /api/health` answers `503 {"status":"error","database":"unreachable"}`, exactly like the Next app's health
  route.
- API calls that need the database answer at once with `503 {"error":{"code":"DATABASE_UNAVAILABLE","message":…}}`,
  using the same messages the Next app showed for an unexpected failure. Mongoose command buffering is switched off
  so requests never hang. Checks that need no database (sign-in gate without a cookie, validation, rate limits,
  Origin) still answer as usual.
- In the browser, public pages render as signed out; app pages show the existing error card.

## 6. What maps to what

| Next.js app | MERN app |
|---|---|
| `prisma/schema.prisma`, PostgreSQL | `server/src/models/*.js`, MongoDB (one collection per Prisma model, same names) |
| Prisma `$transaction`, `SELECT … FOR UPDATE`, unique constraints | `withTransaction(session => …)` on a replica set, conditional updates, unique indexes (e.g. one order per project, each webhook event once) |
| `Decimal` columns | `Decimal128` at the column's scale, sent as strings (`"1234.50"`); `decimal.js` for maths |
| `src/lib/*.ts` | `shared/src/*.js` (same exports, types removed) |
| `src/server/services/*.ts` | `server/src/services/*.js` |
| server actions (`src/app/**/actions.ts`) | `POST`/`PUT`/`DELETE /api/...` endpoints; responses carry `message`/`redirectTo` so the client shows the same toast and navigates the same way |
| route handlers (`/api/files/[...key]`, `/api/projects/[id]/attachments`, `/api/webhooks/payments/[provider]`, `/api/health`) | the same paths in Express |
| `/notifications/[id]` route handler (marks read, redirects) | client route whose loader calls `POST /api/notifications/:id/open` and redirects |
| server components loading data | page `loader`s calling `GET /api/...` |
| `requireUser` / `requireOnboardedUser` redirects, `src/proxy.ts` | client gates in `src/lib/session.js` (`/login?next=…`, `/dashboard?denied=1`, `/onboarding`) **and** the same checks on every API endpoint (401/403) |
| `notFound()`, `not-found.tsx`, `error.tsx`, `loading.tsx` | 404 responses → the same not-found cards; route error boundaries; the same loading skeleton |
| `export const metadata` | `<PageMeta>` (React 19 `<title>`/`<meta>`), same `Title | Fashinza` template and defaults |
| `next/link`, `next/image` | React Router `Link`; `Photo` renders a plain `<img>` with the same props and frame |
| `revalidatePath` after an action | the client reloads the page data and the session after a successful mutation |
| `LiveRefresh` on the order page | re-fetch every 30 s while the tab is visible |
| session cookie `fz_session`, scrypt hashes | unchanged: existing password hashes verify, cookie flags are the same |
| `prisma/seed.ts` | `server/scripts/seed.js` (same accounts, demo data, idempotency rules; through the real services) |
| `tests/unit`, `tests/integration` | `shared/tests` (unit) and `server/tests/{unit,integration}` (same case names) |
| `UPLOAD_DIR`, file keys | unchanged; the MERN server can read files uploaded by the Next app, but only once their records exist in MongoDB |

## 7. Verification status

Run without a database (all passing at the time of writing):

- `npm run mern:test`: shared tests, and server unit tests (gates, Origin check, validation messages, rate limits,
  error shapes, hashing and sessions, uploads, models and money formatting, config, the "database unavailable"
  behaviour, and the seed's demo data and placeholder files).
- `npm run mern:build` and `npm run lint` in `client/`; `npx eslint server shared`.
- Server boot smoke test on :4000 with MongoDB unreachable: `/`, `/login`, a deep app URL, JS/CSS assets, photos and
  `/favicon.ico` load; a headless browser rendered the public pages, the login redirect with `?next=`, and the 404
  page without page errors; login submits show the error message; `/api/health` and DB-backed endpoints answer 503.
- `npm run mern:dev` starts both servers, the proxy works, and Ctrl+C stops both.
- The original app: root `npx vitest run` and `npx tsc --noEmit` still pass.
- Visual parity, signed out: the Next production build (:4200, Postgres e2e database) and the MERN production server
  (:4300, no MongoDB) were captured at 1440px light, 1440px dark and 390px for the ten public pages, login, register
  (`?role=brand`, `?role=manufacturer`), forgot-password and the not-found page. Every pair has the same page height
  and is pixel-identical outside the photographs; the photographs differ only by resampling (Next serves resized
  copies). Interactive states (empty login and contact submits, short register password, role toggle, phone menu,
  open FAQ item, theme menu, `?next=` redirect, `?signedOut=1`, `?reset=1`, reset page without a token) match too.
  The MERN captures are in `docs/mern/screenshots/`.
- Earlier phases also compared rendered pages against the Next app (public and auth pages signed out, and several
  brand and factory pages with data exported from the original database through mocked API responses).

**Still pending (need MongoDB):**

- `npm run mern:test:integration` (5 files: foundation, auth/access, projects/quotations, production/payments over
  services and over HTTP), including unique and partial indexes, transactions and their retries, races (two
  acceptances of one quotation, repeated webhooks), tenant isolation, PostgreSQL-compatible sorting, page response
  nesting and money totals.
- `npm run mern:seed`, with and without `SEED_DEMO=1`.
- Any signed-in use of the app against the real server (every page loader and form so far was checked only with
  mocked API responses).
- The sandbox checkout round trip (checkout page → signed webhook to `SERVER_URL` → order payments).
- `npm run mern:test:e2e`: every spec of `tests/e2e` (workflow, admin-access, navigation, public-site, mobile; 28
  tests) is ported to `tests-mern/e2e` with the same steps and selectors, and `playwright test -c
  playwright.mern.config.js --list` lists all 28, but the suite has never run. Its selectors, labels, URLs and
  messages were checked against the MERN client and server by reading the code.
- Signed-in screenshots compared with the Next app (dashboard, projects, wizard, project/order detail, payments,
  settings, admin pages). Their JSX was compared with the Next TSX file by file instead (same class names, copy and
  elements; only types, data loading and API paths differ).

## 8. Known limitations and differences

- **No data migration.** Nothing copies existing PostgreSQL data into MongoDB. Ids change from UUIDs to ObjectIds,
  so a migration would also have to map every reference. Password hashes and stored file keys are compatible.
- **Sort ties:** where the original order was undefined (equal timestamps), MongoDB queries break ties by id.
- **Images:** `Photo` serves the original files without Next's resizing, `srcset` or WebP conversion, so pages
  download larger images than before. Layout and cropping are the same.
- **New 503 code:** `DATABASE_UNAVAILABLE` did not exist in the Next app (it returned a generic 500 or error page);
  user-facing text is unchanged.
- **Password-reset links** are still only written to the server log in development (no email service, as today).
  Their base URL is `APP_URL`; see the `server/.env` note above.
- **Webhook address:** sandbox webhooks go to `SERVER_URL`, not `APP_URL` as in the Next app, because `APP_URL` in the
  shared `.env` points at the Next app.
- **Root lint:** after `npm run mern:build`, the Next app's `npm run lint` (root ESLint config) also scans
  `client/dist` and reports errors in the bundled code. Delete `client/dist` before linting the root app, or add
  `client/dist/**` to the root ESLint ignores (the root config was deliberately left untouched).
- **Small rendering differences** found when comparing with the Next app: React Router adds `data-discover` to links;
  the search form carries `method="get"`; generated ids differ; there is no Next dev badge; the page description
  `<meta>` is set by JavaScript rather than present in the initial HTML.
- **Not-found status:** unknown page URLs get the SPA with HTTP 404 (`server/src/lib/page-routes.js`, kept in step with
  `client/src/router.jsx` by a unit test). Pages whose record does not exist (e.g. `/projects/<unknown id>`) still
  answer 200 and render the not-found card on the client; Next answered those with 404.
- **Sandbox only:** as in the Next app, only the sandbox payment provider is implemented; no money moves.
- **Contract deviations** (documented in `docs/mern/api.md`): a malformed file key returns 404 like the original,
  not 400; the test reset empties collections instead of dropping them; webhook delivery uses `SERVER_URL`.
