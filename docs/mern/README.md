# Fashinza on the MERN stack

This folder documents the port of Fashinza from Next.js 16 + Prisma/PostgreSQL to **MongoDB + Express + React + Node**
(branch `mern`). The original Next.js app at the repository root (`src/`, `prisma/`, `tests/`, `public/`) is unchanged
and still works; it is the specification the new app was ported from. Every page URL, form, validation message,
business rule, permission check, notification, audit entry, label and visual detail is meant to behave and look the
same.

- `docs/mern/api.md` is the binding contract: endpoints, request and response shapes, error messages, collections,
  indexes and ownership.
- This file covers setup, commands, architecture, the mapping from the Next app, and known limitations.

> **Status, plainly:** the MERN app runs against MongoDB 9.0.4 (single-node replica set `rs0`) on the development
> machine. The unit, integration and end-to-end suites pass; see [Verification status](#7-verification-status) for
> what was run and what is still open. It has not been deployed anywhere.

---

## 1. Requirements

- Node.js 22 or newer, npm 10.
- MongoDB running as a **replica set** (a single-node set named `rs0` is enough). The server uses multi-document
  transactions (accepting a quotation, stage changes, QC rework, webhook processing, …), and MongoDB only allows
  those on a replica set. Any MongoDB version with transaction support should work; 9.0.4 is the one tested.

### Setting up a single-node replica set

With a local `mongod` (version, package source and service manager are your choice):

```bash
mongod --replSet rs0 --bind_ip 127.0.0.1 --port 27017 --dbpath /path/to/data
# once, in another terminal:
mongosh --eval 'rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] })'
```

Then `mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0` (the default `MONGODB_URI`) works. A hosted MongoDB that is
already a replica set works too; put its connection string in `MONGODB_URI`.

On Ubuntu with a 6.19+/7.x kernel, MongoDB 8.0 before 8.0.37 refuses to start (it misreads the kernel version);
9.0.4 starts normally.

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
| `APP_URL` | base of links in emails (brand approval) | `http://localhost:5173` for email links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | outgoing email server (`server/src/lib/mail.js`) | `smtp.gmail.com`, `465`, `true` |
| `SMTP_USER`, `SMTP_PASS` | SMTP account; for Gmail the address and an **app password** (steps in `server/.env.example`). Unset: nothing is sent, each email (with reset codes) is written to the server console | unset |
| `MAIL_FROM` | sender shown to recipients | `Fashinza <SMTP_USER>` |
| `MAIL_OUTBOX_DIR` | also write every email there as JSON (the e2e suite reads reset codes from it) | unset |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥ 12 chars), `ADMIN_NAME` | administrator created or updated by the seed | required by the seed |
| `SEED_DEMO=1`, `SEED_DEMO_PASSWORD` | demo organisations, projects and orders in the seed | off |
| `PAYMENT_PROVIDER` | only `sandbox` is implemented, as today | `sandbox` |
| `PAYMENT_SANDBOX_SECRET` (≥ 32 chars) | HMAC key of the sandbox webhooks | required for payments |
| `UPLOAD_DIR` | private uploads; must be outside `public/` and `client/` (the server refuses to start otherwise) | `./uploads` (repo root) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | contact address shown on the site (inlined into the client at build time, as Next did) | `contact@fashinza.example` |
| `RATE_LIMIT_SCALE` | multiplies every rate limit (tests) | `1` |
| `LINK_CHECK` | `on`: profile websites and social links are opened live when saved or checked (5 s, SSRF-guarded, see api.md "Social links"); `off`: no network access, links are stored as "Not checked" | `on` (`off` when unset under test runners; the integration and e2e environments set `off`) |
| `NODE_ENV=production` | `Secure` session cookie | development |
| `TEST_MONGODB_URI` | integration tests; the database name must contain `test` and differ from `MONGODB_URI` | `mongodb://127.0.0.1:27017/fashinza_test?replicaSet=rs0` |
| `VITE_API_TARGET` | where the Vite dev server proxies `/api` | `http://localhost:4000` |

Two root `.env` values point at the Next app and need overriding in `server/.env` for the MERN app:

```bash
# server/.env (example; values are yours)
APP_URL=http://localhost:5173        # so links in emails open the MERN client (dev)
MONGODB_URI=mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0
```

`DATABASE_URL` / `TEST_DATABASE_URL` in the root `.env` belong to the Next app and are ignored by the MERN server.

`server/.env.example` lists every MERN-only setting with comments; copy it to `server/.env` (git-ignored) and fill in
what you need.

### Sending email through Gmail (app password)

Fashinza emails three kinds of message: the 6-digit password-reset code, "New brand awaiting approval" to every
administrator, and the approval or rejection decision to the brand. Until SMTP is configured nothing is sent; each
message (with any code) is printed in the server console after `[mail] SMTP not configured — not sent`.

1. In the Google account that will send the mail, turn on **2-Step Verification** (Google Account → Security).
   Google only offers app passwords when it is on.
2. Open **App passwords** (Google Account → Security → 2-Step Verification → App passwords, or
   https://myaccount.google.com/apppasswords), create one named e.g. "Fashinza" and copy the 16-character password
   Google shows once.
3. In `server/.env`:
   ```bash
   SMTP_USER=your-address@gmail.com
   SMTP_PASS=abcdabcdabcdabcd      # the app password (spaces optional), never the normal account password
   # optional: MAIL_FROM="Fashinza <your-address@gmail.com>"   (Gmail sends as SMTP_USER anyway)
   ```
   `SMTP_HOST` (`smtp.gmail.com`), `SMTP_PORT` (`465`) and `SMTP_SECURE` (`true`) already default to Gmail.
4. Restart the server (`npm run mern:dev`, or the API process). A failed delivery is logged as
   `[mail] sending "<subject>" to <address> failed: …` and never breaks the request.

Gmail limits how much one account may send per day; use any transactional SMTP provider for real traffic (set
`SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE=false` for port 587). Set `APP_URL` to the address of the web app so the
links in approval emails open it.

## 4. Commands (repository root)

| Command | What it does |
|---|---|
| `npm run mern:dev` | API on :4000 (`node --watch`) and Vite on :5173 side by side; Vite proxies `/api` to the API. Open http://localhost:5173. Ctrl+C stops both. |
| `npm run mern:build` | builds the client into `client/dist` |
| `npm run mern:start` | `NODE_ENV=production node server/src/index.js`: one process on :4000 serving the API, `client/dist` (with SPA fallback) and the photos in `public/`. Run `mern:build` first. The script uses POSIX shell syntax for `NODE_ENV`. |
| `npm run mern:seed` | administrator from `ADMIN_EMAIL`/`ADMIN_PASSWORD`; with `SEED_DEMO=1` the demo workspace (needs MongoDB) |
| `npm run mern:test` | shared tests and server unit tests (no database needed) |
| `npm run mern:test:integration` | server integration tests against `TEST_MONGODB_URI` (needs MongoDB; refuses any database whose name lacks `test`) |
| `npm run mern:test:e2e` | Playwright end-to-end suite in `tests-mern/e2e` (config `playwright.mern.config.js`). Drops and re-seeds the MongoDB database `fashinza_e2e` (override with `E2E_MONGODB_URI`; refuses any name without `e2e`), then starts the production server (`node server/src/index.js`) on :4100 with sandbox payments, `RATE_LIMIT_SCALE=50`, `LINK_CHECK=off`, no SMTP (emails go to `/tmp/fashinza-mern-e2e-mail` as JSON, `MAIL_OUTBOX_DIR`) and uploads in `/tmp/fashinza-mern-e2e-uploads`. Builds nothing: run `mern:build` first. Needs MongoDB. |
| `npm run mern:record-guide` | re-records the User Guide video (`public/videos/user-guide-demo.*`: video, poster, captions, chapter list) from the real app: drops and re-seeds `fashinza_e2e`, runs the production server on :4400 and walks through sign-up, brand approval, the brief, quoting, sampling, production, inspection, payment and delivery. Run `mern:build` first. Do not run it at the same time as `mern:test:e2e` (same database). |

Inside a workspace: `npm run lint` and `npm run preview` in `client/`; `npx eslint server shared` from the root.

The original app's commands (`npm run dev`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run db:*`) are
unchanged.

## 5. Architecture

```
shared/   @fashinza/shared   plain JS ported from src/lib: zod validation, matching rules, AQL, workflow,
                             quotation maths, labels, constants, formatting, FAQ, image metadata, enums;
                             MERN-only: named colours for the brief's colour picker (colors.js) and 20 more
                             garment categories with display groups (enums.js, constants.js)
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
  src/styles/globals.css     the original stylesheet (all tokens, light and dark themes) plus the MERN-only
                             "liquid glass" utilities, tilt, skeleton and motion styles (see below)
```

### Visual design: liquid glass and 3D (MERN only)

The MERN client keeps the original palette, fonts, copy and markup, and adds a "liquid glass" layer on top:

- **Glass utilities** (`globals.css`, section LIQUID GLASS): `glass` (marketing cards over the soft taupe /
  forest-green glows of `bg-liquid` / `bg-liquid-surface`), `glass-strong` (dialogs, drawers, dropdown menus,
  toasts, the back-to-top button), `glass-bar` (the public header once the page scrolls, the app's top bar),
  `glass-subtle` (the app sidebar) and `glass-ink` (chips and outline buttons on photographs, always over a scrim).
  Each is a translucent fill mixed from the theme's surface tokens, `backdrop-filter` blur + saturation, a 1px inner
  highlight, a soft sheen and a layered shadow. Without `backdrop-filter`, or with
  `prefers-reduced-transparency: reduce`, every glass surface becomes solid. Text keeps AA contrast on them in
  both themes (worst case for `glass-strong` / `glass-bar`: a black or white pixel behind the blur).
- **Hero silk** (`components/site/liquid-hero.jsx` + `liquid-silk.js`): a small raw-WebGL shader (no library, its
  own ~3 kB gzipped chunk) of two satin scarves in the brand colours under the hero's scrim. It is fetched only
  after the page's `load` event when the browser is idle, never under `prefers-reduced-motion`, Save-Data or below
  768px, renders at most devicePixelRatio 1.5, pauses off-screen and in hidden tabs, steps down or stops on slow
  devices, and leaves the photograph in place when WebGL is unavailable. The h1, buttons and photo never wait for it.
- **Tilt** (`components/site/tilt.jsx`): photo cards lean towards a mouse with a glass sheen; nothing happens on
  touch screens or under reduced motion. The homepage's production section is a layered 3D preview (order card in
  front of the photograph).
- **Ease of use:** a navigation progress bar, smooth scrolling for in-page anchors only, a back-to-top button on long
  public pages, a boot splash in `index.html` while the first page loads, shimmer skeletons and calmer empty states.

Screenshots of the redesign (1440px light and dark, 390px, and open menus, drawers and dialogs) are in
`docs/mern/screenshots/redesign/`.

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
| `prisma/seed.ts` | `server/scripts/seed.js` (same accounts, demo data, idempotency rules; through the real services). MERN-only: ten more verified demo factories (fourteen in all, in ten sourcing countries, covering every garment category) |
| `tests/unit`, `tests/integration` | `shared/tests` (unit) and `server/tests/{unit,integration}` (same case names) |
| `UPLOAD_DIR`, file keys | unchanged; the MERN server can read files uploaded by the Next app, but only once their records exist in MongoDB |

## 7. Verification status

Last full run: 15 November 2026, MongoDB 9.0.4 (replica set `rs0`), Node 22, after the brand-approval, password
policy, emailed reset code, social links, garment catalogue and liquid-glass changes. All passing:

| Command | Result |
|---|---|
| `npm run mern:test` | shared 75 tests (5 files); server unit 214 tests (17 files) |
| `npm run mern:test:integration` (database `fashinza_test`) | 116 tests (8 files): foundation, auth/access, projects/quotations, production/payments over services and over HTTP, brand approval, password reset codes, profile links |
| `npm run mern:build`, `npm run lint` in `client/`, `npx eslint server shared tests-mern` | clean |
| `npm run mern:test:e2e` (database `fashinza_e2e`, server on :4100) | 35 tests (desktop + mobile), green twice in a row |
| `npm run mern:seed` with `SEED_DEMO=1` on the dev database | adds the ten newer demo factories and leaves existing records alone |
| `npm run mern:record-guide` | re-recorded the User Guide video with the brand-approval chapter and the colour picker |

Also checked by hand on a production build: every new or changed page (registration with the password checklist,
the three forgot-password steps, the pending-brand notice, the wizard's grouped categories and colour picker, the
brand profile with social links, the admin overview, brand approvals list and review, all projects) at 1440px in
both themes and at 390px, with no sideways scrolling at 320–390px.

Earlier checks that still stand:

- Visual parity, signed out: the Next production build and the MERN production server were captured at 1440px light,
  1440px dark and 390px for the ten public pages, login, register, forgot-password and the not-found page, and were
  pixel-identical outside the photographs. Those captures (`docs/mern/screenshots/`) predate the liquid-glass
  redesign (section 5) and the MERN-only features; the redesign's captures are in `docs/mern/screenshots/redesign/`.
- Server behaviour with MongoDB unreachable (section 5) and `npm run mern:dev` (both servers, proxy, Ctrl+C).
- The original Next app's own checks (root `npx vitest run`, `npx tsc --noEmit`) are unaffected by the MERN work.

Not verified:

- Real email delivery: no SMTP account is configured on the development machine, so messages were only written to
  the console and to `MAIL_OUTBOX_DIR`. Sending through Gmail needs the steps in section 3.
- Live link checks against the real social sites in the test suites (they run with `LINK_CHECK=off`; the checker is
  unit-tested with fake network answers).
- Deployment to any hosted environment.

## 8. Known limitations and differences

- **No data migration.** Nothing copies existing PostgreSQL data into MongoDB. Ids change from UUIDs to ObjectIds,
  so a migration would also have to map every reference. Password hashes and stored file keys are compatible.
- **Sort ties:** where the original order was undefined (equal timestamps), MongoDB queries break ties by id.
- **Images:** `Photo` serves the original files without Next's resizing, `srcset` or WebP conversion, so pages
  download larger images than before. Layout and cropping are the same.
- **New 503 code:** `DATABASE_UNAVAILABLE` did not exist in the Next app (it returned a generic 500 or error page);
  user-facing text is unchanged.
- **Passwords are reset with an emailed 6-digit code** (MERN addition) instead of a link; old `/reset-password` links
  land on `/forgot-password` with an explanation. Without SMTP settings the email (and its code) is written to the
  server console. New passwords must meet the password policy (12–16 characters, capital and small letter, number,
  symbol, no spaces); existing passwords keep working for sign-in.
- **Brand approval** (MERN addition): new brands wait for an administrator (`/admin/brands`) before they can create
  projects; demo brands from the seed are approved. Brands that existed before this feature have no
  `approvalStatus` and count as approved. Administrators can open every project (`/admin/projects`) and order
  read-only.
- **Social link checks are best effort** (MERN addition): Instagram, Facebook, TikTok and Pinterest show signed-out
  visitors the same page whether or not a profile exists, and many sites block automatic requests, so those links
  are stored as "Couldn't confirm" rather than "Link found". Only a missing host, a 404/410 or a platform's known
  "page not found" redirect blocks saving. An administrator still opens the links when reviewing a brand.
- **Garment categories and colours** (MERN addition): 20 categories beyond the Next app's 12, and named colours with
  swatches in the brief. Colour values for fashion names are typical trade shades, not a standard; Pantone
  references can still be typed as written.
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
