# Fashinza MERN contract (API, data model, ownership)

Status: binding contract for the Next.js → MERN migration (branch `mern`). Written by the Contract agent.
Both server agents (SERVER-A, SERVER-B) and both client agents (CLIENT-A, CLIENT-B) implement against this file
independently, so where this file is precise, follow it literally. Where it says "same as `<file>`", the
original source file in the root Next.js app is the specification and must be ported line by line.

**The existing app is the specification.** Every message string below is copied from the current code. If this
file and the current code ever disagree on behaviour or wording, the current code wins and the discrepancy is a bug
in this file (fix the code to match the original, then note it in your report).

Contents

1. Conventions (transport, errors, auth, serialisation, rate limits, uploads)
2. Page gating (which pages need which roles; client-side redirects)
3. Endpoints by domain (SERVER-A: 1–9, SERVER-B: 10–19)
4. MongoDB collections (Mongoose models) mapped from `prisma/schema.prisma`
5. Server internal modules (shared infrastructure and cross-agent function signatures)
6. Ownership tables (endpoints, server files, client pages)
7. Tests

---

## 1. Conventions

### 1.1 Transport

- All endpoints live under `/api` and speak JSON, except: multipart uploads (marked **multipart**), the file
  download (`GET /api/files/*`, raw bytes) and the payment webhook (raw JSON body, signature verified on the raw
  bytes).
- Dev: Vite on `http://localhost:5173` proxies `/api` to Express on `http://localhost:4000`. Production: one
  Express process serves `/api`, `client/dist` (SPA fallback to `index.html` for any non-`/api` GET that is not a
  file), and the photos in root `public/` (e.g. `/images/hero-sewing.jpg`, `/favicon.ico`).
- Unknown `/api/*` routes: `404 {"error":{"code":"NOT_FOUND","message":"Not found."}}`.
- IDs in paths and JSON are MongoDB ObjectId hex strings (24 hex chars). A malformed id in a path must behave
  exactly like an unknown id (the same `NOT_FOUND` message the service would give), never a 500 / CastError.

### 1.2 Request bodies for mutations ("form bodies")

Every mutation that replaces a server action accepts **either** `multipart/form-data` (what `new FormData(form)`
produces; the client agents should simply post the form) **or** `application/json` with the same field names.
`application/x-www-form-urlencoded` must also be accepted. Field names are identical to today's form field names
(listed per endpoint). Ids that today travel as hidden inputs (`orderId`, `projectId`, `quotationId`, …) are in the
URL path; if they also appear in the body they are ignored in favour of the path.

Normalisation (`readForm(req, arrayKeys)`, see §5) reproduces `formObject()` from `src/server/action.ts`:

- keys listed as *array keys* for the endpoint → always an array of strings, empty/whitespace-only entries removed
  (JSON: a string is wrapped into a one-element array);
- every other key → a string; if the key repeats, the **last** value wins (JSON: values are taken as sent);
- keys starting with `$ACTION` are dropped;
- file parts are never part of the object; they are read separately (`req.files`).

Validation always runs the shared zod schema from `@fashinza/shared/validation/*.js` on that object, so field
error keys and messages are identical to today.

### 1.3 Success responses

- Page-data (GET) endpoints: `200` with the documented JSON object.
- Mutations: `200` (or `201` where stated) with

```json
{ "ok": true, "message": "Company profile saved.", "redirectTo": "/dashboard?welcome=1" }
```

  `message` is today's `FormState.message`: the client shows it as a toast (`toast.success`) — or as the inline
  success alert for forms that use `showSuccessAlert` today (forgot-password). `redirectTo` is today's
  `FormState.redirectTo` (or the target of `redirect()`): the client navigates there with React Router
  (`navigate(redirectTo)`); external/absolute URLs never occur. Either key may be absent. When an endpoint returns
  both, the client navigates and does not toast (today's ActionForm only toasts the message, and the redirecting
  actions return no message). Extra data keys are documented per endpoint.
- After any successful mutation the client re-fetches the data of the current page and `GET /api/auth/me`
  (equivalent to today's `revalidatePath`, including the unread badge).

### 1.4 Error responses

```json
{ "error": { "code": "INVALID", "message": "Please correct the highlighted fields.", "fieldErrors": { "email": "Enter a valid email address." } } }
```

| code | HTTP | meaning / client behaviour |
|---|---|---|
| `INVALID` | 400 | validation or domain rule; show `message` in the form's error alert, `fieldErrors` under the fields (keys are `issue.path.join(".")`, first issue per key wins — `zodFieldErrors`) |
| `UNAUTHENTICATED` | 401 | no/expired/suspended session. Message `"Sign in to continue."`. Page loads → client navigates to `/login?next=<encodeURIComponent(pathname+search)>`; mutations → same navigation |
| `ROLE_DENIED` | 403 | signed in but the role is not allowed (today: `redirect("/dashboard?denied=1")`). Message `"That page is not available for your account type."`. Client navigates to `/dashboard?denied=1` |
| `PROFILE_INCOMPLETE` | 403 | non-admin whose profile is not completed hit a `requireOnboardedUser` endpoint (today: `redirect("/onboarding")`). Message `"Complete your profile to continue."` (never shown). Client navigates to `/onboarding` |
| `FORBIDDEN` | 403 | domain refusal (`forbidden()` / suspended account at login / cross-site request) — show message |
| `NOT_FOUND` | 404 | `"<What> was not found or you do not have access to it."` (`notFound()`); page loads render the not-found card |
| `CONFLICT` | 409 | domain conflict (`conflict()`), show message |
| `RATE_LIMITED` | 429 | message per endpoint (see 1.7) |
| `PAYLOAD_TOO_LARGE` | 413 | webhook body over 64 KiB (oversized uploads are `INVALID`, see §3.1) |
| `INTERNAL` | 500 | unexpected error, logged server side, never leaks internals. Mutations: `"Something went wrong on our side. Your changes were not saved — please try again."` (today's `runAction`). GET endpoints, upload and file download: `"Something went wrong. Please try again."` (today's `errorResponse`) |
| `DATABASE_UNAVAILABLE` | 503 | MongoDB is not reachable (not connected yet, connection lost, server selection timed out). Same messages as `INTERNAL` (what the Next app showed when PostgreSQL was down); clients treat it like `INTERNAL`. Mongoose command buffering is off, so this is answered at once. Checks that need no database (sign-in gate without a cookie, validation, rate limits, Origin) still run first and answer as usual. *(Added by the integrator.)* |

Service code throws `AppError(message, code, fieldErrors?)` exactly where the original services throw; the error
middleware maps codes to HTTP status. Mongoose `CastError` on an id → treat as not found (same message as the
service's `notFound(...)`). Duplicate-key error `11000` replaces Prisma `P2002` wherever the original catches it.

Validation failures from `parseForm` are `INVALID` with message `"Please correct the highlighted fields."` and the
zod field errors (exceptions noted per endpoint).

### 1.5 Authentication and sessions

Ported exactly from `src/server/auth/*`:

- Passwords: scrypt, N=2^17, r=8, p=1, keylen 64, maxmem 256 MiB, input `password.normalize("NFKC")`, stored as
  `scrypt$N$r$p$saltB64$hashB64` (16-byte random salt) in `accounts.password` with `providerId: "credential"`.
  `burnPasswordCheck` for unknown emails (timing equaliser). Existing hashes from the PostgreSQL app remain valid.
- Session: on login/registration create a random token `randomBytes(32).toString("base64url")`; store only
  `sha256(token)` hex in `sessions.token` (unique) with `expiresAt = now + 7 days`, `ipAddress`, `userAgent`
  (first 300 chars). Cookie `fz_session=<raw token>`; `HttpOnly`, `SameSite=Lax`, `Path=/`,
  `Secure` when `NODE_ENV=production`, `Expires=expiresAt`.
- Current user: cookie → sha256 → session; null when missing, expired, or the user's `status !== "ACTIVE"`. Actor
  shape everywhere on the server: `{ id, role, name, email, profileCompleted }` (`id` = user id string).
- `requireUser(roles?)`: no user → 401 `UNAUTHENTICATED`; role not in `roles` → 403 `ROLE_DENIED`.
- `requireOnboardedUser(roles?)`: `requireUser(roles)` then, if `!profileCompleted && role !== "ADMIN"` → 403
  `PROFILE_INCOMPLETE`. Check order: authentication, role, onboarding (same as today).
- Logout deletes the session row (by token hash) and clears the cookie.

### 1.6 Cross-site protection

Next.js server actions rejected cross-site posts. Express reproduces it: for every non-GET/HEAD/OPTIONS request
under `/api` **except** `POST /api/webhooks/payments/:provider`, if an `Origin` header is present and its host
(`new URL(origin).host`) differs from the request host (`X-Forwarded-Host` if present, else `Host`), respond
`403 {"error":{"code":"FORBIDDEN","message":"Cross-site request rejected."}}`. A missing `Origin` header is
allowed (as in Next.js). In dev the Vite proxy must forward with `changeOrigin: false` so `Host` stays
`localhost:5173`, matching the browser's `Origin`.

### 1.7 Rate limits

In-memory fixed window from `@fashinza/shared/rate-limit.js` (`rateLimit(key, limit, windowMs)`), honouring
`RATE_LIMIT_SCALE`. Client IP = first entry of `X-Forwarded-For`, else `X-Real-IP`, else `"unknown"` (do not use
`req.ip`). Limits, keys, order of checks and messages are exactly today's:

| endpoint | key(s) | limit / window | when checked | message (429 `RATE_LIMITED`) |
|---|---|---|---|---|
| register | `register:<ip>` | 10 / 1 h | before validation | `Too many attempts from your connection. Please wait a few minutes and try again.` |
| login | `login:<ip>` then `login:<email>` (short-circuit: the email bucket is only touched when the ip bucket allowed) | 20 / 15 min, 10 / 15 min | after validation | same as register |
| forgot password | `forgot:<ip>` | 5 / 1 h | before validation | same as register |
| reset password | `reset:<ip>` | 10 / 1 h | before validation | same as register |
| contact | `contact:<ip>` | 5 / 10 min | before validation | `Too many messages from your connection. Please try again in a few minutes.` |
| project upload | `upload:<userId>` | 60 / 10 min | after authentication | `Too many uploads. Please wait a few minutes.` |

### 1.8 Serialisation

- Every document is returned with `id` (ObjectId hex string) and without `_id`/`__v`. References (`brandId`,
  `projectId`, …) are hex strings.
- Dates: ISO 8601 strings (`2026-11-05T10:00:00.000Z`) or `null`. Client code that called Date methods must wrap
  values in `new Date(...)`.
- Decimal fields (money, percentages, scores, AQL, defect rate): stored as `Decimal128`, serialised as **strings
  with the column's scale** from the Prisma schema, e.g. `"1234.50"`, `"30.00"`, `"87.25"`, `"2.50"`, or `null`.
  Where today's code called `.toFixed(2)` on a Decimal use `new Decimal(s).toFixed(2)` / `formatMoney(s, cur)`;
  where it called `.toString()` (e.g. `"30%"` in the payment-due notification) use `new Decimal(s).toString()`
  (gives `"30"`, like Prisma). Never use floats for money arithmetic.
- Json fields (`breakdown`, `agreedTerms`, `metadata`, `changes`, `payload`, `snapshot`) are passed through as
  stored.
- Relations are returned with **exactly the nesting and key names of the Prisma `include`/`select` trees**
  documented per endpoint (e.g. `project.brand.brandProfile.companyName`), even though MongoDB stores them in
  separate collections; this keeps client ports mechanical. A missing to-one relation is `null`.
- Prisma `_count` and `groupBy` results keep their Prisma shapes: `{ _count: { quotations: 2 } }`,
  `[{ "currency": "USD", "_sum": { "amount": "1200.00" } }]`, `[{ "role": "BRAND", "_count": 4 }]`.
  `groupBy` arrays are sorted by their `by` keys ascending (enum keys in enum declaration order).
- Paginated lists: `{ items, total, page, pageSize, pages }` (admin lists: `{ items, total, page, pages }`),
  `pages = max(1, ceil(total / pageSize))`, `page = max(1, Number(query.page) || 1)`.

### 1.9 Sorting and searching rules that differ between PostgreSQL and MongoDB

- Enum columns sort in **enum declaration order** in PostgreSQL. Wherever the original orders by an enum
  (`quotation.status`, `attachment.kind`) sort in memory with `enumRank()` from `@fashinza/shared/enums.js`.
- PostgreSQL `DESC` puts `NULL` first, `ASC` puts `NULL` last, unless `nulls` is given explicitly. Reproduce it
  (attachments: `version desc` → nulls first).
- `contains` + `mode: "insensitive"` = case-insensitive substring: build `new RegExp(escapeRegExp(q), "i")`; never
  pass user input as a raw regex.
- Relation filters (`some`, `none`, nested `where`) are resolved with preliminary id queries or `$lookup`; the result
  set, totals and order must equal the original query's.

---

## 2. Page gating (client)

The client reads `GET /api/auth/me` and applies these gates in route loaders **before** loading page data (the
server enforces the same rules again). "onboarded" = `requireOnboardedUser`, "user" = `requireUser`.

| path | gate | extra redirects (in this order) |
|---|---|---|
| `/` and every `(public)` page | none | header shows a workspace link when signed in |
| `/login` | none | signed in → `homeFor(role)` (`/admin` for ADMIN, else `/dashboard`) |
| `/register` | none | signed in → `homeFor(role)`; `?role=manufacturer` (case-insensitive) preselects MANUFACTURER, else BRAND |
| `/forgot-password`, `/reset-password?token=` | none | |
| `/onboarding` | user | ADMIN → `/admin`; `profileCompleted` → BRAND `/dashboard`, MANUFACTURER `/factory` |
| `/dashboard` | onboarded | ADMIN → `/admin`; shows `?denied=1` alert and `?welcome=1` (brand) |
| `/projects` | onboarded BRAND, ADMIN | |
| `/projects/new` | onboarded BRAND | |
| `/projects/:id/edit` | onboarded BRAND | not found → not-found card; status not DRAFT/SUBMITTED/QUOTING → `/projects/:id` |
| `/projects/:id` | onboarded | MANUFACTURER → `/opportunities/:id` (before loading); DRAFT and BRAND → `/projects/:id/edit` |
| `/opportunities`, `/opportunities/:id`, `/quotations` | onboarded MANUFACTURER | |
| `/orders` | onboarded | ADMIN → `/admin/orders` |
| `/orders/:id` | onboarded | |
| `/payments` | onboarded BRAND, MANUFACTURER | |
| `/disputes` | onboarded | ADMIN → `/admin/disputes` |
| `/disputes/:id` | onboarded | |
| `/notifications` | user | |
| `/notifications/:id` | user | calls `POST /api/notifications/:id/open`, then `navigate(redirectTo, { replace: true })` |
| `/profile` | onboarded BRAND | |
| `/factory` | onboarded MANUFACTURER | |
| `/settings` | user | |
| `/search` | onboarded | empty `q` → empty state without calling the API |
| `/admin`, `/admin/*` | user ADMIN | |
| `/sandbox-checkout/:ref` | user BRAND | |

Signed-out visits to any gated page go to `/login?next=<path+search>` (today's `src/proxy.ts`). Role failures go
to `/dashboard?denied=1`; incomplete profiles to `/onboarding`.

---

## 3. Endpoints

Notation: **Roles** — `user` = any signed-in active user (`requireUser()`), `onboarded` = `requireOnboardedUser()`,
`onboarded BRAND` = `requireOnboardedUser(["BRAND"])`, `public` = no session needed. **Body** lists form field
names; `[]` marks array keys. **Side effects** lists notifications (`notify(type, title, message, link)`),
activity-log entries and audit-log entries; message templates are the original ones — port them from the cited
service function verbatim, including typographic quotes `“ ”` and the `…` ellipsis.

Shapes use a compact notation: `Project*` = all scalar fields of the model (see §4) plus `id`; `{a, b}` = only
those fields; `rel: Model*` = nested relation; `[ ]` = array; `(order: …)` = sort order; `take n` = limit.

### SERVER-A

#### 1. Auth & account

##### `GET /api/auth/me` — public
Used by every page (gates, app shell, public header, settings page).
Response `200`:
```json
{ "user": null }
```
or
```json
{ "user": { "id": "…", "name": "Ayesha Khan", "email": "ayesha@example.com", "role": "BRAND", "profileCompleted": true,
            "org": "North Thread", "unread": 3 } }
```
`org` = BRAND: `brandProfile.companyName ?? null`; MANUFACTURER: `manufacturerProfile.businessName ?? null`;
ADMIN: `"Fashinza administration"` (today's `(app)/layout.tsx`). `unread` = count of the user's notifications with
`readAt: null` (`unreadCount`). Never 401.

##### `POST /api/auth/register` — public
Body: `role` (`BRAND`|`MANUFACTURER`), `name`, `organization`, `email`, `password`, `confirmPassword` (`registerSchema`).
Order: rate limit → validate → `registerAccount` → create session (cookie).
Success: `{ ok: true, redirectTo: "/onboarding" }`.
Errors: `RATE_LIMITED`; `INVALID` field errors; `CONFLICT` `"An account with this email already exists."` with
`fieldErrors.email = "An account with this email already exists. Sign in instead."` (race: same message, field
error `"An account with this email already exists."`).
Side effects (one transaction): user, credential account (`providerId: "credential"`, `accountId` = user id), empty
profile (BRAND: `brandProfile {companyName: organization, country: ""}`; MANUFACTURER: `manufacturerProfile
{businessName: organization, description: "", country: "", city: "", minOrderQuantity: 0, maxMonthlyCapacity: 0,
contactName: name, contactEmail: email}`), notification `SYSTEM` "Welcome to Fashinza" (text per role, link
`/onboarding`) — see `registerAccount` in `src/server/services/accounts.ts`.
Page: `/register` (register-form).

##### `POST /api/auth/login` — public
Body: `email`, `password`, `next` (optional) (`loginSchema`).
Order: validate → rate limits (see 1.7) → `authenticate` → create session → update `lastLoginAt`.
Success: `{ ok: true, redirectTo }` where `redirectTo = next` if it starts with `/` and not `//`, else
`homeFor(role)`.
Errors: `INVALID` `"The email or password is incorrect."` (no field errors); `FORBIDDEN` `"This account has been
suspended. Contact the Fashinza team for help."`; `RATE_LIMITED`.
Page: `/login` (login-form; shows `?reset=1` / `?signedOut=1` notices).

##### `POST /api/auth/logout` — public
Deletes the session and the cookie. Success: `{ ok: true, redirectTo: "/login?signedOut=1" }`. Used by the app
shell's sign-out item.

##### `POST /api/auth/forgot-password` — public
Body: `email` (`z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") })`).
Order: rate limit → validate → `createPasswordReset(email)`. If a token was issued and `NODE_ENV !== "production"`,
log `[password-reset] <email>: <APP_URL or http://localhost:3000>/reset-password?token=<token>` (never in
production). The root `.env` `APP_URL` usually points at the Next app; set `APP_URL` in `server/.env` to the MERN
client's URL (e.g. `http://localhost:5173` in dev) so the logged link opens the MERN app. Always the same response:
`{ ok: true, message: "If an account exists for that email, a reset link has been issued. It expires in one hour." }`
(shown as the inline success alert). Side effect: verification row `identifier = "password-reset:<userId>"`,
`value = sha256(token)`, expires in 1 h; previous rows for the identifier deleted.
Page: `/forgot-password`.

##### `POST /api/auth/reset-password` — public
Body: `token` (min 10), `password` (`passwordSchema`), `confirmPassword`; refine → `confirmPassword`:
`"Passwords do not match."`. Order: rate limit → validate → `resetPassword`.
Success: `{ ok: true, redirectTo: "/login?reset=1" }`.
Errors: `INVALID` `"This reset link is invalid or has expired. Request a new one."`.
Side effects (transaction): password updated, verification rows for the identifier deleted, **all sessions of the
user deleted**. Page: `/reset-password?token=…`.

##### `POST /api/auth/change-password` — user
Body: `currentPassword`, `newPassword`, `confirmPassword` (`changePasswordSchema`).
Success: `{ ok: true, message: "Password changed." }`.
Errors: `INVALID` `"Your current password is incorrect."` with `fieldErrors.currentPassword` (same text).
Page: `/settings` (password-form, `resetOnSuccess`).

#### 2. Profiles, factory documents, verification requests

##### `GET /api/profile/brand` — user BRAND
Response: `{ profile: BrandProfile* | null }`. Pages: `/profile` (BrandProfileForm values), `/onboarding` (brand).

##### `PUT /api/profile/brand` — user BRAND
Body: `companyName`, `country`, `city`, `website`, `phone`, `description` (`brandProfileSchema`).
Effect: upsert brand profile, set `user.profileCompleted = true` (transaction).
Success: was not yet onboarded → `{ ok: true, redirectTo: "/dashboard?welcome=1" }`; otherwise
`{ ok: true, message: "Company profile saved." }`. Pages: `/profile`, `/onboarding`.

##### `GET /api/profile/factory` — user MANUFACTURER
Response:
```
{ profile: ManufacturerProfile* + {
    capabilities: [ManufacturerCapability*],
    documents: [ManufacturerDocument*] (order: createdAt desc),
    machinery: [{type, quantity}] (order: sortOrder asc, type asc) } | null }
```
Pages: `/factory`, `/onboarding` (manufacturer: uses `businessName`, `contactName`, `contactEmail`).

##### `PUT /api/profile/factory` — user MANUFACTURER
Body: `businessName`, `description`, `country`, `city`, `categories[]`, `production[]`, `fabrics[]`,
`finishing[]`, `minOrderQuantity`, `maxMonthlyCapacity`, `typicalLeadTimeDays`, `contactName`, `contactEmail`,
`contactPhone`, `website`, and machinery as two parallel repeated keys `machineType` and `machineQuantity`
(multipart) — the server builds `machinery = types.map((type, i) => ({ type, quantity: quantities[i] ?? "" }))`
keeping empty rows so error keys (`machinery.<i>.type`, `machinery.<i>.quantity`) line up. JSON alternative: send
`machinery: [{type, quantity}]` directly. Validation: `manufacturerProfileSchema`.
Effect (transaction, `saveManufacturerProfile`): upsert profile, replace capabilities
(PRODUCTION/FABRIC/FINISHING), replace machinery with `sortOrder = index`, set `profileCompleted = true`.
Success: was not onboarded → `{ ok: true, redirectTo: "/factory?welcome=1" }`; else
`{ ok: true, message: "Factory profile saved." }`. Pages: `/factory`, `/onboarding`.

##### `POST /api/profile/factory/documents` — user MANUFACTURER — **multipart**
Fields: `type` (`CERTIFICATION`|`BUSINESS_REGISTRATION`|`OTHER`), `certificationName`, file field `file` (one file).
Order: validate `documentSchema` → file present else `INVALID` `"Choose a file to upload."` with
`fieldErrors.file = "Choose a PDF or image file."` → `saveUpload(file, "factory-docs")` (PDF/PNG/JPEG/WebP,
≤ 10 MB, signature sniffed) → create document (`certificationName` only kept for CERTIFICATION); stored file
deleted again if the insert fails.
Success: `{ ok: true, message: "Document uploaded. It will be reviewed with your verification request." }`.
Errors: upload validation messages (§3.1). Page: `/factory` (document-forms, `resetOnSuccess`).

##### `DELETE /api/profile/factory/documents/:documentId` — user MANUFACTURER
Success: `{ ok: true, message: "Document deleted." }`. Errors: `NOT_FOUND` `"Document was not found or you do not
have access to it."`; `CONFLICT` `"Verified documents are part of your verification record and cannot be
deleted."`. Deletes the stored file. Page: `/factory`.

##### `POST /api/profile/factory/verification-request` — user MANUFACTURER
Success: `{ ok: true, message: "Verification requested. An administrator will review your documents." }`.
Errors (in order): `INVALID` `"Complete your factory profile before requesting verification."`; `CONFLICT`
`"Your verification request is already being reviewed."` / `"Your factory is already verified."`; `INVALID`
`"Upload your business registration document before requesting verification."`.
Side effects: status `PENDING`, `verificationRequestedAt = now`, `verificationNote = null`; notify all ACTIVE admins
`VERIFICATION_DECISION` "Factory awaiting verification" "`<businessName>` has requested verification." link
`/admin/factories/<profileId>`. Page: `/factory`.

#### 3. Projects (wizard drafts, attachments, submit, matching)

##### `GET /api/projects` — onboarded BRAND, ADMIN
Query: `q`, `status` (`ACTIVE` or a ProjectStatus; anything else ignored), `page`, `pageSize` (default 10, max 50).
Response (`listProjects`): paginated `items: [Project* + { _count: { quotations, matchResults }, order: {id,
deliveredAt} | null }]` (order: updatedAt desc). `_count.quotations` counts only SUBMITTED + REVISION_REQUESTED
quotations. Scope: `projectScope(actor)`. Pages: `/projects`, dashboard "recent projects" (`pageSize=5`, via
`GET /api/dashboard`).

##### `GET /api/projects/:id` — onboarded BRAND
Response: `{ project, submitIssues }` where `project` = `getProject` tree:
```
Project* + {
  brand: { name, brandProfile: { companyName, country } | null },
  attachments: [ProjectAttachment*] (order: kind asc by enum rank, version desc nulls first, createdAt desc),
  order: { id, reference, status, manufacturerId } | null,
  revisions: [ProjectRevision*] (order: createdAt desc, take 20) }
```
`submitIssues`: `[{ field, message }]` = issues of `projectSubmitSchema.safeParse(project with null → undefined,
targetUnitPrice → String, deadline as Date)` mapped to `{ field: String(path[0]), message }`, plus
`{ field: "techPack", message: "Upload at least one tech pack." }` when there is no TECH_PACK attachment (today's
edit page computes this server side). Errors: `NOT_FOUND` `"Project was not found or you do not have access to
it."`. Page: `/projects/:id/edit` (wizard; client derives `targetUnitPrice` string and `deadline.slice(0,10)`).

##### `GET /api/projects/:id/detail` — onboarded BRAND, ADMIN
Response:
```
{ project: <same tree as GET /api/projects/:id>,
  matchData: { matches: [MatchResult* + { manufacturer: { manufacturerProfile: {
        businessName, city, country, verificationStatus, minOrderQuantity, maxMonthlyCapacity, typicalLeadTimeDays,
        documents: [{certificationName}] (CERTIFICATION + VERIFIED only),
        machinery: [{type, quantity}] (order: sortOrder asc, type asc) } | null } }] (order: score desc),
     lastRun: { at, summary: { reviewed, eligible, newlyInvited, exclusionReasons: {<label>: n} } } | null } | null,
  quotations: [Quotation* + { manufacturer: { id, manufacturerProfile: { businessName, city, country, verificationStatus } | null },
        revisions: [QuotationRevision*] (order: version desc) }]
        (order: status asc by enum rank, totalAmount asc; scope quotationScope; expireQuotations({projectId}) first),
  activities: [ActivityLog* + { actor: { name } | null }] (where projectId = id and orderId = null; order: createdAt desc; take 30) }
```
`matchData` = `getProjectMatches` (null when the actor is neither the owner nor an admin); `lastRun` = latest
`MATCHING_RUN` activity (`at` = its createdAt, `summary` = its metadata).
Page: `/projects/:id` (tabs: quotations, matches, brief, files, history; quotation compare).

##### `POST /api/projects/save-step` — onboarded BRAND
Body: `step` (1–7), `projectId` (empty for a new project), `intent` (`next`|`save`, default `next`), `submitted`
(`"1"` when editing a submitted project), plus the fields of that step from `PROJECT_STEPS` (array keys:
`fabrics`, `sizes`, `requiredCapabilities`, `requiredCertifications`, `sampleSizes` — repeated keys; scalars read as
`String(value ?? "")`). Only that step's fields are read; nothing else is overwritten (`saveProjectStepAction` +
`saveProject`).
Errors: unknown step → `INVALID` `"Unknown step."`; `INVALID` `"Please correct the highlighted fields."` + field
errors; `NOT_FOUND` Project; `CONFLICT` `"This project can no longer be edited because production has started."`.
Success (first matching rule wins):
1. `submitted === "1"` → `{ ok: true, redirectTo: "/projects/<id>?updated=1" }`
2. `intent === "next"` → `{ ok: true, redirectTo: "/projects/<id>/edit?step=<step+1>" }`
3. new project (no `projectId`) → `{ ok: true, redirectTo: "/projects/<id>/edit?step=<step>&saved=1" }`
4. otherwise → `{ ok: true, message: "Draft saved." }`
Side effects: new draft → activity `PROJECT_CREATED` "Draft project created."; draft update → `wizardStep =
max(old, step+1)`; submitted project with changes → project revision `{field: {from, to}}`, activity
`PROJECT_REVISED`, notify quoting manufacturers `SYSTEM` "Project requirements changed" (link
`/opportunities/<id>`). Pages: `/projects/new`, `/projects/:id/edit` (wizard).

##### `POST /api/projects/:id/submit` — onboarded BRAND
Success: `{ ok: true, redirectTo: "/projects/<id>?submitted=1", summary: { reviewed, eligible, newlyInvited, exclusionReasons } }`.
Errors: `CONFLICT` `"This project has already been submitted."`; `INVALID` `"Some required details are missing.
Complete the highlighted steps before submitting."` + field errors; `INVALID` `"Upload a tech pack before
submitting so factories can quote accurately."` + `fieldErrors.techPack = "Upload at least one tech pack."`.
Side effects (transaction, conditional DRAFT→SUBMITTED update so a double submit cannot run matching twice):
`submittedAt`, `wizardStep = 7`, activity `PROJECT_SUBMITTED`, matching run (`runMatchingForProject`: match rows,
`MATCH_FOUND` notifications to newly invited factories, `MATCHING_RUN` activity with summary metadata), status
`QUOTING` when ≥ 1 eligible, notify brand `PROJECT_SUBMITTED` "Project submitted". Page: `/projects/:id/edit`
(review step, project-buttons).

##### `POST /api/projects/:id/rerun-matching` — onboarded BRAND
Success: `{ ok: true, message: "Matching reviewed <reviewed> factories: <eligible> eligible, <newlyInvited> newly invited." }`.
Errors: `CONFLICT` `"Matching can only be run before a quotation is accepted."`. Side effects: matching run; status
SUBMITTED → QUOTING when ≥ 1 eligible. Page: `/projects/:id`.

##### `POST /api/projects/:id/cancel` — onboarded BRAND
Body: `reason` (`reasonSchema`). Success: `{ ok: true, message: "Project cancelled." }`.
Errors: `CONFLICT` `"Projects with an accepted quotation cannot be cancelled here. Raise a dispute instead."`.
Side effects: status CANCELLED; open quotations (DRAFT/SUBMITTED/REVISION_REQUESTED) → REJECTED with `decidedAt`;
notify their manufacturers `QUOTATION_REJECTED` "Project cancelled"; activity `PROJECT_CANCELLED`
"Project cancelled: <reason>". Page: `/projects/:id`, `/projects/:id/edit`.

##### `DELETE /api/projects/:id` — onboarded BRAND
Deletes a draft and its files (`deleteDraft`). Success: `{ ok: true, redirectTo: "/projects?deleted=1" }`.
Errors: `CONFLICT` `"Only drafts can be deleted. Cancel submitted projects instead."`. Cascade (Prisma
`onDelete: Cascade`): attachments, revisions, quotations (+ their revisions), match results and activity logs of the
project; issue reports keep the dispute with `projectId: null` (`SetNull`). Page: wizard.

##### `POST /api/projects/:id/attachments` — user (service asserts BRAND owner) — **multipart**
Fields: `file` (one file), `kind` (an AttachmentKind, default `OTHER`), `notes` (trimmed, first 300 chars, empty →
none). Order: authenticate (401 `UNAUTHENTICATED` `"Sign in to continue."`) → rate limit → `Content-Length >
10 MB + 64 KiB` → `INVALID` `"Files must be 10 MB or smaller."` (multer limit must produce the same error) → no
file → `INVALID` `"Choose a file to upload."` → unknown kind → `INVALID` `"Unknown file type."` → `addAttachment`.
Success `201`: `{ id, kind, version, fileName }` (version = tech pack number or null).
Errors: `CONFLICT` `"Files cannot be added to a closed project."`; upload validation (§3.1), with
`imagesOnly` for REFERENCE_IMAGE/SKETCH. Side effects: see `addAttachment` (tech pack version = max + 1, retry on
duplicate key up to twice; activity `TECH_PACK_VERSION`/`FILE_ADDED`; `SYSTEM` "New tech pack version"
notifications after submission). Page: wizard step 6 and `/projects/:id` files tab (file-uploader, XHR with
progress; error text is `response.error.message`).

##### `DELETE /api/projects/:id/attachments/:attachmentId` — onboarded BRAND
Success: `{ ok: true, message: "File removed." }`. Errors: `NOT_FOUND` File; `CONFLICT` `"Files on a submitted
project are kept as part of its history. Upload a new version instead."`. Deletes the stored file.
Page: wizard files step (attachment-list).

#### 4. Quotations

##### `GET /api/quotations` — onboarded MANUFACTURER
Query: `status` (a QuotationStatus, else ignored), `page`. Runs `expireQuotations({manufacturerId})` first.
Response (`listMyQuotations`, pageSize 10): `items: [Quotation* + { project: { id, name, category, order: { id,
manufacturerId } | null } }]` (order: updatedAt desc). Page: `/quotations` (CLIENT-B).

##### `POST /api/opportunities/:projectId/quotation` — onboarded MANUFACTURER
Body: `intent` (`submit` sends, anything else saves a draft), `quantity`, `unitPrice`, `fabricCostPerUnit`,
`finishingCostPerUnit`, `packagingCostPerUnit`, `samplingCost`, `logisticsCost`, `taxPercent`, `minQuantity`,
`productionDays`, `validUntil` (YYYY-MM-DD), `notes`, `sampleLeadTimeDays`, `sampleNotes` (`quotationSchema`).
Totals are always computed on the server (`calculateQuotationTotals`); currency = project currency.
Success: submit → `{ ok: true, message: "Quotation version <version> sent to the brand." }`; draft →
`{ ok: true, message: "Draft saved. The brand cannot see it until you send it." }`.
Errors (see `saveQuotation`): `NOT_FOUND` Opportunity; `CONFLICT` `"Only verified factories can send
quotations."`, `"This project is no longer accepting quotations."`, `"This quotation was <status lowercased> and can
no longer be changed."`, `"A sent quotation cannot go back to draft. Send the revised quotation instead."`;
`INVALID` `"The brand asked for samples. Enter how many days you need to make them."` (same text in
`fieldErrors.sampleLeadTimeDays`).
Side effects: revision snapshot when re-sending a quotation the brand has seen (version + 1); on send: project
SUBMITTED → QUOTING, notify brand `QUOTATION_RECEIVED` "New quotation" / `QUOTATION_REVISED` "Quotation revised"
(link `/projects/<id>?tab=quotations`), activity `QUOTATION_SUBMITTED` / `QUOTATION_REVISED`.
Page: `/opportunities/:id` (quotation-form).

##### `POST /api/quotations/:id/withdraw` — onboarded MANUFACTURER
Success: `{ ok: true, message: "Quotation withdrawn." }`. Errors: `NOT_FOUND` Quotation; `CONFLICT` `"This
quotation can no longer be withdrawn."`. Side effects: status WITHDRAWN, `decidedAt`; if it had been sent, notify
brand `QUOTATION_REJECTED` "Quotation withdrawn". Page: `/opportunities/:id`.

##### `POST /api/quotations/:id/request-revision` — onboarded BRAND
Body: `note` (`decisionNoteSchema`). Success: `{ ok: true, message: "Revision requested. The factory has been
notified." }`. Errors: `NOT_FOUND` Quotation; `CONFLICT` `"Revisions can only be requested on a submitted
quotation."`. Side effects: status REVISION_REQUESTED, `revisionRequest = note`, notify manufacturer
`QUOTATION_REVISION_REQUESTED`, activity. Page: `/projects/:id` quotations tab.

##### `POST /api/quotations/:id/reject` — onboarded BRAND
Body: `note`. Success: `{ ok: true, message: "Quotation declined." }`. Errors: `CONFLICT` `"Only open quotations can
be rejected."`. Side effects: REJECTED, `decidedAt`, `revisionRequest = note`, notify `QUOTATION_REJECTED`
"Quotation declined", activity. Page: `/projects/:id`.

##### `POST /api/quotations/:id/accept` — onboarded BRAND
Success: `{ ok: true, redirectTo: "/orders/<orderId>?created=1", orderId }`.
Errors (see `acceptQuotation`): `NOT_FOUND` Quotation; `CONFLICT` `"This quotation has expired. Ask the factory to
send a new one."`, `"You asked for a revision. Wait for the factory to send the revised quotation."`, `"Only a
submitted quotation can be accepted."`, `"A quotation has already been accepted for this project."`, `"This project
already has an order."`. A concurrent second acceptance must fail (unique index `orders.projectId` + transaction
write conflict) — never two orders.
Side effects: expire first (outside the transaction); in one transaction: quotation ACCEPTED, other open quotations
REJECTED with `revisionRequest "Another quotation was accepted."` and `QUOTATION_REJECTED` "Quotation not selected"
to those that had been sent, project IN_PRODUCTION, `createOrderFromQuotation` (SERVER-B function: order, 8
milestones, default payment schedule, `ORDER_CREATED` activity), notify manufacturer `QUOTATION_ACCEPTED`, notify
brand `ORDER_CREATED`. Page: `/projects/:id` (quotation compare / project-buttons).

#### 5. Opportunities

##### `GET /api/opportunities` — onboarded MANUFACTURER
Query: `filter` (`new`|`open`|`all`, default `open`), `q`, `page`. Response:
`{ ...listOpportunities (pageSize 10), verified: profile.verificationStatus === "VERIFIED" }` with
`items: [MatchResult* + { project: { id, name, category, quantity, deadline, status, currency,
brand: { brandProfile: { companyName, country } | null }, quotations: [{ status, totalAmount, version }] (this
manufacturer's only) } }]` (order: createdAt desc). Filter semantics exactly as `listOpportunities`.
Page: `/opportunities` (CLIENT-B).

##### `GET /api/opportunities/:projectId` — onboarded MANUFACTURER
Response (`getOpportunity`, runs `expireQuotations({projectId, manufacturerId})`):
```
{ match: MatchResult*,
  project: Project* + { brand: { brandProfile: { companyName, country, description } | null },
       attachments: [ProjectAttachment*] (order: kind asc by enum rank, version desc nulls first),
       order: { id, manufacturerId } | null,
       revisions: [ProjectRevision*] (order: createdAt desc, take 10) },
  quotation: Quotation* + { revisions: [QuotationRevision*] (order: version desc) } | null,
  profile: { verificationStatus, typicalLeadTimeDays, minOrderQuantity } | null }
```
Errors: `NOT_FOUND` `"Opportunity was not found or you do not have access to it."`.
Page: `/opportunities/:id` (CLIENT-B).

#### 6. Files

##### `GET /api/files/*key` — user
`key` = the stored file key, e.g. `projects/<32 hex>.pdf` (two path segments). Query `download` (presence) →
attachment disposition.
Order: no user → `401 {"error":{"code":"UNAUTHENTICATED","message":"Sign in to continue."}}` → `authorizeFile`
(project attachment within `projectScope`; manufacturer document of the actor's own profile, any for ADMIN;
milestone evidence / sample photo / QC photo whose order is within `orderScope`) → unknown or forbidden →
`NOT_FOUND` `"File was not found or you do not have access to it."`. A malformed key is also `NOT_FOUND` with that
message: the original looks the record up before it checks the key format, so the `"Invalid file key."` error is
never reached through this route (it stays in `storage.js` for reads by key). Success: raw bytes with headers exactly:
`Content-Type: <mimeType>`, `Content-Length`, `Content-Disposition: <inline|attachment>; filename*=UTF-8''<encodeURIComponent(fileName)>`,
`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`,
`Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox`.
Used by: attachment lists, factory documents, evidence/sample/QC photos (`<a href>` / `<img src>`).

#### 7. Contact enquiries

##### `POST /api/contact` — public
Body: `name`, `email`, `company`, `inquiryType`, `subject`, `message` (`contactSchema`).
Order: rate limit → validate → insert. Success: `{ ok: true, message: "Thank you — your message has been received.
We usually reply within two working days." }`. Errors: `RATE_LIMITED`; `INVALID` field errors; insert failure →
`500 INTERNAL` `"We could not send your message right now. Please try again later."`. Page: `/contact`.

#### 8. Search

##### `GET /api/search` — onboarded
Query: `q` (trimmed, first 100 chars). Empty `q` → `{ q: "", projects: null, orders: null, opportunities: null,
total: 0 }`. Otherwise:
`{ q, projects: (MANUFACTURER ? null : listProjects(actor, {q, pageSize: 10})), orders: listOrders(actor, {q,
pageSize: 10}), opportunities: (MANUFACTURER ? listOpportunities(actor, {q, filter: "all"}) : null), total }` with
`total = projects.total + orders.total + opportunities.total` (nulls count 0). Shapes as in `GET /api/projects`,
`GET /api/orders`, `GET /api/opportunities`. No `refreshDelays` here (as today). Page: `/search` (CLIENT-B).

#### 9. (reserved — no other SERVER-A endpoints)

### SERVER-B

#### 10. Orders, milestones, messages

##### `GET /api/orders` — onboarded (any role; the `/orders` page redirects ADMIN client side)
Query: `q`, `status` (`ACTIVE` or an OrderStatus), `delayed` (`"1"`), `attention` (`samples`|`qc`), `page`,
`pageSize` (default 10, max 50). Runs `refreshDelays()` first. Response (`listOrders`): paginated
`items: [Order* + { project: { name, category }, brand: { brandProfile: { companyName } | null },
manufacturer: { manufacturerProfile: { businessName } | null }, milestones: [{ stage, status, isDelayed,
plannedEnd, completedAt }] }]` (order: updatedAt desc). Filter semantics exactly as `listOrders` (delayed = active
and (a milestone with `isDelayed && completedAt == null` or `expectedCompletionDate < now`)). Page: `/orders`.

##### `GET /api/orders/:id` — onboarded
Response `{ order }` (`getOrder`, scope `orderScope`):
```
Order* + {
  project: Project* + { attachments: [ProjectAttachment*] (order: kind enum rank asc, version desc nulls first) },
  brand: { name, brandProfile: { companyName } | null },
  manufacturer: { name, manufacturerProfile: { businessName, city, country } | null },
  milestones: [ProductionMilestone* + { evidence: [MilestoneEvidence*] (createdAt desc), responsibleUser: { name } | null }] (sequence asc),
  samples: [Sample* + { photos: [SamplePhoto*], reviewedBy: { name } | null }] (round desc),
  qcReports: [QCReport* + { defects: [QCDefect*], photos: [QCReportPhoto*], rework: ReworkTask* | null, inspector: { name } }] (createdAt desc),
  reworkTasks: [ReworkTask*] (createdAt desc),
  paymentMilestones: [PaymentMilestone* + { transactions: [PaymentTransaction*] (createdAt desc) }] (sequence asc),
  messages: [Message* + { author: { name, role } }] (createdAt asc, take 200),
  activities: [ActivityLog* + { actor: { name } | null }] (createdAt desc, take 50),
  issues: [IssueReport*] (createdAt desc) }
```
Errors: `NOT_FOUND` `"Order was not found or you do not have access to it."`. Page: `/orders/:id` (all tabs:
production, samples & QC, payments, messages, details, activity; notices `?created=1`, `?payment=returned`). The
page re-fetches this endpoint every 30 s while the tab is visible (today's `LiveRefresh` → `router.refresh()`).

##### `POST /api/orders/:id/evidence` — onboarded MANUFACTURER — **multipart**
Fields: `stage` (a MilestoneStage), `note` (`evidenceNoteSchema`), files `file` (multiple; only the first 10 are
stored). Order: validate note → no files → `INVALID` `"Choose a photo or document."` + `fieldErrors.file` (same) →
unknown stage → `INVALID` `"Unknown stage."` → `addEvidence` per file.
Success: `{ ok: true, message: "<n> evidence file<s> added." }` with `n = min(count, 10)` and the plural `s`
decided by the full count (`list.length === 1 ? "" : "s"`), exactly as `addEvidenceAction`.
Errors: `CONFLICT` `"Evidence can only be added to the current stage."`, `"This stage is not open for evidence."`;
upload validation. Side effect: activity `EVIDENCE_ADDED`. Page: order production tab (order-forms).

##### `POST /api/orders/:id/stages/complete` — onboarded MANUFACTURER
Body: `stage`, `note` (trimmed; empty → none). Success: `{ ok: true, message: "Stage completed. The brand has been
notified." }`. Errors: unknown stage → `INVALID` `"Unknown stage."`; see `completeEvidenceStage` / `completeStage` (e.g. `"<Label> completes when the brand
approves a sample."`, `"Only the manufacturer producing this order can do this."`, `"Upload evidence for <label>
first: <requirement>."`, `"<Label> is not the current stage. Current stage: <Label>."`). Side effects:
`completeStage` (next stage IN_PROGRESS, order/project status, payment milestones DUE with `dueAt = now + 7 d` and
`PAYMENT_UPDATE` notifications, activity `MILESTONE_COMPLETED`, `MILESTONE_UPDATED` notification to the other
party); `REWORK_READY` activity after FINISHING with open rework. Page: order production tab.

##### `POST /api/orders/:id/samples` — onboarded MANUFACTURER — **multipart**
Fields: `description`, `revisionNotes` (`sampleSchema`), files `photos` (1–10 images). Success: `{ ok: true,
message: "Sample submitted for the brand's review." }`. Errors: `INVALID` `"Add at least one photo of the sample."`
/ `"Upload up to 10 photos per sample."` (also as `fieldErrors.photos`); `CONFLICT` `"Samples can be submitted
during the sampling stage."`, `"A sample is already waiting for the brand's review."`. Side effects: sample round
n, SAMPLING milestone AWAITING_APPROVAL, notify brand `SAMPLE_SUBMITTED`, activity. Page: order samples tab.

##### `POST /api/orders/:id/samples/:sampleId/review` — onboarded BRAND
Body: `decision` (`APPROVED`|`REJECTED`|`REVISION_REQUESTED`), `feedback` (`sampleReviewSchema`).
Success: APPROVED → `"Sample approved. Production moves to cutting."`, else `"Decision sent to the factory."`.
Errors: `NOT_FOUND` Sample; `CONFLICT` `"This sample has already been reviewed."`. Side effects: see
`reviewSample` (APPROVED completes SAMPLING via `completeStage`). Page: order samples tab.

##### `POST /api/orders/:id/qc-reports` — onboarded MANUFACTURER, ADMIN — **multipart**
Fields: `inspectionDate`, `batchSize`, `sampleSize`, `aqlMajor`, `aqlMinor`, `defects` (JSON string of
`[{category, severity, count}]`; unparsable → `INVALID` `"The defect list could not be read. Please re-enter it."`
without field errors), `correctiveActions`, `notes` (`qcReportSchema`), files `photos` (≤ 20 images).
Success: PASS → `"Inspection recorded: PASS. Waiting for the brand to accept it."`; FAIL → `"Inspection recorded:
FAIL. A rework task was created and production returned to stitching."`. Errors: see `submitQcReport` (sample size
below plan: `INVALID` `"The sampling plan requires at least <n> units to be inspected for a batch of <batch>."` with
`fieldErrors.sampleSize = "Inspect at least <n> units (code letter <L>)."`). Result computed on the server from
the AQL plan. Side effects: FAIL → rework task + `rollbackForRework` + `QC_OUTCOME` notifications (parties except
actor, and admins), activity `QC_FAILED`; PASS → QC milestone AWAITING_APPROVAL, notify brand
`QC_REPORT_SUBMITTED`, activity `QC_PASSED`. Page: order samples tab (QC form).

##### `POST /api/orders/:id/qc-reports/:reportId/decision` — onboarded BRAND
Body: `decision` (`ACCEPTED`; anything else = `REJECTED`), `note` (trimmed; empty → none).
Success: ACCEPTED → `"QC report accepted. The factory can now ship."`; REJECTED → `"Report rejected. The order went
back to rework."`. Errors: `INVALID` `"Explain why the report is rejected."` with `fieldErrors.note = "Explain why
the report is rejected (at least 5 characters)."`; `NOT_FOUND` `QC report`; `CONFLICT` `"Failed inspections already
triggered rework and need no decision."`, `"A decision has already been recorded for this report."`.
Side effects: see `decideQcReport`. Page: order samples tab.

##### `POST /api/orders/:id/shipment` — onboarded MANUFACTURER
Body: `carrier`, `trackingNumber` (`shipmentSchema`). Success: `"Shipment recorded. The brand has the tracking
details."`. Errors: `CONFLICT` `"The order is not ready to ship yet."`. Side effects: `trackingInfo = "<carrier> ·
<tracking>"`, `shippedAt`, complete SHIPPING, notify brand `ORDER_SHIPPED`. Page: order production tab.

##### `POST /api/orders/:id/delivery` — onboarded BRAND
Body: `note`. Success: `"Delivery confirmed. The order is complete."`. Errors: `CONFLICT` `"Delivery can be
confirmed after the order has shipped."`. Side effects: complete DELIVERY → order/project DELIVERED, `deliveredAt`,
`ORDER_DELIVERED` notification. Page: order production tab.

##### `POST /api/orders/:id/messages` — onboarded (any role within `orderScope`)
Body: `body`, `milestoneId` (`messageSchema`). Success: `{ ok: true, message: "Message sent." }`. Errors:
`NOT_FOUND` Order / Milestone. Side effects: message; notify the other participants `MESSAGE_RECEIVED` "New message
on <reference>" (body, truncated to 137 chars + `…` when longer than 140), link `/orders/<id>?tab=messages`.
Page: order messages tab (`resetOnSuccess`).

##### `PUT /api/orders/:id/payment-schedule` — onboarded BRAND
Body: `items` — JSON string (multipart) or array (JSON) of `{label, percentage, triggerStage}`. Unparsable →
`INVALID` `"The schedule could not be read."`. Validation `paymentScheduleSchema`; on failure the error `message`
is `fieldErrors.items ?? "Check the payment shares: they must be above 0% and add up to 100%."` (field errors still
included). Success: `"Payment schedule updated."`. Errors: `NOT_FOUND` Order; `CONFLICT` `"The schedule cannot
change after a payment has started."`; `INVALID` `"Each payment must be tied to a different stage."`. Side effects:
see `updatePaymentSchedule`. Page: order payments tab.

#### 11. Payments (sandbox provider, checkout, webhooks, refunds)

##### `GET /api/payments` — onboarded BRAND, MANUFACTURER
Query: `status` (a PaymentMilestoneStatus), `page`. Response (`listPayments`, pageSize 20):
```
{ items: [PaymentMilestone* + { order: { id, reference, project: { name },
     brand: { brandProfile: { companyName } | null }, manufacturer: { manufacturerProfile: { businessName } | null } },
     transactions: [PaymentTransaction*] (createdAt desc) }]
     (order: order.createdAt desc, orderId asc, sequence asc),
  total, page, pageSize, pages,
  totals: [{ currency, status, _sum: { amount } }] (whole scope, ignores the status filter) }
```
Page: `/payments` (CLIENT-B).

##### `POST /api/payments/milestones/:id/checkout` — onboarded BRAND
Success: `{ ok: true, redirectTo: "<checkoutUrl>" }` (sandbox: `/sandbox-checkout/<providerRef>`). PROCESSING with a
pending charge → returns the existing checkout URL. Errors: `NOT_FOUND` `Payment milestone`; `CONFLICT` `"This
milestone is already paid."`, `"This milestone is not due yet."`, `"A payment for this milestone is already in
progress."`. Side effects: milestone PROCESSING, pending CHARGE transaction. Page: order payments tab, `/payments`.

##### `GET /api/sandbox-checkout/:ref` — user BRAND
Response `{ txn }` (`getCheckout`): `PaymentTransaction* + { paymentMilestone: PaymentMilestone* + { order: { id,
reference, project: { name } } } }`. Errors: `NOT_FOUND` `"Checkout session was not found or you do not have access
to it."`. Page: `/sandbox-checkout/:ref`.

##### `POST /api/sandbox-checkout/:ref` — user BRAND
Body: `outcome` (`success`|`declined`|`cancel`). Not sandbox → `INVALID` `"Simulation is only available in sandbox
mode."`. Errors: `NOT_FOUND` Checkout session; `CONFLICT` `"This checkout has already been completed."`.
Effect: delivers a signed sandbox webhook over HTTP to `<SERVER_URL>/api/webhooks/payments/sandbox` (this API
server's own URL, default `http://localhost:<PORT>`; the original used `APP_URL`, which was the Next app itself and
still points there in the root `.env`, so the MERN server must not use it)
(`payment.succeeded`, or `payment.failed` with reason `"Checkout cancelled by the payer"` / `"Card declined
(sandbox test)"`). Success: `{ ok: true, redirectTo: "/orders/<orderId>?payment=returned&tab=payments" }`.
Page: sandbox checkout buttons.

##### `POST /api/webhooks/payments/:provider` — public (signature-verified), no Origin check
Raw body (≤ 64 KiB, else `413 {"error":{"code":"PAYLOAD_TOO_LARGE","message":"Payload too large."}}`), header
`x-fashinza-signature: t=<unix>,v1=<hex hmac-sha256(secret, "<t>.<raw>")>`, tolerance 300 s.
Success `200`: `{ status: "processed" | "duplicate" | "ignored", detail? }` (`processPaymentWebhook`).
Errors: signature/format rejected (`WebhookSignatureError` or JSON `SyntaxError`) → `400
{"error":{"code":"INVALID","message":"Webhook rejected: <reason>"}}` (any other `AppError` is also 400 with its
message); anything else (unknown provider, amount mismatch, database failure) → `500
{"error":{"code":"INTERNAL","message":"Processing failed."}}` — when the event row exists its `error` column stores
the first 500 chars of the message, so the provider retries and admins see it. Idempotency: unique `(provider, eventId)`; conditional transaction status
updates. Side effects: `PAYMENT_UPDATE` notifications, activities `PAYMENT_SUCCEEDED`/`PAYMENT_FAILED`/
`PAYMENT_REFUNDED`. Must be mounted with `express.raw({ type: "*/*", limit: "64kb" })` **before** `express.json()`.

##### `POST /api/admin/payments/milestones/:id/refund` — user ADMIN
Body: `reason` (`reasonSchema`). Success: `{ ok: true, message: "Refund issued through the payment provider (test
mode)." }`. Errors: `NOT_FOUND` Payment milestone; `CONFLICT` `"Only paid milestones can be refunded."`, `"A refund
is already in progress."`, `"No successful charge was found for this milestone."`. Side effects: pending REFUND
transaction, audit `PAYMENT_REFUND_REQUESTED` (metadata `{amount, currency}`), then (sandbox) deliver
`refund.succeeded` webhook. Page: `/admin/payments`.

#### 12. Disputes

##### `POST /api/disputes` — onboarded BRAND, MANUFACTURER
Body: `orderId`, `projectId`, `category`, `subject`, `description` (`disputeSchema`; here `orderId`/`projectId` are
body fields because there is no path id). Success: `{ ok: true, redirectTo: "/disputes/<id>?created=1" }`.
Errors: `INVALID` `"Choose the order or project this dispute is about."` + `fieldErrors.orderId = "Choose an
order."`; `NOT_FOUND` Order / Project. Side effects: see `raiseDispute` (admins `DISPUTE_UPDATE` "New dispute" link
`/admin/disputes/<id>` — kept as today even though that page path does not exist; counterpart notified; activity
`DISPUTE_RAISED` for order disputes). Page: order page (`RaiseDisputeButton`, hidden for admins and closed orders).

##### `GET /api/disputes` — onboarded (any; `/disputes` page redirects ADMIN)
Query: `status` (IssueStatus), `page`, `pageSize` (default 10, max 50). Response (`listDisputes`): paginated
`items: [IssueReport* + { reporter: { name, role }, order: { id, reference } | null, project: { id, name } | null }]`
(createdAt desc, scope `disputeScope`). Pages: `/disputes`, `/admin/disputes` (with `pageSize=20`).

##### `GET /api/disputes/:id` — onboarded
Response `{ dispute: IssueReport* + { reporter: { name, role, email }, order: { id, reference } | null, project:
{ id, name } | null } }`. Errors: `NOT_FOUND` `"Dispute was not found or you do not have access to it."`.
Page: `/disputes/:id` (admins see the update form there).

##### `POST /api/admin/disputes/:id` — user ADMIN
Body: `status`, `adminNote`, `resolution` (`disputeUpdateSchema`). Success: `{ ok: true, message: "Dispute updated
and the parties notified." }`. Errors: `NOT_FOUND` Dispute; `CONFLICT` `"Closed disputes cannot be changed."`.
Side effects: see `updateDispute` (audit `DISPUTE_UPDATED`, `DISPUTE_UPDATE` notification to parties).
Page: `/disputes/:id` (DisputeUpdateForm, shown to admins while the dispute is not CLOSED).

#### 13. Notifications

##### `GET /api/notifications` — user
Query: `unread` (`"1"`), `page`. Response: `{ ...listNotifications (pageSize 20), unreadTotal }` with
`items: [Notification*]` (createdAt desc). Page: `/notifications`.

##### `POST /api/notifications/read-all` — user
Marks all of the caller's unread notifications read. Success: `{ ok: true }` (no toast). Page: `/notifications`.

##### `POST /api/notifications/:id/open` — user
Marks the notification read if it belongs to the caller and returns where to go:
`{ ok: true, redirectTo }` where `redirectTo` = its `link` when it starts with `/` and not `//`, else
`"/notifications"`; unknown/foreign id → `{ ok: true, redirectTo: "/notifications" }`. Unauthenticated → 401 (client
goes to `/login`). Used by the `/notifications/:id` client route (links in the notification list, dashboard recent
notifications, app-shell bell).

#### 14. Dashboard

##### `GET /api/dashboard` — onboarded BRAND, MANUFACTURER (ADMIN → `ROLE_DENIED`; the client redirects admins to `/admin` before calling)
BRAND response: `{ role: "BRAND", ...brandDashboard, recent: listProjects(actor, { pageSize: 5 }) }`:
```
{ activeProjects, drafts, activeOrders, pendingQuotations, samplesToReview, delayedOrders, pendingQc,  (numbers)
  payments: [PaymentMilestone* + { order: { id, reference, project: { name } } }] (status DUE/FAILED/PROCESSING; dueAt asc nulls last; take 5),
  notifications: [Notification*] (createdAt desc, take 6),
  openPayments: [{ orderId, status, currency, _sum: { amount }, _count }] (DUE/FAILED),
  isNew: boolean, recent: <GET /api/projects response> }
```
MANUFACTURER response: `{ role: "MANUFACTURER", ...manufacturerDashboard }`:
```
{ profile: { verificationStatus, verificationNote, businessName } | null,
  newOpportunities, openQuotes, revisionRequests, activeOrders, delayedOrders,  (numbers)
  actionOrders: [Order* + { project: { name }, milestones: [{ stage, status, plannedEnd, isDelayed, completedAt }] }] (expectedCompletionDate asc, take 6),
  paid: [{ currency, _sum: { amount } }],
  notifications: [Notification*] (take 6),
  stageStates: [{ id, currentStage, milestones: [{ stage, status, isDelayed }] }] }
```
Both run `refreshDelays()` and `expireQuotations(...)` first, exactly as `src/server/services/dashboard.ts`.
Page: `/dashboard` (+ attention-list, recent-notifications).

#### 15. Admin

All `/api/admin/*` endpoints: `requireUser(["ADMIN"])`.

##### `GET /api/admin/overview`
Response = `adminDashboard` (runs `refreshDelays()`):
`{ usersByRole: [{role, _count}], suspended, pendingFactories, verifiedFactories, ordersByStatus: [{status, _count}],
delayedOrders, openDisputes, failedQc30, paidByCurrency: [{currency, _sum: {amount}}], webhookErrors,
projectsByStatus: [{status, _count}], recentAudit: [AuditLog* + { actor: { name }, target: { name?, href? } | undefined }] (take 6) }`.
Page: `/admin`.

##### `GET /api/admin/factories`
Query: `status`, `q`, `page`. Status rule (today's page): query `status` **absent** → `PENDING`; a
VerificationStatus → that; anything else (e.g. `ALL`, empty) → no filter. Response:
`{ ...listFactories, counts: countFactoriesByStatus({q}), status: <effective status or null> }` with
`items: [ManufacturerProfile* + { _count: { documents }, user: { email, status } }]` (order:
verificationRequestedAt asc nulls last, createdAt desc; only profiles whose user `profileCompleted`), `counts` =
`{ UNSUBMITTED?: n, PENDING?: n, VERIFIED?: n, REJECTED?: n }`. Page: `/admin/factories`.

##### `GET /api/admin/factories/:id`
Response: `{ profile: ManufacturerProfile* + { capabilities: [ManufacturerCapability*], documents:
[ManufacturerDocument*] (createdAt desc), user: { id, email, name, status, statusReason, createdAt } },
history: [AuditLog* + { actor: { name }, target: {name?, href?} | undefined }] (createdAt desc), machinery:
[{type, quantity}] }` (`getFactory` + `listMachinery`). Errors: `NOT_FOUND` `"Factory was not found or you do not
have access to it."`. Page: `/admin/factories/:id`.

##### `POST /api/admin/documents/:documentId/review`
Body: `status` (`VERIFIED`; anything else = `REJECTED`), `note` (trimmed; empty → none), `profileId` (ignored).
Success: `"Document verified."` / `"Document rejected."`. Errors: `INVALID` `"Give a reason for rejecting the
document."` (+ `fieldErrors.note`); `NOT_FOUND` Document. Side effects: see `reviewDocument` (audit
`DOCUMENT_VERIFIED|DOCUMENT_REJECTED` with metadata `{fileName, certification}`, `VERIFICATION_DECISION`
notification). Page: `/admin/factories/:id`.

##### `POST /api/admin/factories/:id/verification`
Body: `decision` (`VERIFIED`; anything else = `REJECTED`), `reason` (`reasonSchema`). Success: VERIFIED → `"Factory
verified. It can now be matched to projects."`; REJECTED → `"Verification rejected. The factory has been told
why."`. Errors: `NOT_FOUND` Factory; `CONFLICT` `"Only factories awaiting review can be verified or rejected."`;
`INVALID` `"Verify the business registration document before approving the factory."`. Side effects: see
`decideVerification`. Page: `/admin/factories/:id`.

##### `POST /api/admin/factories/:id/revoke`
Body: `reason`. Success: `"Verification revoked."`. Errors: `CONFLICT` `"Only verified factories can have
verification revoked."`. Side effects: see `revokeVerification`. Page: `/admin/factories/:id`.

##### `GET /api/admin/users`
Query: `q`, `role` (Role), `status` (UserStatus), `page`. Response (`listUsers`, pageSize 20): `items: [{ id, name,
email, role, status, statusReason, createdAt, lastLoginAt, profileCompleted, brandProfile: { companyName } | null,
manufacturerProfile: { id, businessName, verificationStatus } | null }]` (createdAt desc), `total, page, pages`.
Page: `/admin/users` (the client hides the status action for the admin's own row and for ADMIN rows).

##### `POST /api/admin/users/:id/status`
Body: `status` (`SUSPENDED`; anything else = `ACTIVE`), `reason` (`reasonSchema`). Success: SUSPENDED →
`"Account suspended and signed out."`; ACTIVE → `"Account reactivated."`. Errors: `CONFLICT` `"You cannot change the
status of your own account."`, `"The account is already <status lowercased>."`; `INVALID` `"User not found."`.
Side effects (`setUserStatus`): status/statusReason, sessions deleted on suspension, audit
`USER_SUSPENDED|USER_REACTIVATED`, notification `ACCOUNT_STATUS`. Page: `/admin/users`.

##### `GET /api/admin/orders`
Query: `q`, `status`, `delayed`, `page`. Runs `refreshDelays()`, then `listOrders(actor, {q, status, delayed, page,
pageSize: 20})` (same item shape as `GET /api/orders`). Page: `/admin/orders`.

##### `GET /api/admin/qc`
Response (`qcOverview`): `{ failed: [QCReport* + { order: { id, reference, project: { name } } }] (createdAt desc,
take 25), rejectedByBrand: [same] (decidedAt desc nulls first, take 25), openRework: [ReworkTask* + { order: { id,
reference, project: { name } } }] (createdAt asc), pendingDecisions: number }`. Page: `/admin/qc`.

##### `GET /api/admin/payments`
Query: `page`, `events` (`errors` → only events with `error != null && processedAt == null`). Response
(`paymentOverview`): `{ events: [WebhookEvent*] (createdAt desc, 25 per page), refundable: [PaymentMilestone* + {
order: { id, reference, project: { name }, brand: { name, brandProfile: { companyName } | null } }, transactions:
[PaymentTransaction*] (createdAt desc) }] (status PAID/PROCESSING/FAILED, updatedAt desc, take 50), page, pages,
total }`. Page: `/admin/payments`.

##### `GET /api/admin/audit`
Query: `q`, `targetType`, `page`. Response (`listAudit`, pageSize 30): `{ items: [AuditLog* + { actor: { name, email },
target: {name?, href?} | undefined }], total, page, pages, types: [distinct targetType strings] }`.
Page: `/admin/audit`.

##### `GET /api/admin/enquiries`
Query: `status` (InquiryStatus), `page`. Response (`listEnquiries`, pageSize 20): `{ items: [ContactInquiry*],
total, page, pages }` (createdAt desc). Page: `/admin/enquiries`.

##### `POST /api/admin/enquiries/:id/status`
Body: `status` (`NEW`|`IN_PROGRESS`|`RESOLVED`; validated with `z.object({ id: z.string(), status: z.enum([...]) })`
— take `id` from the path). Success: `"Enquiry updated."`. Errors: `NOT_FOUND` Enquiry. Side effect: audit
`ENQUIRY_STATUS_CHANGED` metadata `{from, to}`. Page: `/admin/enquiries`.

#### 16. Health

##### `GET /api/health` — public
`200 { status: "ok", database: "ok", latencyMs, time }` after a successful `db.admin().ping()`; otherwise
`503 { status: "error", database: "unreachable" }` (log the error). Never cached. Implemented by the server
foundation (`routes/health.js`).

#### 17. Overdue detection
No endpoint: `refreshDelays(now)` (port of `src/server/services/orders.ts`) runs at the start of
`GET /api/dashboard`, `GET /api/admin/overview`, `GET /api/orders`, `GET /api/admin/orders`. It flags each overdue
open milestone once (conditional update `isDelayed: false → true`, `delayReason: "Planned end date passed"`),
notifies brand + manufacturer and admins (`ORDER_DELAYED`, link `/admin/orders?delayed=1` for admins), and logs
`MILESTONE_DELAYED` with `actorId: null`. At most 200 per call.

#### 18–19. (reserved)

### 3.1 Upload validation messages

Shared by every upload (`server/src/lib/storage.js`, port of `src/server/storage.ts`): empty/no file →
`"Choose a file to upload."`; > 10 MB → `"Files must be 10 MB or smaller."`; MIME not allowed →
`"Upload PNG, JPEG or WebP images."` (imagesOnly) / `"Upload a PDF, PNG, JPEG or WebP file."`; signature mismatch →
`"The file content does not match its type. Upload a genuine PDF or image."`. All `INVALID`. Files go to
`<UPLOAD_DIR or ./uploads>/<folder>/<32 hex>.<pdf|png|jpg|webp>` written with flag `wx`; folders: `projects`,
`factory-docs`, `evidence`, `samples`, `qc`. Stored file name: `path.basename(name).replace(/[^\w.\- ()]/g, "_")
.slice(0, 150) || "file.<ext>"`. Key format `^[a-z0-9-]+\/[a-f0-9]{32}\.(pdf|png|jpg|webp)$`, else `"Invalid file
key."`. Multer: memory storage, `limits.fileSize = 10 MB` (its error maps to the 10 MB message), field names as
documented per endpoint. `UPLOAD_DIR` must stay outside `public/` and `client/`.

---

## 4. MongoDB collections

Connection: `MONGODB_URI` (default `mongodb://127.0.0.1:27017/fashinza?replicaSet=rs0`, single-node replica set so
transactions work). One Mongoose model per Prisma model, one collection each, **collection name = the Prisma
`@@map` name** (pass it explicitly as the third argument / `collection` option). Every schema:

- `_id: ObjectId` (exposed as `id`), `versionKey: false`, global `toJSON`/`toObject` transform per §1.8.
- Foreign keys: `ObjectId` with `ref`, same field names as Prisma (`brandId`, `projectId`, …).
- `Decimal` → `Schema.Types.Decimal128`; `Json` → `Schema.Types.Mixed`; `String[]` → `[String]` (default `[]`);
  enums → `{ type: String, enum: <values from @fashinza/shared/enums.js> }`.
- `createdAt` / `updatedAt` via `timestamps` exactly where Prisma has them (`timestamps: { createdAt: true, updatedAt:
  false }` when only `createdAt` exists; none when neither exists).
- Optional (`?`) fields default to `null`; Prisma defaults are reproduced.
- Cascades (`onDelete: Cascade` / `SetNull`) are implemented by the service that deletes (only `deleteDraft`
  deletes business records today; user deletion does not exist).

| Model (file `server/src/models/<Model>.js`) | collection | fields (type, default) | indexes |
|---|---|---|---|
| `User` | `user` | name String; email String (lowercase); emailVerified Boolean=false; image String?; role Role=BRAND; status UserStatus=ACTIVE; statusReason String?; profileCompleted Boolean=false; lastLoginAt Date?; timestamps | email unique; {role, status} |
| `Session` | `session` | expiresAt Date; token String (sha256 hex); ipAddress String?; userAgent String?; userId → User; timestamps | token unique; userId; TTL on expiresAt optional (`expireAfterSeconds: 0`) |
| `Account` | `account` | accountId String; providerId String; userId → User; accessToken, refreshToken, idToken String?; accessTokenExpiresAt, refreshTokenExpiresAt Date?; scope String?; password String?; timestamps | userId; {userId, providerId} |
| `Verification` | `verification` | identifier String; value String (sha256); expiresAt Date; timestamps | identifier; value |
| `BrandProfile` | `brand_profile` | userId → User; companyName String; description String?; country String; city, website, phone String?; timestamps | userId unique |
| `ManufacturerProfile` | `manufacturer_profile` | userId → User; businessName, description, country, city String; categories [GarmentCategory]; minOrderQuantity, maxMonthlyCapacity Number (int); typicalLeadTimeDays Number=45; contactName, contactEmail String; contactPhone, website String?; verificationStatus VerificationStatus=UNSUBMITTED; verificationNote String?; verificationRequestedAt, verifiedAt Date?; timestamps | userId unique; verificationStatus; country |
| `ManufacturerCapability` | `manufacturer_capability` | profileId → ManufacturerProfile; kind CapabilityKind; name String | {profileId, kind, name} unique; name |
| `ManufacturerMachine` | `manufacturer_machine` | profileId; type String; quantity Number; sortOrder Number=0 | {profileId, type} unique |
| `ManufacturerDocument` | `manufacturer_document` | profileId; type DocumentType; certificationName String?; fileKey, fileName, mimeType String; size Number; status DocumentStatus=PENDING; reviewNote String?; reviewedAt Date?; createdAt | fileKey unique; {profileId, status} |
| `Project` | `project` | brandId → User; name String; category GarmentCategory; description String?; quantity, maxMoq Number?; targetUnitPrice Decimal128? (12,2); currency String="USD"; deadline Date?; fabricRequirements String?; fabrics [String]; sizes [String]; colors String?; additionalInstructions String?; requiredCapabilities [String]; preferredCountry String?; requiredCertifications [String]; sustainabilityNotes String?; sampleRequired Boolean=true; sampleQuantity Number?=1; sampleSizes [String]; sampleNotes String?; status ProjectStatus=DRAFT; wizardStep Number=1; submittedAt Date?; timestamps | {brandId, status}; {status, category} |
| `ProjectAttachment` | `project_attachment` | projectId; uploadedById → User; kind AttachmentKind=OTHER; version Number?; notes String?; fileKey, fileName, mimeType String; size Number; createdAt | fileKey unique; {projectId, kind, version} unique **partial** (`partialFilterExpression: { version: { $type: "number" } }` — Postgres allows many NULL versions); projectId |
| `ProjectRevision` | `project_revision` | projectId; changedById → User; changes Mixed; createdAt | {projectId, createdAt} |
| `MatchResult` | `match_result` | projectId; manufacturerId → User; score Decimal128 (5,2); breakdown Mixed; reasons [String]; algorithm String; invitedAt Date?; createdAt | {projectId, manufacturerId} unique; {manufacturerId, createdAt} |
| `Quotation` | `quotation` | projectId; manufacturerId → User; quantity Number=0; unitPrice D128 (12,2); fabricCostPerUnit, finishingCostPerUnit, packagingCostPerUnit, logisticsCost D128=0 (12,2); taxPercent D128=0 (5,2); subtotal, taxAmount, totalAmount D128=0 (14,2); currency String; minQuantity, productionDays Number; samplingCost D128? (12,2); sampleLeadTimeDays Number?; sampleNotes, notes String?; validUntil Date; status QuotationStatus=DRAFT; revisionRequest String?; version Number=1; submittedAt, decidedAt Date?; timestamps | {projectId, manufacturerId} unique; {manufacturerId, status}; {projectId, status} |
| `QuotationRevision` | `quotation_revision` | quotationId; version Number; unitPrice D128; minQuantity, productionDays Number; samplingCost D128?; notes String?; validUntil Date; snapshot Mixed?; createdAt | {quotationId, version} unique |
| `Order` | `order` | reference String; projectId; quotationId; brandId → User; manufacturerId → User; quantity Number; unitPrice D128 (12,2); totalAmount D128=0 (14,2); currency String; agreedTerms Mixed?; status OrderStatus=IN_PRODUCTION; currentStage MilestoneStage=FABRIC_SOURCING; expectedCompletionDate Date; trackingInfo String?; shippedAt, deliveredAt Date?; timestamps | reference unique; **projectId unique**; **quotationId unique**; {brandId, status}; {manufacturerId, status}; {status, expectedCompletionDate} |
| `ProductionMilestone` | `production_milestone` | orderId; stage MilestoneStage; sequence Number; status MilestoneStatus=NOT_STARTED; responsibleParty ResponsibleParty=MANUFACTURER; evidenceRequired Boolean=false; plannedStart, plannedEnd, startedAt, completedAt Date?; responsibleUserId → User?; notes String?; isDelayed Boolean=false; delayReason String?; updatedAt only | {orderId, stage} unique; {orderId, sequence} unique; {status, plannedEnd} |
| `MilestoneEvidence` | `milestone_evidence` | milestoneId; uploadedById → User; fileKey, fileName, mimeType String; size Number; note String?; createdAt | fileKey unique; milestoneId |
| `Sample` | `sample` | orderId; round Number; description String; revisionNotes String?; status SampleStatus=SUBMITTED; feedback String?; submittedById → User; reviewedById → User?; reviewedAt Date?; createdAt | {orderId, round} unique |
| `SamplePhoto` | `sample_photo` | sampleId; fileKey, fileName, mimeType String; size Number | fileKey unique; sampleId |
| `QCReport` | `qc_report` | orderId; inspectorId → User; inspectionDate Date; batchSize Number=0; sampleSize Number; inspectionStandard String=""; aqlMajor, aqlMinor D128? (4,2); acceptMajor, acceptMinor Number?; criticalCount, majorCount, minorCount Number=0; defectiveCount Number; defectRate D128 (5,2); defectDescriptions, correctiveActions, notes String?; result QCResult; brandDecision QCDecision=PENDING; brandDecisionNote String?; decidedAt Date?; createdAt | {orderId, createdAt} |
| `QCDefect` | `qc_defect` | reportId; category String; severity DefectSeverity; count Number | reportId |
| `QCReportPhoto` | `qc_report_photo` | reportId; fileKey, fileName, mimeType String; size Number | fileKey unique; reportId |
| `ReworkTask` | `rework_task` | orderId; qcReportId; description String; status ReworkStatus=OPEN; resolvedAt Date?; createdAt | qcReportId unique; {orderId, status} |
| `PaymentMilestone` | `payment_milestone` | orderId; sequence Number; label String; percentage D128 (5,2); amount D128 (14,2); currency String; triggerStage MilestoneStage; status PaymentMilestoneStatus=SCHEDULED; dueAt, paidAt Date?; timestamps | {orderId, sequence} unique; status |
| `PaymentTransaction` | `payment_transaction` | paymentMilestoneId; provider String; providerRef String; type TransactionType; amount D128 (14,2); currency String; status TransactionStatus=PENDING; failureReason String?; initiatedById → User?; timestamps | providerRef unique; {paymentMilestoneId, createdAt} |
| `WebhookEvent` | `webhook_event` | provider, eventId, type String; payload Mixed; signatureValid Boolean; processedAt Date?; error String?; createdAt | **{provider, eventId} unique** |
| `Message` | `message` | orderId; milestoneId → ProductionMilestone?; authorId → User; body String; createdAt | {orderId, createdAt} |
| `ActivityLog` | `activity_log` | projectId?; orderId?; actorId → User?; type String; message String; metadata Mixed?; createdAt | {projectId, createdAt}; {orderId, createdAt} |
| `Notification` | `notification` | userId → User; type NotificationType; title, message String; link String?; readAt Date?; createdAt | {userId, readAt, createdAt} |
| `ContactInquiry` | `contact_inquiry` | name, email String; company String?; inquiryType, subject, message String; status InquiryStatus=NEW; createdAt | {status, createdAt} |
| `IssueReport` | `issue_report` | reporterId → User; projectId?; orderId?; category IssueCategory=OTHER; subject, description String; status IssueStatus=OPEN; adminNote, resolution String?; resolvedAt Date?; timestamps | {status, createdAt}; reporterId; orderId |
| `AuditLog` | `audit_log` | actorId → User; action, targetType, targetId String; reason String?; metadata Mixed?; createdAt | {targetType, targetId}; createdAt |

Enums (values and order) are exported from `@fashinza/shared/enums.js` (`Role`, `UserStatus`,
`VerificationStatus`, `GarmentCategory`, `CapabilityKind`, `DocumentType`, `DocumentStatus`, `ProjectStatus`,
`AttachmentKind`, `QuotationStatus`, `OrderStatus`, `MilestoneStage`, `MilestoneStatus`, `ResponsibleParty`,
`SampleStatus`, `QCResult`, `DefectSeverity`, `QCDecision`, `ReworkStatus`, `PaymentMilestoneStatus`,
`TransactionType`, `TransactionStatus`, `NotificationType`, `InquiryStatus`, `IssueStatus`, `IssueCategory`) and
`enumRank(values, value)`.

Money: write Decimal128 from decimal.js strings (`Decimal128.fromString(new Decimal(x).toFixed(scale))`); read
with `new Decimal(doc.amount.toString())`. Never `Number()` for arithmetic.

Transactions: every Prisma `$transaction` becomes `withTransaction(async (session) => …)` (§5) and every query
inside passes `{ session }`. `SELECT … FOR UPDATE` in `acceptQuotation` is replaced by the unique indexes above
plus MongoDB write conflicts (retry `TransientTransactionError` at most a few times inside `withTransaction`;
conflicts that persist surface as the original `conflict()` message). Conditional `updateMany` guards
(`status: "PENDING"` etc.) stay conditional (`updateOne` with the same filter; check `modifiedCount`).

---

## 5. Server internal modules (interfaces both server agents code against)

Owned by SERVER-A unless noted. SERVER-B must not edit SERVER-A files (and vice versa); ask via the report if an
interface is missing. All are ES modules.

```js
// server/src/config.js — loads ROOT .env (read-only) then server/.env (overrides), never prints secrets
export const config; // { port: 4000, mongodbUri, appUrl, uploadDir, isProduction, paymentProvider: "sandbox",
                     //   paymentSandboxSecret, adminEmail, adminPassword, seedDemo, seedDemoPassword, contactEmail }
// server/src/db.js
export async function connectDb(uri = config.mongodbUri);  export async function disconnectDb();
export async function withTransaction(fn /* async (session) => T */, opts?) /* : Promise<T> */;
// server/src/app.js
export function createApp(); // express app; mounts routes listed in §6.2; error middleware; static client in production
// server/src/lib/errors.js
export class AppError extends Error { constructor(message, code, fieldErrors) }
export const notFound = (what = "Record") => …; forbidden(message?); conflict(message); invalid(message, fieldErrors?);
export function isAppError(e);
// server/src/lib/form.js
export function readForm(req, arrayKeys = []);           // §1.2
export function parseForm(schema, data);                 // { ok: true, data } | { ok: false, error: AppError("Please correct the highlighted fields.", "INVALID", fieldErrors) }
export function uploadFields(spec);                      // multer memory middleware, e.g. uploadFields({ file: 1 }) / ({ photos: 20 })
export function filesOf(req, field);                     // non-empty uploaded files: [{ originalname, mimetype, size, buffer }]
export const ok = (res, body = {}) => res.json({ ok: true, ...body });
export const asyncHandler = (fn) => (req, res, next) => …;
// server/src/lib/storage.js (port of src/server/storage.ts; "file" = multer file object)
export function validateUpload(file, { imagesOnly } = {}); export async function saveUpload(file, folder, opts);
export async function readStoredFile(fileKey); export async function deleteStoredFile(fileKey);
// server/src/lib/events.js (port of src/server/events.ts) — `session` may be undefined outside a transaction
export function notify(session, userIdOrIds, type, title, message, link);
export async function notifyAdmins(session, type, title, message, link);
export function logActivity(session, { actorId, type, message, projectId, orderId, metadata });
export function audit(session, { actorId, action, targetType, targetId, reason, metadata });
// server/src/lib/access.js (port of src/server/access.ts; returns Mongo filters, async where a lookup is needed)
export function assertRole(actor, ...roles);
export async function projectFilter(actor, session?); export function orderFilter(actor);
export async function quotationFilter(actor, session?); export async function disputeFilter(actor, session?);
// server/src/lib/serialize.js — §1.8 helpers: toJSON plugin, money(d, scale), page(meta)
// server/src/lib/request.js — clientIp(req)
// server/src/auth/password.js — hashPassword, verifyPassword, burnPasswordCheck, newToken, sha256
// server/src/auth/session.js — SESSION_COOKIE, createSession(res, userId, meta), destroySession(req, res),
//                              getCurrentUser(req) (memoised on req), revokeAllSessions(userId, session?)
// server/src/middleware/auth.js — requireUser(roles?), requireOnboardedUser(roles?) (set req.actor), optionalUser
// server/src/middleware/origin.js — sameOriginOnly (§1.6)
// server/src/middleware/errors.js — notFoundApi, errorHandler (§1.4)
```

Cross-agent service functions (same names and argument order as the original services; actor first):

```js
// SERVER-A
services/projects.js:   listProjects(actor, f)                       // used by B's dashboard
services/opportunities.js: listOpportunities(actor, f)
services/quotations.js: expireQuotations(filter)                     // used by B's dashboard
services/accounts.js:   registerAccount(input)                       // used by B's seed and tests
services/profiles.js:   saveBrandProfile, saveManufacturerProfile, addManufacturerDocument, requestVerification, listMachinery(profileId)
// SERVER-B
services/orders.js:     createOrderFromQuotation(session, quotationId, actorId) /* returns the order doc */, listOrders(actor, f), refreshDelays(now?)
services/admin.js:      reviewDocument(actor, documentId, status, note), decideVerification(actor, profileId, decision, reason),
                        revokeVerification(actor, profileId, reason), setUserStatus(actor, userId, status, reason), resolveAuditTargets(items)
services/payments.js, services/quality.js, services/disputes.js, services/notifications.js, services/dashboard.js
payments/provider.js:   getPaymentProvider, sandboxProvider, signPayload, buildSandboxEvent, deliverSandboxEvent, WebhookSignatureError
```

---

## 6. Ownership

### 6.1 Endpoints (each owned by exactly one server agent)

| # | Endpoint | Owner |
|---|---|---|
| 1 | GET /api/auth/me | SERVER-A |
| 2 | POST /api/auth/register | SERVER-A |
| 3 | POST /api/auth/login | SERVER-A |
| 4 | POST /api/auth/logout | SERVER-A |
| 5 | POST /api/auth/forgot-password | SERVER-A |
| 6 | POST /api/auth/reset-password | SERVER-A |
| 7 | POST /api/auth/change-password | SERVER-A |
| 8 | GET /api/profile/brand | SERVER-A |
| 9 | PUT /api/profile/brand | SERVER-A |
| 10 | GET /api/profile/factory | SERVER-A |
| 11 | PUT /api/profile/factory | SERVER-A |
| 12 | POST /api/profile/factory/documents | SERVER-A |
| 13 | DELETE /api/profile/factory/documents/:documentId | SERVER-A |
| 14 | POST /api/profile/factory/verification-request | SERVER-A |
| 15 | GET /api/projects | SERVER-A |
| 16 | GET /api/projects/:id | SERVER-A |
| 17 | GET /api/projects/:id/detail | SERVER-A |
| 18 | POST /api/projects/save-step | SERVER-A |
| 19 | POST /api/projects/:id/submit | SERVER-A |
| 20 | POST /api/projects/:id/rerun-matching | SERVER-A |
| 21 | POST /api/projects/:id/cancel | SERVER-A |
| 22 | DELETE /api/projects/:id | SERVER-A |
| 23 | POST /api/projects/:id/attachments | SERVER-A |
| 24 | DELETE /api/projects/:id/attachments/:attachmentId | SERVER-A |
| 25 | GET /api/quotations | SERVER-A |
| 26 | POST /api/opportunities/:projectId/quotation | SERVER-A |
| 27 | POST /api/quotations/:id/withdraw | SERVER-A |
| 28 | POST /api/quotations/:id/request-revision | SERVER-A |
| 29 | POST /api/quotations/:id/reject | SERVER-A |
| 30 | POST /api/quotations/:id/accept | SERVER-A |
| 31 | GET /api/opportunities | SERVER-A |
| 32 | GET /api/opportunities/:projectId | SERVER-A |
| 33 | GET /api/files/*key | SERVER-A |
| 34 | POST /api/contact | SERVER-A |
| 35 | GET /api/search | SERVER-A |
| 36 | GET /api/orders | SERVER-B |
| 37 | GET /api/orders/:id | SERVER-B |
| 38 | POST /api/orders/:id/evidence | SERVER-B |
| 39 | POST /api/orders/:id/stages/complete | SERVER-B |
| 40 | POST /api/orders/:id/samples | SERVER-B |
| 41 | POST /api/orders/:id/samples/:sampleId/review | SERVER-B |
| 42 | POST /api/orders/:id/qc-reports | SERVER-B |
| 43 | POST /api/orders/:id/qc-reports/:reportId/decision | SERVER-B |
| 44 | POST /api/orders/:id/shipment | SERVER-B |
| 45 | POST /api/orders/:id/delivery | SERVER-B |
| 46 | POST /api/orders/:id/messages | SERVER-B |
| 47 | PUT /api/orders/:id/payment-schedule | SERVER-B |
| 48 | GET /api/payments | SERVER-B |
| 49 | POST /api/payments/milestones/:id/checkout | SERVER-B |
| 50 | GET /api/sandbox-checkout/:ref | SERVER-B |
| 51 | POST /api/sandbox-checkout/:ref | SERVER-B |
| 52 | POST /api/webhooks/payments/:provider | SERVER-B |
| 53 | POST /api/admin/payments/milestones/:id/refund | SERVER-B |
| 54 | POST /api/disputes | SERVER-B |
| 55 | GET /api/disputes | SERVER-B |
| 56 | GET /api/disputes/:id | SERVER-B |
| 57 | POST /api/admin/disputes/:id | SERVER-B |
| 58 | GET /api/notifications | SERVER-B |
| 59 | POST /api/notifications/read-all | SERVER-B |
| 60 | POST /api/notifications/:id/open | SERVER-B |
| 61 | GET /api/dashboard | SERVER-B |
| 62 | GET /api/admin/overview | SERVER-B |
| 63 | GET /api/admin/factories | SERVER-B |
| 64 | GET /api/admin/factories/:id | SERVER-B |
| 65 | POST /api/admin/documents/:documentId/review | SERVER-B |
| 66 | POST /api/admin/factories/:id/verification | SERVER-B |
| 67 | POST /api/admin/factories/:id/revoke | SERVER-B |
| 68 | GET /api/admin/users | SERVER-B |
| 69 | POST /api/admin/users/:id/status | SERVER-B |
| 70 | GET /api/admin/orders | SERVER-B |
| 71 | GET /api/admin/qc | SERVER-B |
| 72 | GET /api/admin/payments | SERVER-B |
| 73 | GET /api/admin/audit | SERVER-B |
| 74 | GET /api/admin/enquiries | SERVER-B |
| 75 | POST /api/admin/enquiries/:id/status | SERVER-B |
| 76 | GET /api/health | SERVER-B |

Totals: SERVER-A 35, SERVER-B 41, 76 endpoints. Overdue detection (§3.17) is SERVER-B.

Origin of each endpoint (today's code): auth → `src/app/(auth)/actions.ts`, `(app)/layout.tsx`; profile →
`src/app/(app)/profile-actions.ts`, `profile/`, `factory/`, `onboarding/` pages; projects →
`src/app/(app)/projects/actions.ts`, `api/projects/[id]/attachments/route.ts`, project pages; quotations &
opportunities → `src/app/(app)/opportunities/actions.ts`, quotation decisions in `projects/actions.ts`; files →
`api/files/[...key]/route.ts`; contact → `(public)/contact/actions.ts`; search → `(app)/search/page.tsx`; orders,
samples, QC, payments, disputes (raise) → `src/app/(app)/orders/actions.ts`; sandbox →
`src/app/sandbox-checkout/[ref]/*`; webhook → `api/webhooks/payments/[provider]/route.ts`; admin →
`src/app/(app)/admin/actions.ts` + admin pages; notifications → `(app)/notifications/page.tsx` (inline
`markAllRead` action) and `(app)/notifications/[id]/route.ts`; health → `api/health/route.ts`.

### 6.2 Server files

| Path | Owner |
|---|---|
| `server/package.json`, `server/vitest.config.js`, `server/src/index.js`, `server/src/app.js`, `server/src/config.js`, `server/src/db.js` | SERVER-A |
| `server/src/lib/{errors,form,storage,events,access,serialize,request}.js`, `server/src/auth/*`, `server/src/middleware/*` | SERVER-A |
| models `User, Session, Account, Verification, BrandProfile, ManufacturerProfile, ManufacturerCapability, ManufacturerMachine, ManufacturerDocument, Project, ProjectAttachment, ProjectRevision, MatchResult, Quotation, QuotationRevision, ContactInquiry, Notification, ActivityLog, AuditLog` | SERVER-A |
| models `Order, ProductionMilestone, MilestoneEvidence, Sample, SamplePhoto, QCReport, QCDefect, QCReportPhoto, ReworkTask, PaymentMilestone, PaymentTransaction, WebhookEvent, Message, IssueReport` | SERVER-B |
| `server/src/services/{accounts,profiles,projects,matching,quotations,opportunities,files,contact,search}.js` | SERVER-A |
| `server/src/services/{orders,quality,payments,disputes,notifications,dashboard,admin}.js`, `server/src/payments/provider.js` | SERVER-B |
| routes `server/src/routes/{auth,profile,projects,quotations,opportunities,files,contact,search}.js` | SERVER-A |
| routes `server/src/routes/{orders,payments,sandbox,webhooks,disputes,notifications,dashboard,admin,health}.js` | SERVER-B |
| `server/scripts/seed.js` (port of `prisma/seed.ts`) | SERVER-B (written by the integrator; `server/scripts/mern-dev.js` too) |
| `server/tests/support/*` (db guard, reset, fixtures port of `tests/support/fixtures.ts`) | SERVER-A |
| `server/tests/{unit,integration}/auth-access.*`, `projects-quotations.*` | SERVER-A |
| `server/tests/{unit,integration}/production-payments.*` and other B-domain tests | SERVER-B |

Each route file default-exports an Express `Router` whose paths are relative to the mount point. `app.js`
mounts exactly (in this order, after the webhook raw-body route and before the error handler):

```
/api/webhooks      → routes/webhooks.js   (raw body; mounted before express.json)
/api/health        → routes/health.js
/api/auth          → routes/auth.js
/api/profile       → routes/profile.js
/api/projects      → routes/projects.js
/api/quotations    → routes/quotations.js
/api/opportunities → routes/opportunities.js
/api/files         → routes/files.js
/api/contact       → routes/contact.js
/api/search        → routes/search.js
/api/orders        → routes/orders.js
/api/payments      → routes/payments.js
/api/sandbox-checkout → routes/sandbox.js
/api/disputes      → routes/disputes.js
/api/notifications → routes/notifications.js
/api/dashboard     → routes/dashboard.js
/api/admin         → routes/admin.js       (includes /api/admin/payments/milestones/:id/refund and /api/admin/disputes/:id)
```

### 6.3 Client pages

| Page / area | Owner |
|---|---|
| All `src/app/(public)` pages: `/`, `/about`, `/contact`, `/faq`, `/for-brands`, `/for-manufacturers`, `/how-it-works`, `/privacy`, `/sustainability`, `/terms` (+ public layout, site header/footer) | CLIENT-A |
| Auth pages: `/login`, `/register`, `/forgot-password`, `/reset-password` (+ auth layout) | CLIENT-A |
| `/onboarding` | CLIENT-A |
| Projects: `/projects`, `/projects/new`, `/projects/:id/edit` (wizard), `/projects/:id` (incl. matches and quotation compare) | CLIENT-A |
| `/profile` (brand), `/factory` (factory profile and documents) | CLIENT-A |
| `/dashboard` | CLIENT-B |
| `/opportunities`, `/opportunities/:id` | CLIENT-B |
| `/quotations` | CLIENT-B |
| `/orders`, `/orders/:id` (all tabs) | CLIENT-B |
| `/payments`, `/sandbox-checkout/:ref` | CLIENT-B |
| `/disputes`, `/disputes/:id` | CLIENT-B |
| `/notifications`, `/notifications/:id` | CLIENT-B |
| `/settings` | CLIENT-B |
| `/search` | CLIENT-B |
| `/admin`, `/admin/factories`, `/admin/factories/:id`, `/admin/users`, `/admin/orders`, `/admin/qc`, `/admin/disputes`, `/admin/payments`, `/admin/audit`, `/admin/enquiries` | CLIENT-B |
| not-found (root and app), denied notice, error boundaries (root and app), app loading state | CLIENT-B |

Shared client infrastructure (the app shell, `ui/*`, `forms/*`, theme, router setup, API helper, `client/src/styles/globals.css`)
is not in the page table; it must be owned by one client agent — CLIENT-A unless the orchestrator says otherwise —
and the other imports it.

---

## 7. Tests

- Server: Vitest + supertest. `server/vitest.config.js` (unit: `tests/unit/**/*.test.js`) and an integration config
  (`tests/integration/**/*.test.js`, `fileParallelism: false`, generous timeouts, env `UPLOAD_DIR=<tmp>/fashinza-test-uploads`,
  `PAYMENT_PROVIDER=sandbox`, `PAYMENT_SANDBOX_SECRET` test value). The integration setup refuses to run unless the
  database name in `TEST_MONGODB_URI` (default `mongodb://127.0.0.1:27017/fashinza_test?replicaSet=rs0`) contains
  `test` (and differs from the app's `MONGODB_URI`); it empties all collections between tests (keeping them and their
indexes, so unique rules stay in force) and calls `syncIndexes()` once. E2E uses `fashinza_e2e`.
- Port every case of `tests/integration/*.test.ts` (same names) against the services (same function signatures),
  plus supertest checks of the HTTP layer (status codes, error shape, cookie flags, Origin check, file headers).
- Test file helpers: `pdfFile(name)` / `pngFile(name)` return multer-like objects `{ originalname, mimetype, size,
  buffer }` with the same bytes as `tests/support/fixtures.ts`.
- Shared modules: `cd shared && npx vitest run` (ports of `tests/unit/*`).
