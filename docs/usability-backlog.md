# Usability review findings

## admin-1 [high] [CONFIRMED] "Approve factory" stays clickable when approval is certain to fail
- Screens: admin-factory-detail
- Files: src/app/(app)/admin/factories/[id]/page.tsx, src/components/admin/admin-forms.tsx
- Problem: The page's one accent action (the primary action) is offered even though it cannot succeed. The real next step is to verify the registration document further down the page, but the loudest button points somewhere else.
- Fix: Add a `canApprove: boolean` prop to VerificationDecision and pass `canApprove={regVerified}` from the page. When it is false, render the Approve button disabled (variant accent, disabled). Under the buttons, add a short helper line ('Verify the business registration first') with an anchor link to #documents. The Reject dialog stays unchanged.
- Verifier refinement: 1. admin-forms.tsx: add `canApprove = true` and `blockedReasonId?: string` props to VerificationDecision. When !canApprove, render the trigger as a plain `<Button variant="accent" disabled aria-describedby={blockedReasonId}>` and do not wrap it in ActionDialog, so the dialog can never open. Leave the Reject dialog exactly as it is.

2. page.tsx: pass `canApprove={regVerified} blockedReasonId="approve-blocked"`. Don't add a new helper line under the header buttons. Instead, upgrade the existing warning Alert: give it id="approve-blocked" and make its text an actionable link to #documents.
   - If `hasReg` is true: "Approve is unavailable until the business registration is verified. <a href="#documents">Review it in Documents</a>."
   - If `hasReg` is false: "This factory has not uploaded a business registration, so it can't be approved yet. Reject with a reason to ask for it."
   Use only semantic tokens and the existing Alert and link styles.

3. Keep the server-side check in profiles.ts unchanged.

4. Update tests/e2e/admin-access.spec.ts lines 44-51. Replace the click, fill and error assertion with `await expect(page.getByRole("button", { name: "Approve factory" })).toBeDisabled();`. Optionally also assert the Alert text. The rest of the test (verify the document, then approve) stays as it is, and the button is enabled again after the router refresh.

5. Check that the "Verify document" action revalidates the page (revalidatePath or router.refresh), so the button enables without a manual reload. | 1. Give VerificationDecision a `canApprove: boolean` prop, and pass `canApprove={regVerified}` from the factory page.
2. When `canApprove` is false, do not wrap the Approve button in ActionDialog. Render a plain `<Button variant="accent" disabled aria-describedby="approve-blocked">` instead. A disabled child inside DialogTrigger asChild is fragile.
3. Under the button row, add `<p id="approve-blocked" className="text-xs text-ink-muted">Verify the business registration first. <a href="#documents" className="underline">Go to documents</a></p>`, using semantic tokens only.
4. When there is no BUSINESS_REGISTRATION document at all, change the helper text to "No business registration uploaded". Approval can't happen until the factory uploads one, so Reject is the realistic action.
5. Leave the Reject dialog unchanged.
6. Optionally drop the duplicate page-level warning Alert, or keep it. The helper line already explains the block at the point of action.

## admin-2 [high] [CONFIRMED] Audit entries never say which factory, user or order was affected
- Screens: admin-audit, admin-overview, admin-overview-mobile, admin-factory-detail
- Files: src/components/admin/audit-parts.tsx, src/app/(app)/admin/audit/page.tsx
- Problem: The log reports what happened but not to whom. Ids are unreadable and lead nowhere, and the duplicate code line and repeated actor details make every row twice as tall.
- Fix: In audit-parts.tsx add `targetHref(type, id)`: ManufacturerProfile → /admin/factories/{id}, IssueReport → /admin/disputes, PaymentMilestone → /admin/payments. Also add `targetName(metadata)`, which returns metadata.fileName or metadata.certification for documents and metadata.amount+currency for refunds. In auditTimelineItem, link the target type when an href exists and append the name. In audit/page.tsx, make the Target cell that link plus the name, and move the raw id and the raw action code into the existing 'Show details' disclosure, or a title attribute, instead of always-visible mono lines. Do the same in the mobile card meta.
- Verifier refinement: Resolve target names on the server instead of relying on metadata. In src/server/services/admin.ts, add `resolveAuditTargets(items)`:
- Group targetIds by targetType and run one batched findMany per type.
- User: name and email.
- ManufacturerProfile: companyName.
- ManufacturerDocument: fileName/certificationName plus its manufacturerProfileId.
- IssueReport: the order's number/id.
- PaymentMilestone: the milestone label and order number.
- ContactInquiry: name/email.
- Return a map from id to { name, href }. Fall back to metadata.fileName/certification and amount+currency when the row no longer exists.

Use it in both listAudit and the overview's recentAudit query.

hrefs:
- ManufacturerProfile: /admin/factories/{id}
- ManufacturerDocument: /admin/factories/{manufacturerProfileId}, the parent factory and not the document id
- User: /admin/users?q={email}, because no detail route exists
- IssueReport: /admin/disputes
- PaymentMilestone: /admin/payments
- ContactInquiry: /admin/enquiries

In audit-parts.tsx, extend auditTimelineItem to accept an optional `target?: { name?: string; href?: string }`. Render `action · <Link href>{targetLabel}: {name}</Link>` when an href exists, otherwise plain text. On admin/factories/[id], skip the name for entries about the factory being viewed, since it is redundant there.

In audit/page.tsx:
- Target cell: the link plus the name. Move the raw targetId into the "Show details" disclosure, or a title attribute on the link, so search by record id keeps working.
- Action cell: drop the always-visible mono action code (keep it in title= or in details).
- Actor cell: drop the repeated email line (keep it in title=).
- Mobile card meta: replace `targetLabel · targetId` (break-all) with the same linked label and name.

Use semantic tokens only (text-accent-strong for links, as the existing summary already does). | 1) Look up target names on the server, read-only. Add a helper resolveAuditTargets(items) in src/server/services/admin.ts. It groups targetIds by targetType and runs one batched findMany per type:
- User → name and email
- ManufacturerProfile → company name
- ManufacturerDocument → fileName and manufacturerId
- IssueReport → title
- PaymentMilestone → label and orderId
- ContactInquiry → name or subject

It returns {name, href} for each id. Call it in listAudit, in adminDashboard's recentAudit (dashboard.ts) and in getFactory's history, and attach the result as item.target. No writes and no schema change. Fall back to metadata.fileName/certification and amount+currency when a row is missing. Fall back to the type label when nothing resolves (for example, deleted records).

2) Links. Put a pure targetHref(type, id, extra) in audit-parts.tsx:
- ManufacturerProfile → /admin/factories/{id}
- ManufacturerDocument → /admin/factories/{manufacturerId}
- IssueReport → /disputes/{id}
- User → /admin/users?q={email}
- PaymentMilestone → /admin/orders/{orderId} if that page exists, otherwise /admin/payments
- ContactInquiry → /admin/enquiries

Use next/link with the existing text-link styling. In auditTimelineItem, render "Action · <Link>Target name</Link>", or the type label if there is no name. Accept the target as an optional field so the factory-detail timeline compiles. There, leave out the link when it points at the current factory.

3) Audit table (desktop):
- Target cell: the linked name on the first line, then the type label in text-ink-muted. Move the raw targetId into the "Show details" disclosure, merged with the metadata JSON, and keep it in a title attribute.
- Actor cell: drop the always-visible email and put it in a title attribute.
- Action code: keep the raw code visible as a small muted line. That keeps tests/e2e/workflow.spec.ts:283 green and keeps searching by code easy. If you remove it, update that test in the same change to expect "Dispute updated" and keep the code in a title.

4) Mobile card: replace the break-all mono line with "Type · linked name". Put the id inside the same disclosure, which also keeps the no-horizontal-overflow check in mobile.spec.ts passing.

5) Run the admin and workflow e2e specs afterwards.

## admin-3 [medium] [CONFIRMED] Factory list shows a suspended factory as plain "Verified"
- Screens: admin-factories, admin-users, admin-factory-detail
- Files: src/app/(app)/admin/factories/page.tsx
- Problem: The status column gives a misleading picture: the factory looks active and matchable when its account cannot sign in.
- Fix: In factories/page.tsx, when `f.user.status !== "ACTIVE"`, also render `<StatusBadge map={USER_STATUS} value={f.user.status} />` next to the verification badge. Do this in the Status <td> (wrap both in a flex-wrap gap-1.5 span) and in the MobileCard `badge`. No new data is needed.
- Verifier refinement: In src/app/(app)/admin/factories/page.tsx, import USER_STATUS alongside VERIFICATION_STATUS from "@/lib/labels". Then add a small local helper, `const statusBadges = (f) => (<span className="inline-flex flex-wrap items-center gap-1.5"><StatusBadge map={VERIFICATION_STATUS} value={f.verificationStatus} />{f.user.status !== "ACTIVE" && <StatusBadge map={USER_STATUS} value={f.user.status} />}</span>)`. Use it in both the table Status <td> and the MobileCard `badge` prop, so the two layouts can't drift apart. This is the same condition and badge that admin/factories/[id]/page.tsx:69 already uses. No change to the service or the data is needed. | In src/app/(app)/admin/factories/page.tsx, import USER_STATUS from "@/lib/labels" alongside VERIFICATION_STATUS. Add a tiny local helper so the table and the card stay in sync:
const statusBadges = (f) => (<span className="inline-flex flex-wrap items-center gap-1.5"><StatusBadge map={VERIFICATION_STATUS} value={f.verificationStatus} />{f.user.status !== "ACTIVE" && <StatusBadge map={USER_STATUS} value={f.user.status} />}</span>);
Use it in both places: `badge={statusBadges(f)}` on the MobileCard, and `<td>{statusBadges(f)}</td>` for the Status cell. Order and condition match the detail page at admin/factories/[id]/page.tsx:69, which checks `!== "ACTIVE"` and puts the verification badge first. Leave the verification badge, the column headers and the data fetch unchanged.

## admin-4 [medium] [CONFIRMED] Factory detail shows "Suspended" without the reason or the date
- Screens: admin-factory-detail
- Files: src/app/(app)/admin/factories/[id]/page.tsx, src/server/services/admin.ts
- Problem: The page that decides whether to reactivate a factory hides why it was suspended. The blue 'Last decision note' banner even suggests the latest decision was a positive one.
- Fix: Read-only query addition in getFactory: add `statusReason: true` to the user select, and add `{ targetId: p.user.id }` to the history OR. In the page, when `p.user.status === "SUSPENDED"`, render `<Alert tone="danger" className="mb-6">Account suspended: {p.user.statusReason}</Alert>` above the verification note, and relabel the info alert to 'Last verification note: …'.
- Verifier refinement: In getFactory, add `statusReason: true` to the user select. Change the history OR to `[{ targetId: id }, { targetId: p.user.id }, { targetId: { in: p.documents.map((d) => d.id) } }]` so suspend and reactivate entries show up with their dates. Also confirm that auditTimelineItem has readable labels for USER_SUSPENDED and USER_REACTIVATED.

In the page, before the verification alerts, add:
`{p.user.status === "SUSPENDED" && (<Alert tone="danger" className="mb-6">Account suspended{p.user.statusReason ? `: ${p.user.statusReason}` : "."} Check the reason before reactivating.</Alert>)}`
statusReason is nullable, so the alert needs this fallback.

To show the suspension date, look up the newest USER_SUSPENDED entry in history and pass its createdAt to formatDateTime.

Rename the info alert to "Last verification note: …". Keep every colour as a semantic token; no hex or palette colours. | 1) src/server/services/admin.ts, getFactory:
- Change the user select to `{ id: true, email: true, name: true, status: true, statusReason: true, createdAt: true }`.
- Change the history where clause to `OR: [{ targetId: id }, { targetId: p.user.id }, { targetId: { in: p.documents.map((d) => d.id) } }]`.

2) src/app/(app)/admin/factories/[id]/page.tsx:
- Compute `const suspension = p.user.status === "SUSPENDED" ? history.find((h) => h.action === "USER_SUSPENDED") : undefined;`. History is already sorted by date, newest first, so this is the latest suspension.
- Above the verification alerts, render:
  `{p.user.status === "SUSPENDED" && (<Alert tone="warning" title="Account suspended" className="mb-6">{p.user.statusReason ?? suspension?.reason ?? "No reason was recorded."}{suspension && <> · {suspension.actor.name}, {formatDateTime(suspension.createdAt)}</>}</Alert>)}`
- Use tone="warning". There is no "danger" tone. "error" would set role="alert" and be announced on every page load for a stored state.
- Relabel the info alert to `Last verification note: {p.verificationNote}`.

Use only the existing Alert component and formatDateTime: no new colours, no new action buttons. The Reactivate button stays where it is.

## admin-5 [medium] [CONFIRMED] "Needs attention" fills the overview with five "Clear" rows
- Screens: admin-overview, admin-overview-mobile
- Files: src/app/(app)/admin/page.tsx
- Problem: The useful signal ('nothing to do', or which queue has work) is buried under content that says nothing, and the right column repeats numbers already in the metric strip.
- Fix: In admin/page.tsx render QueueRow only for queues with count > 0. Below them, or alone when waiting === 0, add one compact line listing the clear queues as small muted links ('Clear: Delayed orders · Open disputes · …'). Drop the Brands/Factories rows from the Accounts panel, since the metric hint already shows them, and keep Administrators and Suspended accounts.
- Verifier refinement: In admin/page.tsx, split `queues` into `open = queues.filter(q => q.count > 0)` and `clear = queues.filter(q => q.count === 0)`. Render the `<ul>` of QueueRow only when `open.length > 0`, and drop the sort since every rendered row is open. Below it, or alone when nothing is open, add one compact line inside the panel body, for example `<p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-xs text-ink-muted sm:px-5"><CheckCircle2 className="size-3.5 text-success" aria-hidden /> Clear: {clear.map((q,i) => <Link key={q.key} href={q.href} className="hover:text-ink hover:underline underline-offset-4">{shortLabel}</Link>)} separated by ' · '</p>`. Give each queue a short label (Factory verification, Delayed orders, Open disputes, Failed inspections, Webhook errors) so the line wraps cleanly at 390px. Keep the panel description as it is ("Every queue is clear." or "N of 5 queues have work waiting."). In the Accounts panel, remove the Brands and Factories rows and keep Administrators and Suspended accounts, since the Users metric hint already shows the brand/factory split. Optionally, have Breakdown skip the bar when there is only one row and show just the label and count, though with a single seeded order that is a data artefact rather than a defect. Use semantic tokens only. | In src/app/(app)/admin/page.tsx:
1. Split the list: `const open = queues.filter(q => q.count > 0); const clear = queues.filter(q => q.count === 0);`. Render the `<ul className="divide-y divide-line-subtle">` of QueueRow only when `open.length > 0`. Simplify QueueRow to the open state and drop the `!open` branch and the CheckCircle2 "Clear" span.
2. Below the list, or alone when `open.length === 0`, render one compact footer when `clear.length > 0`: `<div className={cn("flex flex-wrap items-center gap-x-1 gap-y-1 px-4 py-3 text-xs text-ink-muted sm:px-5", open.length && "border-t border-line-subtle")}><CheckCircle2 className="size-3.5 text-success" aria-hidden /><span className="font-medium">{open.length ? "Clear:" : "All clear:"}</span>{clear.map((q, i) => <Fragment key={q.key}>{i > 0 && <span aria-hidden>·</span>}<Link href={q.href} className="inline-flex min-h-8 items-center rounded-sm hover:text-ink hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">{q.label}</Link></Fragment>)}</div>`. Use semantic tokens only, as in the existing classes. The min-h-8 keeps the links tappable on a phone.
3. Leave the Panel description as it is ("N of 5 queues have work waiting." / "Every queue is clear."). With the bodyClassName="p-0" body, the all-clear state is now a single line instead of five rows.
4. In the Accounts panel, drop the Brands and Factories items. Keep Administrators and Suspended accounts (with its danger-tone link) and the "Manage users" action.
5. Leave the Breakdown panels and the metric strip unchanged. That keeps the scope tight, with no server or service changes and no e2e selectors affected.

## admin-6 [medium] [CONFIRMED] Filter "Clear" button appears with nothing to clear and jumps to another tab
- Screens: admin-factories, admin-orders
- Files: src/components/app/filter-bar.tsx
- Problem: The button claims a filter is applied when none is visible, and clicking it silently switches the tab instead of clearing a search.
- Fix: In filter-bar.tsx compute `active` from `q` and `selects` only, not `hidden`. Build the Clear href from basePath plus the non-empty hidden params, so clearing a search keeps the current tab or delayed toggle.
- Verifier refinement: In filter-bar.tsx: `const active = !!q || selects.some((s) => s.value);` and `const keep = new URLSearchParams(Object.entries(hidden).filter(([, v]) => !!v) as [string, string][]); const clearHref = keep.size ? `${basePath}?${keep}` : basePath;` then use `<Link href={clearHref}>`. Clear then removes only the search text and select filters. It keeps the current tab (for example status=ALL or VERIFIED on factories) and the delayed toggle on admin orders. It no longer appears when only hidden params are set. No page changes are needed. Check that the users and audit pages still behave correctly with their own `hidden` params. | In filter-bar.tsx:
1. Base `active` on what the user can see: `const active = !!q || selects.some((s) => s.value);`
2. Build the Clear link so it keeps the hidden params (the current tab or toggle) and drops only `q` and the select values: `const keep = new URLSearchParams(Object.entries(hidden).filter((e): e is [string, string] => !!e[1])); const clearHref = keep.size ? `${basePath}?${keep}` : basePath;`, then use `<Link href={clearHref}>`. Never carry `page` over, so the user starts again on page 1.
3. Optionally make the label more specific when only the search is set ("Clear search").

Leave the page files as they are. /admin/factories still passes `status=ALL` as hidden, so Clear keeps the "All factories" tab. /admin/orders and /orders keep `delayed` / `attention`, and the header's "Clear delayed filter" link still removes them. This one change also fixes /opportunities and /orders.

Check by hand at /admin/factories?status=ALL (no Clear button shown), /admin/factories?status=ALL&q=x then Clear (should land on ?status=ALL), and /admin/orders?delayed=1 (no Clear until you search or pick a status).

## admin-7 [medium] [CONFIRMED] Factory status tabs: default tab not first, no counts, and they overflow on phones
- Screens: admin-factories
- Files: src/app/(app)/admin/factories/page.tsx, src/components/orders/order-parts.tsx
- Problem: The verification queue's structure is hard to read: the default view isn't the first tab, the admin can't see how much work each status holds, and on phones some statuses can't be seen at all.
- Fix: In factories/page.tsx move the 'All factories' tab to the end: put PENDING first, followed by the other statuses, then All. In StatusTabs change `<ul className="flex min-w-max gap-6">` to `flex flex-wrap gap-x-6`, and drop overflow-x-auto from the nav, so the tabs wrap onto a second line on narrow screens instead of scrolling sideways.
- Verifier refinement: 1. Tab order: the page can't reorder the tabs on its own, because StatusTabs always puts the "All" tab first. Add a prop to StatusTabs, such as `allPosition?: "start" | "end"` (default "start"), and build `tabs = allPosition === "end" ? [...options, all] : [all, ...options]`. Pass `allPosition="end"` from admin/factories/page.tsx. The other users keep their current order.

2. Counts: add `countFactoriesByStatus()` in src/server/services/admin.ts. It should run `db.manufacturerProfile.groupBy({ by: ["verificationStatus"], where: { user: { profileCompleted: true } }, _count: true })`, using the same profileCompleted filter as `listFactories`. Add an optional `count?: number` to StatusTabs options. Render it as a small `tabular text-ink-subtle` number after the label, and on the PENDING tab use a warning-tone pill when the count is above zero. Use semantic tokens only.

3. Narrow screens: replace `overflow-x-auto` + `min-w-max` with `<ul className="flex flex-wrap gap-x-6 gap-y-1">` and keep `border-b border-line` on the nav. The `-mb-px` underline only lines up with the nav border on the last row. So on wrapped rows, give each link its own bottom border, or show a `<select>` below `sm:` and keep the underline tabs from `sm:` up. This also fixes the same overflow on the enquiries, disputes and payments pages. | 1) StatusTabs (src/components/orders/order-parts.tsx):
- Add an optional prop `allPosition?: "start" | "end"`, defaulting to "start" so /payments, /admin/disputes and /admin/enquiries stay the same. Build `tabs` as `allPosition === "end" ? [...options, all] : [all, ...options]`.
- Add an optional `count?: number` to each option. When it is defined, render it after the label using the same chip PageTabs uses: `tabular rounded-sm px-1.5 text-2xs font-semibold`, with `bg-accent-soft text-accent-strong` on the active tab and `bg-surface-muted text-ink-muted` otherwise. Add `gap-2` to the link.
- Keep the horizontal scroll; do not use flex-wrap. Change the nav to `-mx-4 mb-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0`, the PageTabs edge-bleed, so the clipped last label at the screen edge shows the row scrolls. Keep `flex min-w-max gap-6` on the ul. Optionally raise the link height to min-h-11 for touch.

2) src/server/services/admin.ts: add a read-only `countFactoriesByStatus(actor, { q })`. It asserts ADMIN and runs `db.manufacturerProfile.groupBy({ by: ["verificationStatus"], where: { user: { profileCompleted: true }, ...(q ? { businessName: { contains: q, mode: "insensitive" } } : {}) }, _count: true })`. Fetch it in factories/page.tsx with Promise.all alongside listFactories.

3) src/app/(app)/admin/factories/page.tsx:
- Pass `allPosition="end"`.
- Give each option `count: counts[v] ?? 0`. Show the count on PENDING even when it is 0, so the admin can see the queue is empty.
- Optionally shorten "All factories" to "All" now that it is last.
- Leave the default status (PENDING), the URLs and the FilterBar's hidden status unchanged, so links and e2e paths (/admin/factories, ?status=ALL) still work.

## admin-8 [medium] [CONFIRMED] Payments page puts the raw webhook log first and refunds in a side column
- Screens: admin-payments
- Files: src/app/(app)/admin/payments/page.tsx
- Problem: The order is backwards: technical delivery logs come before money the admin may need to act on, and the milestone rows lack a human-readable name.
- Fix: In payments/page.tsx render the milestones Panel first, in the wide 1.6fr column, and the webhook Panel second, in the 1fr column. In the webhook panel description, say that errors are counted per page and that unprocessed events are highlighted in red. Optionally show the panel's error count in its title, e.g. 'Webhook events (n errors)'.
- Verifier refinement: In payments/page.tsx, swap the two grid children. Put the milestones Panel first, in the 1.6fr column, and wrap the webhook Panel and its Pagination in the second (1fr) column's div. Retitle the page "Payments" with a description that leads with milestones and refunds, so it still matches the nav label "Payment events", or rename both together. In the milestone rows, add a human-readable name. To do that, extend the order select in paymentOverview (src/server/services/admin.ts) to include the project title and brand organisation name, then render "Project title · Sample approval" as the link and the reference plus brand in muted text below it. For the webhook panel, set the title to `Webhook events (${d.total})` with "· n errors on this page" when errors > 0. Set the description to "Newest first. Error counts cover this page only; events that could not be applied are highlighted in red." Optionally, add a `?status=error` filter to paymentOverview's webhook query: `where: { error: { not: null }, processedAt: null }`. Then point the overview's "Unprocessed webhook errors" queue link at /admin/payments?status=error so the count it shows matches what the admin lands on. | In src/app/(app)/admin/payments/page.tsx keep the grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] and swap its two children:
(1) First child, the wide column: the "Recent payment milestones" Panel, unchanged. It keeps its RefundButton condition and its link to /orders/{id}?tab=payments.
(2) Second child: a div.space-y-4 holding the webhook Panel followed by its Pagination (basePath "/admin/payments"). Pagination pages the events, so it stays directly under that panel.
Keep the title `Webhook events (${d.total})` as it is, without an error count. Change the description to: when errors > 0, "{n} event(s) on this page could not be applied (highlighted in red). Errors are counted per page."; otherwise "Newest first. Each event is applied once. Events that could not be applied are highlighted in red."
Optionally, for a readable milestone name, change the order select in paymentOverview (src/server/services/admin.ts) to `{ id: true, reference: true, project: { select: { title: true } } }`, after checking the Project field name in prisma/schema.prisma. Then render the project title as the link's main text and "{reference} · {label}" as a muted line underneath. This only adds a field to a read query and does not change server behaviour.
Do not rename the page or move any tests. Rerun the admin step of tests/e2e/workflow.spec.ts and check light and dark at the xl width and at 390px: the 3-column webhook table in the narrower 1fr column wraps event ids with break-all, and that should still read cleanly.

## admin-9 [low] [CONFIRMED] Quality issues page disagrees with the overview and shows an unclickable metric
- Screens: admin-qc, admin-overview
- Files: src/app/(app)/admin/qc/page.tsx, src/app/(app)/admin/page.tsx
- Problem: Numbers labelled the same way don't match, one metric can't be acted on, and the same fact is printed twice.
- Fix: In page.tsx change the queue link to /admin/qc#failed. In qc/page.tsx set the Failed inspections panel description to 'Latest 25 of all time, newest first. The overview counts the last 30 days.' Remove the pendingDecisions sentence from the PageHeader description, since the metric already shows it, and change the hint 'Over the AQL accept limits' to 'More defects than the sampling limit allows'.
- Verifier refinement: In src/app/(app)/admin/page.tsx line 90, change href to "/admin/qc#failed" and the description to "Inspections with more defects than the sampling limit allows."

In src/app/(app)/admin/qc/page.tsx:
(a) Set the PageHeader description to "Failed inspections, brand-rejected reports and open rework." and drop the pendingDecisions sentence.
(b) Change the Failed inspections hint to "More defects than the sampling limit allows".
(c) Set the Failed inspections Panel description to `Latest ${CAP} of all time, newest first. The overview counts only the last 30 days.`
(d) Give the "Awaiting brand decision" metric a destination. The cheapest option is to keep it without an href but change its hint to "Passed reports the brand hasn't accepted yet. Brands decide on the order's Samples & QC tab." A better option is a small list: add a `pendingList` query to qcOverview (`result: "PASS", brandDecision: "PENDING"`, take 25, same order include), render it in a Panel with id="pending", and set `href="#pending"` on the metric.

Do not filter the failed list to 30 days. Admins still need to see older failures, so labelling the difference is the right fix. | 1) src/app/(app)/admin/page.tsx line 90: change href to "/admin/qc#failed". Change that row's description from "Inspections that exceeded the AQL limits." to "Inspections with more defects than the sampling limit allows." Keep the label and count as they are.
2) src/app/(app)/admin/qc/page.tsx:
   a) PageHeader description: "Failed inspections, brand-rejected reports and open rework." (remove the pendingDecisions sentence).
   b) Failed inspections metric hint: "More defects than the sampling limit allows".
   c) Awaiting brand decision metric: keep it without an href, and change its hint to "Passed reports with the brand. No admin action needed", so the reason it can't be clicked is clear. Do not add a fake link.
   d) Failed inspections Panel description: `Latest ${CAP} of all time, newest first. The overview counts the last 30 days.` Keep the CAP constant in this text rather than hard-coding 25.
Leave qcOverview and all server code unchanged. Only copy and the href change, so no e2e test is affected.

## admin-10 [low] [CONFIRMED] Users table: organisation not linked to its factory record, inconsistent role wording
- Screens: admin-users
- Files: src/app/(app)/admin/users/page.tsx
- Problem: Users and factories are separate silos, and the same role has two names.
- Fix: In users/page.tsx wrap the manufacturer org name (table cell and mobile card meta) in a Link to `/admin/factories?status=ALL&q=${encodeURIComponent(org)}`. Display the role as 'Factory' for MANUFACTURER on this page with a local map, e.g. `{...ROLE_LABEL, MANUFACTURER: "Factory"}`.
- Verifier refinement: Link straight to the factory's own page rather than a search. A name search can match several factories, and the ?q= value would be the org name in a URL. In src/server/services/admin.ts listUsers, add id to the manufacturerProfile select: `manufacturerProfile: { select: { id: true, businessName: true, verificationStatus: true } }`. In users/page.tsx, render the org name as `<Link href={`/admin/factories/${u.manufacturerProfile.id}`} className="font-medium text-ink underline-offset-4 hover:underline">{org}</Link>` in the table cell. Do the same in the MobileCard meta when u.manufacturerProfile exists. Add a local map `const ROLE = { ...ROLE_LABEL, MANUFACTURER: "Factory" }` and use it in both the Role column and the mobile meta. Also use it for the Role filter options, so the dropdown says "Factory" too. Keep option values as the enum keys, so `sp.role in ROLE_LABEL` validation is unchanged. Optionally relabel the header button "Review pending factories" to match /admin/factories, which defaults to PENDING. | 1. In src/server/services/admin.ts (listUsers select), change `manufacturerProfile: { select: { businessName: true, verificationStatus: true } }` to also select `id: true`. This is read-only and changes no behaviour.
2. In src/app/(app)/admin/users/page.tsx:
   - Add `const ROLE = { ...ROLE_LABEL, MANUFACTURER: "Factory" };`.
   - Use `ROLE[u.role]` in the table's Role column and in the mobile meta.
   - Build the Role filter options from `ROLE` (`Object.entries(ROLE)`) so the dropdown matches the column. Keep `sp.role in ROLE_LABEL` for validation, since the keys are the same.
3. In the Organisation cell, when `u.manufacturerProfile` exists, wrap `{org}` in `<Link href={`/admin/factories/${u.manufacturerProfile.id}`} className="cell-primary rounded-sm">`. That is the same link treatment the factories list uses, and the Verified badge stays beside it as plain text. Do the same in the mobile meta: render `ROLE[u.role]` and then, for manufacturers, ` · <Link href=... className="underline-offset-2 hover:underline text-ink">{org}</Link>`. Brand orgs stay plain text.
4. Optionally add `aria-label={`Review ${org}'s factory record`}` to the link.
5. If you'd rather not touch the service, fall back to `/admin/factories?status=ALL&q=${encodeURIComponent(org)}`, but the direct link is preferred.
6. Leave the header button "Open the verification queue" and the global ROLE_LABEL unchanged.

## admin-11 [low] [CONFIRMED] Account suspension button is as loud as the verification decision
- Screens: admin-factory-detail
- Files: src/components/admin/admin-forms.tsx
- Problem: Suspending an account is unrelated to the verification decision but carries the same visual weight as Reject, so three or more equal choices compete in the header.
- Fix: In UserStatusButton, use `variant="ghost"` for the non-suspended trigger at every size, so it is visibly secondary to Approve and Reject. Keep the Reactivate trigger as outline.
- Verifier refinement: In src/components/admin/admin-forms.tsx UserStatusButton, change the non-suspended trigger to `<Button variant="ghost" size={size}><Ban /> Suspend account</Button>`. Always use ghost and drop the size-conditional. The label "Suspend account" makes clear it locks the account rather than ruling on verification. Keep `<Button variant="outline" size={size}><RotateCcw /> Reactivate</Button>` for the suspended state. Optionally, in admin/factories/[id]/page.tsx, render UserStatusButton last after the verification actions (it already is) so it reads as the trailing, secondary account action. Use semantic tokens only; no colour classes. | In src/components/admin/admin-forms.tsx, change the non-suspended trigger to `<Button variant="ghost" size={size}><Ban /> Suspend</Button>` so it is ghost at every size. Keep the `size` prop, since the header still needs md height to line up with Approve and Reject. Change the JSDoc on `size` to say it only controls height. Leave the Reactivate trigger as outline. Make no other changes: keep the label text "Suspend" (the e2e tests select by that name), the dialog copy, tone="danger" and the server action.

## brand-1 [high] [CONFIRMED] Accept / Request revision / Decline buttons sit in the last row of a very tall comparison table
- Screens: brand-project-detail
- Files: src/components/projects/quotation-compare.tsx, src/app/(app)/projects/[id]/page.tsx
- Problem: The most important thing a brand does on a project (accepting a quotation, which creates the order) is the furthest control from the factory name and total. With 2–3 quotes on a laptop or phone, the user has to scroll past 14 rows of cost lines to find it, and the page has to explain where the buttons are.
- Fix: In quotation-compare.tsx, render the `canDecide` Decision row directly after the Summary group (or as the first tbody under the thead) instead of after Terms. Keep the same QuotationDecisionButtons and labels. In projects/[id]/page.tsx, change the body sentence to "Your decision buttons are under each factory's summary below." (or remove it).
- Verifier refinement: In `src/components/projects/quotation-compare.tsx`, pull the Decision `<tbody>` (the `canDecide` block) out into a `decisionBody` const. Render it inside the groups loop straight after the Summary group:

```
{groups.map((g, gi) => (<Fragment key={g.title}><tbody>…</tbody>{g.title === "Summary" && decisionBody}</Fragment>))}
```

Then remove it from the end of the table. This puts Accept / Request revision / Decline right under Total, Effective price, Quantity and Production time, which are the numbers a brand decides on.

Keep the same `QuotationDecisionButtons` props and the "No action" fallback. Change `border-t-line-strong` so the Decision row has a strong border on both top and bottom (for example add `border-b border-b-line-strong`). That keeps it visually separate from the Cost breakdown header below.

Leave the cost breakdown and terms where they are, as the detail a brand can scroll to.

In `src/app/(app)/projects/[id]/page.tsx` line 218, change the sentence to " Accept, revise or decline each quotation from the row under its summary below." You could also drop it entirely. Do not restore the action button on the quotations tab, because it would only link to the tab the user is already on. | 1. In src/components/projects/quotation-compare.tsx, move the Decision `<tr>` out of its trailing `{canDecide && <tbody>…</tbody>}` and render it inside the Summary group's `<tbody>`, right after the Summary rows. One way: inside `groups.map`, after `g.rows.map(...)`, add `{canDecide && g.title === "Summary" && decisionRow}`, where `decisionRow` is the existing `<tr>` pulled into a const. Delete the old trailing tbody so each button exists only once. Keep the `bg-surface-muted` cells. Change the top border from `border-t-line-strong` to the normal `border-t border-line-subtle`, so the strong rule doesn't look like the end of the table. The following "Cost breakdown" group header already adds its own `border-t border-line`. Leave QuotationDecisionButtons, its props, the "No action" fallback and the "Decision" row label unchanged.
2. In src/app/(app)/projects/[id]/page.tsx (around line 218), change `" Your decision buttons are in the last row of the comparison below."` to `" Accept, ask for a revision or decline right under each factory's summary below."`, or delete the line. Keep `actions: tab === "quotations" ? undefined : …` as it is.
3. Don't add a second copy of the buttons anywhere (header or bottom). Duplicate "Accept" or "Request revision" buttons would break Playwright strict-mode locators in tests/e2e/workflow.spec.ts.
4. Run tests/e2e/workflow.spec.ts, the brand compare/revise/accept test. Check the brand-project-detail page at the 390px phone width (expectPagesFitPhone / mobile.spec) to confirm the sticky first column and the sideways scroll still behave.

## brand-2 [high] [CONFIRMED] Order and project section tabs run off the right edge on phones with no hint (Messages, Terms & files and Activity are invisible)
- Screens: brand-order-detail-mobile, brand-projects-mobile
- Files: src/components/app/page-tabs.tsx, src/app/(app)/projects/page.tsx, src/app/(app)/disputes/page.tsx
- Problem: Phone users cannot see that the order has a Messages tab, which is the only way to talk to the factory, or that Terms & files and Activity exist. Nothing hints that the strip scrolls sideways.
- Fix: In PageTabs, let the tabs wrap below sm instead of scrolling: change the ul to `flex flex-wrap gap-x-1 sm:flex-nowrap sm:min-w-max` and drop `-mx-4 overflow-x-auto` below sm. If you keep the horizontal scroll, add a right-edge fade mask (`[mask-image:linear-gradient(to_right,black_85%,transparent)]` while overflowing) so cut-off items read as scrollable. Apply the same change to the inline view navs in projects/page.tsx and disputes/page.tsx, or switch them to PageTabs/StatusTabs.
- Verifier refinement: Fix this once in PageTabs and reuse it everywhere.
1) src/components/app/page-tabs.tsx:
   - Below sm, let the tabs wrap so every tab is visible.
     - nav: `mb-6 border-b border-line sm:overflow-x-auto`. Remove `-mx-4 px-4` so nothing bleeds off-screen.
     - ul: `flex flex-wrap gap-x-1 sm:flex-nowrap sm:min-w-max`.
   - The underline sits on the link's `-mb-px border-b-2`, so on a wrapped first row it would float above the nav border. Give each link a bottom border below sm and keep the current underline style from sm up. Alternatively, below sm switch to a pill/segmented style: the selected tab gets `bg-accent-soft text-accent-strong rounded-md` and no underline.
   - If you keep the sideways scroll instead, add a right-edge fade mask while the row overflows: `[mask-image:linear-gradient(to_right,black_85%,transparent)]`. Also scroll the active tab into view. Without both, a tab past the edge, like Messages, stays undiscoverable.
2) Replace the hand-rolled navs with this component so the behaviour lives in one place:
   - "Project views" in src/app/(app)/projects/page.tsx (line 49).
   - "Dispute status" in src/app/(app)/disputes/page.tsx (line 33).
   PageTabs builds `${basePath}?tab=key`, so either add an `href` field on each tab, or add a small StatusTabs variant that takes ready-made hrefs.
3) Update the doc comment that says it "Scrolls sideways on narrow screens instead of wrapping".
4) Check the 390px captures of order detail, projects and disputes in both themes: Messages, Terms & files, Activity and Delivered should all be visible without scrolling sideways. | PageTabs (src/components/app/page-tabs.tsx): nav -> `mb-6 sm:overflow-x-auto sm:border-b sm:border-line` (remove `-mx-4 px-4 overflow-x-auto border-b` at base); ul -> `flex flex-wrap sm:min-w-max sm:flex-nowrap sm:gap-1`; li -> `border-b border-line sm:border-0` so each wrapped row keeps its own baseline and the selected tab's `-mb-px border-b-2 border-accent` underline sits on it at every row. Update the doc comment to "Wraps onto extra rows on phones; scrolls sideways from sm up." Apply the same three class changes to the inline `Project views` nav in src/app/(app)/projects/page.tsx and the `Dispute status` nav in src/app/(app)/disputes/page.tsx (keep their gap-x-5 as `gap-x-5` with no gap-y; li already shrink-0), and to StatusTabs in src/components/orders/order-parts.tsx (nav `mb-4 sm:overflow-x-auto sm:border-b sm:border-line`, ul `flex flex-wrap gap-x-6 sm:min-w-max sm:flex-nowrap`, li `border-b border-line sm:border-0`). Do not add a mask-image fade (needs JS to know when it overflows). Verify with the 390px mobile captures for brand-order-detail and brand-projects in both themes, then run tests/e2e/mobile.spec.ts and workflow.spec.ts.

## brand-3 [medium] [CONFIRMED] On the order page the 'Your next step' card (Pay buttons) comes after the progress panel, unlike the project page
- Screens: brand-order-detail, brand-order-detail-mobile
- Files: src/components/orders/order-detail.tsx
- Problem: The card that is meant to be 'the one place the viewer acts' is not at the top of the order page. The two equivalent record pages also order their content differently.
- Fix: In order-detail.tsx, move `<NextStepCard … />` above the Production progress Panel. Better still, match the project page and pass the stepper and facts as the card's footer. Keep `id="next-step"` and all texts unchanged.
- Verifier refinement: The minimal safe fix is in src/components/orders/order-detail.tsx: move `<NextStepCard order={order} view={view} />` (line 163) above the Production progress `<Panel>` (lines 119–161), so it renders right after the created / returned Alerts. Keep the Panel's `mb-6` and leave all text unchanged.

The fix that matches the project page:
1. Add an optional `progress?: React.ReactNode` prop to NextStepCard in src/components/orders/next-step.tsx.
2. Render it as the last child of the `<section id="next-step">`, wrapped in `<div className="border-t border-line px-4 py-4 sm:px-5">`.
3. In order-detail.tsx, pass the Panel's inner content as `progress`: the heading row ("Production progress" plus the "x of y stages complete" ProgressBar), the phone line and bar, the StageStepper and the Facts `<dl>`. Then delete the standalone Panel.

Keep `id="next-step"`, `scroll-mt-24` and every text string unchanged. Because the card always renders, the stepper never disappears, including for closed or delivered orders where the card shows only the "This order is complete" line. | In src/components/orders/order-detail.tsx, move `<NextStepCard order={order} view={view} />` so it renders directly after the `sp.created` / `sp.payment` Alerts and before the "Production progress" `<Panel className="mb-6" ...>`. Leave the Panel as it is, right below the card and above `<PageTabs>`. Both already have mb-6, so spacing stays the same. Don't touch next-step.tsx: keep `id="next-step"`, the scroll-mt and every text. Update the JSDoc above OrderDetail so the stated order is header, "Your next step" card, compact production-progress card, then tabs. Don't fold the stepper or facts into the card's footer, because the order card already holds several task blocks and would get too tall. Check by rendering brand-order-detail at 390px with a payment due: the accent "Pay ..." button should now be near the top, and `npx playwright test tests/e2e/workflow.spec.ts` should still pass.

## brand-4 [medium] [CONFIRMED] Payments list is sorted by last update, so the highlighted Pay button goes to a later milestone than the one the order page highlights
- Screens: brand-payments
- Files: src/app/(app)/payments/page.tsx
- Problem: Milestones appear out of production order, with a paid row between the two due ones. The 'one key action' points to a different milestone than on the order page, and the doubled 'Due …' wording is confusing.
- Fix: In payments/page.tsx, sort `data.items` before rendering, by order reference and then `STAGE_BY_KEY[p.triggerStage].sequence` (from @/lib/workflow), then compute `firstPayable`. Show the 'Due after …' subline only while the milestone is SCHEDULED, since the Timing column already covers due and paid rows.
- Verifier refinement: 1. In src/server/services/payments.ts, `listPayments` (the only caller is payments/page.tsx), replace `orderBy: [{ updatedAt: "desc" }]` with `orderBy: [{ order: { createdAt: "desc" } }, { orderId: "asc" }, { sequence: "asc" }]`. This groups milestones by order, newest order first, and keeps them in schedule order. It also stays correct across pagination and uses the same `sequence` field as the order page (orders.ts:286). `firstPayable = data.items.find(...)` then picks the earliest payable milestone of the newest order, which matches the order page's Next step for a single order.
2. Optionally, make the page agree with the order page in every case: choose `firstPayable` as the payable item with the lowest `sequence` among items whose `order.id` matches the first payable row's order.
3. In payments/page.tsx line 127, render the "Due after {stageLabel(p.triggerStage).toLowerCase()}" subline only when `p.status === "SCHEDULED"`. Due and paid rows already show their timing in the Timing column. | 1) Sort on the server, so pagination and the highlighted button agree. In src/server/services/payments.ts listPayments, replace `orderBy: [{ updatedAt: "desc" }]` with `orderBy: [{ order: { createdAt: "desc" } }, { orderId: "asc" }, { sequence: "asc" }]`. This puts the newest orders first and each order's milestones in schedule order, the same as the order page's `sequence asc`. The page's existing `firstPayable = data.items.find(payable)` then picks the earliest payable milestone of the newest order. For a single order, that is the same milestone the next-step card highlights (QC approval 40% before Delivery 30%). No other caller is affected, and the totals and count queries stay as they are.
2) In src/app/(app)/payments/page.tsx, delete the desktop-table subline `<p className="mt-0.5 text-xs text-ink-muted">Due after {stageLabel(p.triggerStage).toLowerCase()}</p>`. The Timing column (dueText) already covers every state: "Paid …", "Due by …", or "After <stage>" for scheduled rows. If you want to keep the trigger, make the scheduled-only fallback in dueText read `Due after ${stageLabel(...).toLowerCase()}`, so there is one 'due' line per row.
3) Optional: group by order visually. When `p.orderId` differs from the previous row's, add a top border on that row (for example `border-t border-line-strong`, using a semantic token), so milestones from different orders don't run together. Make no other changes: keep the outline/accent PayButton logic and leave the next-step card untouched.

## brand-5 [medium] [CONFIRMED] Projects list has two filter controls for the same thing; on phones they push the list down and the view tabs are cut off
- Screens: brand-projects, brand-projects-mobile
- Files: src/app/(app)/projects/page.tsx
- Problem: Users face two ways to filter by status that can disagree. If you pick a tab and then change the select, which one wins? On a phone the duplicate form takes most of the first screen.
- Fix: Remove the `selects` status entry from the FilterBar on /projects so it is search-only. Add the remaining states to VIEWS (for example 'Cancelled') so every status stays reachable from the tabs. Make the tabs wrap on phones (see the PageTabs finding).
- Verifier refinement: In src/app/(app)/projects/page.tsx:
1) Remove the `selects` prop from FilterBar so it is search-only. Pass `hidden={{ status }}` so a search keeps the active tab instead of resetting it to All. viewHref already carries q, so switching tabs keeps the search.
2) Add `{ value: "CANCELLED", label: "Cancelled" }` to VIEWS. With that, every status stays reachable: Open already covers SUBMITTED, QUOTATION_ACCEPTED, QUALITY_CHECK, READY_TO_SHIP and SHIPPED. Do not add one tab per enum value.
3) On phones, change the tab `<ul>` to `flex flex-wrap gap-x-5` (or adopt the shared PageTabs component once it wraps). Drop the `-mx-4 overflow-x-auto` so Delivered and Cancelled are visible without a hidden horizontal scroll.
4) Optional: let the FilterBar Clear link keep the current status (link to viewHref(status)) so clearing the search does not also clear the tab.
Use semantic tokens only; no other visual changes needed. | In src/app/(app)/projects/page.tsx:
(1) Replace `selects=[...]` on FilterBar with `hidden={{ status }}`. Search then stays inside the current tab, and the Status select plus its 'Status: all' option go away.
(2) Add a single entry `{ value: "CANCELLED", label: "Cancelled" }` to the end of VIEWS. Do not add one tab per status, because 'Open' (ACTIVE) already covers SUBMITTED, QUOTATION_ACCEPTED, QUALITY_CHECK, READY_TO_SHIP and SHIPPED.
(3) Leave the server-side `status` parsing alone so old or shared ?status=SHIPPED links still filter. When `status` is set but matches no VIEWS entry, render a small extra active tab using PROJECT_STATUS[status].label, so the user can still see what they are filtering by.
(4) On phones, make the tab list wrap instead of cutting off (`flex flex-wrap gap-x-5`, drop overflow-x-auto and -mx-4), or reuse the PageTabs fix from the related finding so both behave the same way.
(5) Optional: have FilterBar show its Clear button only when `q` is set. Alternatively, point Clear at viewHref(status) so clearing the search keeps the tab. Either way, a hidden status no longer makes Clear appear on every tab.
After the change, run the e2e suite. Nothing should need updating, since no spec uses the projects status select.

## brand-6 [medium] [CONFIRMED] Brand dashboard on a phone: a five-cell metric strip of mostly zeros fills the first screen, misaligned, before 'Needs your attention'
- Screens: brand-dashboard-mobile, brand-dashboard
- Files: src/app/(app)/dashboard/page.tsx, src/components/app/primitives.tsx
- Problem: Low-value zero counts take the top of the phone screen and push the actionable list below the fold. Uneven label heights make the grid look broken.
- Fix: In dashboard/page.tsx, render the 'Needs your attention' panel before the MetricStrip below sm. For example, wrap both in `flex flex-col` and give the strip `max-sm:order-2`. In primitives.tsx Metric, make the cell `flex flex-col` and give the value `mt-auto pt-2.5` (or give the label `min-h-8` on max-sm) so values line up when a label wraps.
- Verifier refinement: In src/components/app/primitives.tsx, change the Metric cell class to start with `relative flex min-w-0 flex-col ...`, keeping the rest of the classes. Change the value span from `mt-2.5 block` to `mt-auto block pt-2.5`. In a grid row the cells already stretch to equal height, so the values line up at the bottom even when one label wraps. Also add `max-sm:min-h-8` to the label span so the label area keeps a steady height.

In src/app/(app)/dashboard/page.tsx, for the brand view: on phones, move the strip below the attention list. Do not move it below the whole page. One way is to render the MetricStrip twice: once with `className="max-sm:hidden"` where it is now, and once inside the first column's `space-y-6` just after the 'Needs your attention' Panel with `className="sm:hidden mb-0"`. Another way is to set the outer wrapper to `flex flex-col` with `contents` on the inner column on phones, so the strip's order lands between the attention Panel and 'Recent projects'.

Optionally, on phones, hide the zero-value cells, or reduce the strip to the non-zero metrics plus one 'All clear' line. Also consider dropping the 'Payments due' metric, since the attention item and the 'Upcoming payments' panel already show those payments. | 1) src/app/(app)/dashboard/page.tsx, BrandHome: put the actions before the counts in DOM order instead of using CSS `order`. Move `<MetricStrip label="Summary">…</MetricStrip>` from above the grid to inside the left column `<div className="space-y-6">`, directly after the "Needs your attention" Panel and before "Recent projects". Pass `className="mb-0 sm:mb-0"` so the strip's built-in mb-6/sm:mb-8 does not add to the column's space-y-6. Effects: on phones and below xl (single column) the order becomes header, attention, metrics, then the rest. At xl the strip sits in the 1.6fr column under the attention list, still five across (lg:grid-cols-5). Tab order matches visual order and no ordering classes are needed. Leave ManufacturerHome as it is unless it shows the same symptom. Optional, and only if the team wants it: the duplicated "Payments due" metric can stay, since it links to /payments; do not delete any metric.

2) src/components/app/primitives.tsx, Metric: on phones, reserve two label lines so values line up even when a hint is present. Change the label wrapper from `flex items-center gap-1.5 pr-5 text-xs font-medium leading-4 text-ink-muted` to `flex items-center gap-1.5 pr-5 text-xs font-medium leading-4 text-ink-muted max-sm:min-h-8 max-sm:items-start`. min-h-8 = 2 × leading-4. items-start keeps the icon on the first line. Keep the value's `mt-2.5` unchanged and do not use `mt-auto`, which breaks when one cell in a row has a `hint`. Check brand-dashboard-mobile in light and dark at 390px afterwards. Then run tests/e2e/mobile.spec.ts and workflow.spec.ts. They should be unaffected because no spec targets these elements.

## brand-7 [medium] [CONFIRMED] A delivered order shows three different delivery dates across screens; the Orders list still shows 'Due' for a finished order
- Screens: brand-orders, brand-project-detail, brand-order-detail, brand-projects-mobile
- Files: src/components/orders/order-table.tsx, src/app/(app)/projects/[id]/page.tsx, src/app/(app)/projects/page.tsx
- Problem: Status words and dates contradict each other. A finished order still reads as 'Due' in the future, and the project shows a delivery deadline months after it was delivered.
- Fix: In order-table.tsx, add `deliveredAt: Date | null` to Row (listOrders already includes all scalar fields). When status is DELIVERED, render 'Delivered {formatDate(deliveredAt)}' in the table cell and the mobile card instead of the due date. In projects/[id]/page.tsx (description) and projects/page.tsx (mobile card meta), show 'delivered {date}' from `project.order.deliveredAt` when the status is DELIVERED instead of 'delivery by / due {deadline}'.
- Verifier refinement: 1) order-table.tsx: add `deliveredAt: Date | null` to Row. Add a helper `dateCell(o)` that returns `{label: "Delivered", date: o.deliveredAt}` when `o.status === "DELIVERED" && o.deliveredAt` and `{label: "Due", date: o.expectedCompletionDate}` otherwise. On the mobile card, render `{label} {formatDate(date)}`. In the table, rename the header to "Due / delivered" (or "Date"), and for delivered rows render the date with a small muted "Delivered" prefix so the column doesn't read as a future due date. Leave cancelled rows as they are, or show a dash. 2) src/server/services/projects.ts: add `deliveredAt: true` to the order select at line 206 (getProject) and change `order: { select: { id: true } }` at line 232 (listProjects) to `{ id: true, deliveredAt: true }`. 3) projects/[id]/page.tsx line 292: when `project.status === "DELIVERED" && project.order?.deliveredAt`, show `delivered ${formatDate(project.order.deliveredAt)}` instead of `delivery by ${formatDate(project.deadline)}`. 4) projects/page.tsx: apply the same switch to the mobile meta at line 98 ("delivered {date}" instead of "due {deadline}") and the Delivery table cell at line 134. | 1. src/components/orders/order-table.tsx
   - Add `deliveredAt: Date | null` to Row. listOrders uses `include`, so every scalar field is already returned.
   - Add a helper `dateCell(o)` that returns:
     - "Delivered {formatDate(o.deliveredAt)}" when status is DELIVERED and deliveredAt is set;
     - "Was due {formatDate(o.expectedCompletionDate)}" when status is CANCELLED;
     - otherwise "Due {formatDate(o.expectedCompletionDate)}" on the mobile card, and the bare date in the table.
   - Use it in the mobile card (replacing the hard-coded "Due …") and in the table cell. For closed orders use text-ink-muted in the cell.
   - Rename the table header from "Due" to "Delivery", which covers both meanings.
   - Keep the late/DelayedFlag logic unchanged; it already ignores closed orders.
2. src/server/services/projects.ts
   - Add `deliveredAt: true` to the order select in getProject (line 206) and in the list query (line 232). This only reads one more field; nothing else on the server changes.
3. src/app/(app)/projects/[id]/page.tsx
   - In the PageHeader description, when project.status === "DELIVERED" and order?.deliveredAt is set, show "delivered {formatDate(order.deliveredAt)}" in place of "delivery by {deadline}".
   - Leave the other statuses unchanged; the relativeDays suffix is already hidden for closed projects.
4. src/app/(app)/projects/page.tsx
   - Apply the same rule to the mobile card meta ("delivered {date}" instead of "due {deadline}").
   - Apply it to the desktop "Delivery" column cell too (line 134), so the table and the cards agree.
   - When deliveredAt is null, fall back to the existing deadline text.
5. Use semantic tokens only; no new colours. No e2e test needs updating.

## brand-8 [low] [CONFIRMED] Dashboard 'payments due' attention item gives no amount and sends the user to a generic list
- Screens: brand-dashboard, brand-dashboard-mobile
- Files: src/app/(app)/dashboard/page.tsx
- Problem: The description explains a policy instead of what to do. There is no total and no order reference, and the link goes to the unsorted payments list (see the payments finding) rather than to the order's payments, where the Next step card shows the Pay buttons.
- Fix: Set the description to the amount and order, for example `${formatMoney(sum)} across ${refs}` built from `d.payments`. When every due payment belongs to one order, set href to `/orders/${id}?tab=payments` (or to the order page so the Next step card is on top).
- Verifier refinement: In the dashboard page, build the text from the due list (DUE, non-failed): `const dueOnly = d.payments.filter(p => p.status === "DUE"); const orderIds = [...new Set(dueOnly.map(p => p.order.id))]; const currencies = new Set(dueOnly.map(p => p.currency));`. Set description to `${currencies.size === 1 ? formatMoney(sum, cur) : plural(dueOnly.length, "milestone")} due on ${orderIds.length === 1 ? dueOnly[0].order.reference : plural(orderIds.length, "order")}${earliest.dueAt ? ` · next ${relativeDays(earliest.dueAt)}` : ""}`. Set href to `orderIds.length === 1 ? `/orders/${orderIds[0]}?tab=payments` : "/payments"` (or to the order overview, so the Next step card with its Pay button is on top). Apply the same single-order deep link to the "failed" item. Because the service caps the list with take: 5, either add a `db.paymentMilestone.groupBy({ by: ["currency"], where: { order: mine, status: "DUE" }, _sum: { amount: true }, _count: true })` (plus a distinct orderId count) to brandDashboard so the count and total are exact, or show "5+" when the list hits the cap. | In src/app/(app)/dashboard/page.tsx, build an `open` list for the due row: `const open = due.filter(p => p.status !== "FAILED")`.

Description:
- Group `open` by currency and format each group's sum with `formatMoney(sum, currency)`, then join the groups with " + ".
- Add the order references: `Array.from(new Set(open.map(p => p.order.reference))).join(", ")`.
- Example result: "€12,400.00 due on ORD-1042 — pay from the order's Next step card".
- If `d.payments.length === 5`, add "and more" so a list cut off by the query limit is never shown as a full total. Better: add an uncapped `db.paymentMilestone.groupBy({ by: ["currency"], where: { order: mine, status: "DUE" }, _sum: { amount: true }, _count: true })` to brandDashboard. It is read-only, and it also fixes the capped count and the "Payments due" metric.

Link:
- If every item in `open` has the same `order.id`, set href to `/orders/${id}?tab=payments`. This matches the existing "Upcoming payments" rows, and the Next step card with the Pay button is shown above the tabs.
- Otherwise keep `/payments`.
- Apply the same logic to the "failed" row, using its existing "Retry the payment…" wording plus the amount and reference.

Keep the titles as they are, use no new styling, and do not change server write paths.

## brand-9 [low] [CONFIRMED] Delivered order's Production tab lists all eight completed stages in full and repeats the stepper above it
- Screens: brand-order-detail, brand-order-detail-mobile
- Files: src/components/orders/milestone-tracker.tsx
- Problem: On a finished order the default tab is a long list of 'Completed 29 Oct 2026' rows that adds little over the stepper and pushes the other content far down.
- Fix: In milestone-tracker.tsx, wrap the closed-order list in the same collapsed `<details>` summary used for `before` ('8 completed stages · Show history'), so the history is still one tap away.
- Verifier refinement: In milestone-tracker.tsx, pull the existing history `<details>` (summary row and DoneRow/UpcomingRow list) out into a small `History` component that takes `items` and a label. Use it for `before` on open orders, and for all `milestones` when `closed`.

For the closed case, count only stages with status COMPLETED. When that is fewer than 8 (a cancelled order), label it "N of 8 stages completed" so the summary stays truthful. Keep the "· X finished late" note in the summary.

Leave it collapsed by default. On mobile the stepper is hidden, so this summary row is the only stage history shown, and it remains one tap away.

Update the doc comment at line 176, which currently says "Closed orders show the full history". | In src/components/orders/milestone-tracker.tsx, pull the existing <details> block (lines 209-229) into a small `StageHistory({ items }: { items: TrackerMilestone[] })` component. It should count `items.length` and the `isDelayed` stages for the "· N finished late" note, and keep the same classes and the "Show history"/"Hide history" summary. Use it in both branches so the markup isn't duplicated.

In the closed branch (`currentIndex < 0`), split the list. Put `done = milestones.filter(m => m.status === "COMPLETED")` inside <StageHistory items={done} /> (collapsed by default), then render the remaining non-completed stages below it as a visible <ol>. For a cancelled order that list needs a caption such as <p className="label-caps ...">Not reached</p>, using the same style as the "Up next" label, so it's clear where production stopped. A delivered order then shows a single "8 completed stages · Show history" row. Leave the open-order branch's behaviour unchanged, and update the JSDoc line "Closed orders show the full history" to say the history is folded on closed orders too. No server or test changes are needed.

## brand-10 [low] [CONFIRMED] Notifications page: 19 identical bold rows with no type cue and no sign that a row opens something
- Screens: brand-notifications, brand-dashboard
- Files: src/app/(app)/notifications/page.tsx
- Problem: Users cannot scan for the items that need a decision, and nothing tells them that tapping a row takes them to the order or quotation.
- Fix: In NotificationRow, add a trailing `ChevronRight` (size-4, text-ink-subtle) when `n.link` is set, and a small leading icon chosen from simple title keywords (payment / sample / quotation / dispute). Use `text-ink-subtle` icons as the design system allows.
- Verifier refinement: In NotificationRow (src/app/(app)/notifications/page.tsx), choose the leading icon from `n.type` with a static map, not from title keywords. For example: PAYMENT_UPDATE→CreditCard, SAMPLE_SUBMITTED/SAMPLE_DECISION→Shirt, QC_*→ClipboardCheck, quotation types→FileText, MATCH_FOUND→Sparkles, ORDER_SHIPPED→Truck, ORDER_DELAYED→Clock, dispute types→MessageSquareWarning, with a Bell fallback. Render it as a size-4 text-ink-subtle icon (aria-hidden) beside the unread dot. When `n.link` is set, add a trailing ChevronRight (size-4, text-ink-subtle, aria-hidden) after the time. Optionally mark the types that need a decision (SAMPLE_SUBMITTED, QC_REPORT_SUBMITTED, PAYMENT_UPDATE due for brands) with a small 'Action needed' Badge, so they stand out from routine stage updates without adding a second accent action. Use semantic tokens only. | In NotificationRow (src/app/(app)/notifications/page.tsx), pick the leading icon from `n.type` with a fixed map, not from words in the title. Example: `const TYPE_ICON: Partial<Record<NotificationType, LucideIcon>> = { PAYMENT_UPDATE: CreditCard, SAMPLE_SUBMITTED: Shirt, SAMPLE_DECISION: Shirt, QC_REPORT_SUBMITTED: ClipboardCheck, QC_OUTCOME: ClipboardCheck, QUOTATION_RECEIVED: FileText, QUOTATION_REVISION_REQUESTED: FileText, QUOTATION_REVISED: FileText, QUOTATION_ACCEPTED: FileText, QUOTATION_REJECTED: FileText, DISPUTE_UPDATE: Scale, ORDER_SHIPPED: Truck, ORDER_DELIVERED: PackageCheck, ORDER_DELAYED: Clock, MILESTONE_UPDATED: Factory, MATCH_FOUND: Sparkles, MESSAGE_RECEIVED: MessageSquare, VERIFICATION_DECISION: BadgeCheck }`, with `Bell` as the fallback. Import `NotificationType` from "@/generated/prisma/client". Render the icon as `<Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-subtle" />` after the unread-dot column. Keep the accent dot as the only colour cue, because adding tone colours would compete with it. When `n.link` is set, add `<ChevronRight aria-hidden className="size-4 shrink-0 self-center text-ink-subtle" />` after the `<time>` element, and leave non-link rows without one. Optional and still small: for types that ask the viewer to act (SAMPLE_SUBMITTED, QC_REPORT_SUBMITTED, QUOTATION_RECEIVED, QUOTATION_REVISION_REQUESTED), show the icon as `text-accent` while the row is unread, so decision rows stand out from routine stage updates. Use no fills or badges, and do not change the title text, aria labels, href or prefetch. That keeps the e2e getByText checks and the /notifications/[id] redirect behaviour the same.

## public-1 [high] [CONFIRMED] Factory owners have no sign-up path in the header or phone menu
- Screens: public-for-manufacturers, public-home-mobile, public-for-manufacturers-mobile
- Files: src/components/site/site-header.tsx
- Problem: The header's main call to action always speaks to brands. A manufacturer who opens the menu on a phone finds no way to register, and on desktop the header pushes the brand sign-up even on the For Manufacturers page.
- Fix: In SiteHeader, compute `const factory = pathname.startsWith('/for-manufacturers')` and, when it is true, make the desktop CTA 'Join as a Manufacturer' linking to /register?role=manufacturer. In the mobile SheetContent footer, add a third SheetClose button (variant="ghost" or a text link) under Login: 'Run a factory? Join as a manufacturer', linking to /register?role=manufacturer.
- Verifier refinement: In SiteHeader add `const factory = pathname.startsWith("/for-manufacturers");` and `const cta = factory ? { href: "/register?role=manufacturer", label: "Join as a Manufacturer" } : { href: "/register?role=brand", label: "Start a Project" };`. Use `cta` for both the desktop filled Button and the mobile accent Button, so the CTA swaps on the manufacturer page on both desktop and phone. In the mobile SheetContent footer, under Login, add one more SheetClose with a quiet text link (not a third filled or outline button, to keep one accent action). It is the opposite audience's link: on non-factory pages "Run a factory? Join as a manufacturer" → /register?role=manufacturer, and on /for-manufacturers "Sourcing for a brand? Start a project" → /register?role=brand. Style it with semantic tokens only (e.g. `text-sm text-ink-muted hover:text-ink underline-offset-4 hover:underline`, centred, min-h-11 tap target). Leave the logged-in `home` branch unchanged. | In SiteHeader add `const factory = pathname.startsWith("/for-manufacturers"); const cta = factory ? { href: "/register?role=manufacturer", label: "Join as a Manufacturer" } : { href: "/register?role=brand", label: "Start a Project" };`.

Desktop: render the filled Button with cta.href and cta.label (keep the ghost Login button). Check the layout at exactly 1024px. If it crowds the nav, give the desktop button the label "Join as a factory" and keep the full wording on the page body.

Mobile SheetContent footer, logged-out branch:
- The accent SheetClose button uses cta.href and cta.label (+ ArrowRight).
- Keep the outline Login button.
- Below both, add one quiet SheetClose text link for the other audience. It is not a third full button, e.g. `<SheetClose asChild><Link href={factory ? "/register?role=brand" : "/register?role=manufacturer"} className="py-2 text-center text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">{factory ? "Sourcing for a brand? Start a project" : "Run a factory? Join as a manufacturer"}</Link></SheetClose>`.

Leave the logged-in `home` branch ("Go to dashboard") unchanged. Use semantic tokens only and no new accent elements. No test changes are needed. Optionally add a mobile.spec assertion that the open menu contains a link to /register?role=manufacturer.

## public-2 [medium] [CONFIRMED] Login is hidden behind the hamburger on phones
- Screens: public-home-mobile, public-how-it-works-mobile, public-faq-mobile, public-contact-mobile
- Files: src/components/site/site-header.tsx
- Problem: Returning users, the most frequent visitors, need two taps and have to look inside a menu to find Login. Signed-in users also lose the visible 'Go to dashboard' link on phones.
- Fix: Next to the menu button, add a compact link visible only below lg: `<Button asChild variant="ghost" size="sm" className="lg:hidden"><Link href={home ?? '/login'}>{home ? 'Dashboard' : 'Log in'}</Link></Button>`. Keep the sheet as it is.
- Verifier refinement: In site-header.tsx, inside the right-hand `flex items-center gap-1 lg:gap-2` group, put a compact link between <ThemeToggle /> and the <Sheet>, visible only below lg: `<Button asChild variant="ghost" size="sm" className="lg:hidden"><Link href={home ?? "/login"}>{home ? "Dashboard" : "Login"}</Link></Button>`. The label "Login" matches the desktop button and the sheet; don't introduce "Log in". Keep it ghost (not accent) so there's still only one accent action, which stays "Start a Project" in the sheet. Leave the sheet as it is, including its Login and Go to dashboard buttons. | In site-header.tsx, inside the right-hand `<div className="flex items-center gap-1 lg:gap-2">`, add the link just before `<Sheet>` (after the theme toggle and the hidden desktop group):
`<Button asChild variant="ghost" size="sm" className="shrink-0 lg:hidden"><Link href={home ?? "/login"}>{home ? "Dashboard" : "Login"}</Link></Button>`
Keep the existing "Login" spelling instead of "Log in". Use the ghost variant, not primary or accent, and leave the sheet's actions as they are. Then run tests/e2e/mobile.spec.ts to confirm the 320px and 375px no-overflow checks still pass. If 320px overflows with "Dashboard", reduce the gap or use the label "Account".

## public-3 [medium] [CONFIRMED] Contact form starts below the fold on phones, and the 'your dashboard' hint has no link
- Screens: public-contact-mobile, public-contact
- Files: src/app/(public)/contact/page.tsx
- Problem: The page's main task, sending a message, is pushed off-screen on phones by secondary info. The registered-user hint names a destination but gives no way to get there.
- Fix: Add `order-last lg:order-none` to the aside column (or `order-first lg:order-none` to the form card) so the form comes first on phones. Make 'your dashboard' a `<Link href="/login">` styled like the email link. /login already redirects signed-in users to their home.
- Verifier refinement: In src/app/(public)/contact/page.tsx:
1. Move the `<div className="rounded-lg border border-line bg-surface lg:col-span-8">` form card so it comes before the aside in the source. That way phones, keyboard users and screen readers all reach "Send a message" first.
2. Add `lg:order-first` to the aside: `<div className="lg:col-span-4 lg:order-first">`. This keeps the current desktop layout, with the aside in the left 4 columns and the form in the right 8.
3. Import Link from "next/link" and replace the plain sentence with: `<p className="text-sm leading-6 text-ink-muted">Report a problem with a project or order from <Link href="/login" className="text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong">your dashboard</Link>.</p>`. Use the same classes as the email link and no new colours. /login already sends signed-in users to homeFor(role).
4. After the change, run `tests/e2e/mobile.spec.ts`. Only the overflow check covers /contact, so nothing else should be affected. | Fix the source order instead of relying on CSS order alone, so the visual order matches the order screen readers and keyboard users get. In contact/page.tsx, move the form card `div.rounded-lg…lg:col-span-8` above the aside and add `lg:order-last` to it. The form then comes first on phones and stays in the right column on desktop. As a smaller alternative, add `order-first lg:order-none` to the form card. In the 'Already registered?' item, change the text to: Report a problem with a project or order from <Link href="/login" className="text-accent-strong underline decoration-accent-line underline-offset-4 transition-colors duration-150 hover:decoration-accent-strong">your dashboard</Link>. Import Link from next/link. /login already sends signed-in users to their role's home page.

## public-4 [medium] [CONFIRMED] Example payment schedule on the marketing pages contradicts the real payment rules
- Screens: public-home
- Files: src/components/site/product-mocks.tsx
- Problem: The illustration teaches a deposit / mid-production / balance model, with 40% due during stitching. The app and the FAQ use different names and say that payment comes due after QC.
- Fix: In product-mocks.tsx, rename the rows to 'Sample approval · 30%' (Paid), 'QC approval · 40%' (Scheduled, tone neutral) and 'Delivery · 30%' (Scheduled). On the floating card, change the subtitle to 'QC approval · 40%' and the badge to `<Badge tone="neutral" dot>After QC</Badge>` (or 'Scheduled').
- Verifier refinement: In `src/components/site/product-mocks.tsx`, use the app's real milestone names so brands meet the same words later in the app.

**PAYMENTS rows:**
- `{ label: "Sample approval · 30%", amount: "USD 960.00", tone: "success", status: "Paid" }`
- `{ label: "QC approval · 40%", amount: "USD 1,280.00", tone: "neutral", status: "After QC" }`
- `{ label: "Delivery · 30%", amount: "USD 960.00", tone: "neutral", status: "On delivery" }`

If the column is wide enough, use "Post-production QC approval" and "Delivery confirmation" exactly as written in `DEFAULT_PAYMENT_SCHEDULE`. Plain "Scheduled" also works as the status for both unpaid rows.

**Floating card:**
- Subtitle: "QC approval · 40%". Use "Post-production QC approval · 40%" if it fits the w-64 card.
- Badge: change from warning "Due" to `<Badge tone="neutral" dot>After QC</Badge>`.
- Optional: change the "Next payment" heading to "Next milestone payment".

**Wording:** say "falls due", not "is due", so the copy matches the FAQ ("after you accept the QC report").

Use semantic tones only; this change needs no colour changes. | In src/components/site/product-mocks.tsx, change PAYMENTS to:
- { label: "Sample approval · 30%", amount: "USD 960.00", tone: "success", status: "Paid" }
- { label: "QC approval · 40%", amount: "USD 1,280.00", tone: "neutral", status: "Scheduled" }
- { label: "Delivery · 30%", amount: "USD 960.00", tone: "neutral", status: "Scheduled" }

Optionally use the fuller real names "Post-production QC approval · 40%" and "Delivery confirmation · 30%" if the row width allows.

On the floating card:
- Change line 112 to "QC approval · 40%".
- Change line 109 to <Badge tone="neutral" dot>Scheduled</Badge>. Use the real payment status word from src/lib/labels.ts, not an invented "After QC" label.

Keep the "Next payment" heading and the USD 1,280.00 amount. The amounts still add up to 3,200. The sample stage is done in the mock, so showing "Sample approval" as Paid stays consistent with the "Stitching, Stage 4 of 8" state. Don't change any server, workflow or test files.

## public-5 [medium] [CONFIRMED] How It Works uses several numbering schemes that do not line up
- Screens: public-how-it-works, public-how-it-works-mobile
- Files: src/app/(public)/how-it-works/page.tsx
- Problem: A reader cannot map detail step 04 to overview step 04 because they are different things. The page reads as 4, 7, 8 and 9 steps at the same time.
- Fix: Number the DETAIL entries by the overview steps they cover: show 'Step 1', 'Step 2', 'Step 3' and 'Steps 4-7' (for example a `steps` field on each DETAIL item) in both the big numeral and the On-this-page list, replacing 01-04. Remove the 01-09 numeral column from the STATUSES list, because the badges already carry the meaning.
- Verifier refinement: In src/app/(public)/how-it-works/page.tsx:
1. Add a `steps` label to each DETAIL item and remove the "1. " prefixes from the titles, so the `.replace(/^\d+\.\s*/, "")` calls can go: `{ steps: "Step 1", title: "The brand submits requirements", ... }`, then "Step 2", "Step 3", and `{ steps: "Steps 4-7", title: "Production and quality control are tracked", ... }`.
2. In the On-this-page list (line 89), render `{d.steps}` instead of the padded index. Widen the label cell from `w-7` to about `w-20`, use `whitespace-nowrap`, and use non-italic small caps so "Steps 4-7" fits on one line. The anchor ids `step-${i + 1}` can stay as they are.
3. In the detail list (lines 132-134), replace the big `String(i + 1).padStart(2, "0")` numeral with `{d.steps}` at a smaller size, for example `text-[1.75rem] lg:text-[2.25rem]`, so the "Steps 4-7" label doesn't crowd the h3.
4. Make the first bullet of step 4 read: "Steps 4-7 run on the order page as eight milestones: fabric sourcing, sampling, ...". This links the 7-step overview to the 8 milestones.
5. In STATUSES (lines 160-166), delete the numeral `<span>` and the `i` parameter, and change the grid to `sm:grid-cols-[10.5rem_minmax(0,1fr)]`.
6. Optional: remove the `index` props ("01"/"02"/"03") from the three SectionHeadings on this page so no other 01-0x sequence competes with the steps. Leave the shared component unchanged. | In src/app/(public)/how-it-works/page.tsx:

1. Add a `steps` field to each DETAIL item: "1", "2", "3" and "4–7" (use an en dash). Drop the "N. " prefix from the titles and remove the `.replace(/^\d+\.\s*/, "")` calls that strip it. Keep `id={`step-${i + 1}`}` and the hrefs unchanged, so the anchors keep working.

2. In the big numeral span, render `d.steps` instead of `String(i + 1).padStart(2, "0")`. Put a small caps label above it, e.g. `<span className="label-caps text-ink-muted">{d.steps.includes("–") ? "Steps" : "Step"}</span>`. Keep the numeral at its current size; "4–7" is about as wide as "04", so it will not wrap. Do not set the whole phrase "Steps 4–7" at display size. In the On-this-page list, render `d.steps` in the w-7 column but widen that column to about w-10 so "4–7" fits. Optionally add an sr-only "Step"/"Steps" prefix, because the numeral is aria-hidden.

3. In the step-4 point "Accepting a quotation creates an order with eight milestones: …", add a short clause tying the milestones to the overview, e.g. "…(overview steps 4–7 group these: sampling, production, quality control and delivery)". This explains why there are 8 milestones but 7 overview steps.

4. In STATUSES, delete the aria-hidden numeral span. Change the grid to `sm:grid-cols-[10.5rem_minmax(0,1fr)]`. Keep the `<ol>`, because the order of statuses still matters for screen readers.

5. Leave the SectionHeading index 01-03 kickers and the WorkflowDiagram (it is shared with the home page) unchanged.

6. Check the page in light and dark at 390px and at lg.

## public-6 [medium] [CONFIRMED] Developer jargon in customer-facing copy
- Screens: public-home, public-how-it-works, public-sustainability, public-about, public-faq
- Files: src/app/(public)/page.tsx, src/app/(public)/how-it-works/page.tsx, src/app/(public)/sustainability/page.tsx, src/app/(public)/about/page.tsx, src/lib/faq.ts
- Problem: 'Sandbox', 'build', 'MVP', 'polling' and 'checked on the server' are engineering terms that a brand or factory owner will not understand. One of them sits in the trust strip under the hero.
- Fix: Keep the disclosures but use plain words. 'Sandbox payments, clearly labelled' becomes 'Test payments only, no real money'. 'This build uses … sandbox payment provider' becomes 'Payments are simulated; no real money moves'. 'checked on the server' becomes 'statuses only move forward in order'. 'not part of this build' / 'Not in this build' become 'planned for a later version' / 'Not yet'. The About facts 'Working MVP' / 'Sandbox provider…' become 'Working prototype' / 'Test payments, no real money', and 'refresh by polling' becomes 'refresh every few seconds'.
- Verifier refinement: Make the proposed copy changes, keeping each disclosure that no real money moves:
- page.tsx:12 becomes "Test payments only, no real money".
- how-it-works:70 becomes "Payments are simulated, so no real money moves."
- how-it-works:156 becomes "Statuses only move forward, one permitted step at a time."
- sustainability:105 becomes "…is planned for a later version."
- about:14-15 become ["Status", "Working prototype"] and ["Payments", "Test payments, no real money"].
- about:70 becomes "payments are simulated (no real money), production updates refresh every few seconds…".
- faq.ts:26 becomes "Payments are currently simulated, so no real money moves."
- faq.ts:51 becomes "Not yet."
Also fix the same wording in privacy/page.tsx:53 and terms/page.tsx:48 ("currently, payments are simulated and no real money is transferred") so the public site uses the same terms everywhere. Afterwards, run a grep for sandbox|this build|MVP|polling over src/app/(public) and src/lib to confirm nothing is left. | Edit only the visible strings. Do not touch identifiers, env values, routes, or the /sandbox-checkout page (tests/e2e/workflow.spec.ts:248 checks its "Sandbox payment provider — no real money is charged" text).
1. src/app/(public)/page.tsx:12, in ASSURANCES: "Sandbox payments, clearly labelled" -> "Test payments only, no real money".
2. src/app/(public)/how-it-works/page.tsx:70: "This build uses a clearly labelled sandbox payment provider." -> "Payments are simulated for now, so no real money moves."
   Line 156: "Statuses only move forward through permitted steps, checked on the server. A project can also be cancelled before production starts." -> "Statuses move forward one step at a time and can't be skipped or reversed. A project can still be cancelled before production starts."
3. src/app/(public)/sustainability/page.tsx:105: "…is a planned extension, not part of this build." -> "…is planned for a later version."
4. src/app/(public)/about/page.tsx:14-15: ["Build", "Working MVP"] -> ["Stage", "Working prototype"]; ["Payments", "Sandbox provider, no real money"] -> ["Payments", "Test payments, no real money"].
   Lines 69-70: "This version is a working MVP: payments run through a sandbox provider (no real money), production updates refresh by polling, and email delivery is not yet configured." -> "This version is a working prototype: payments are simulated (no real money moves), production updates refresh every few seconds, and email notifications are not switched on yet."
5. src/lib/faq.ts:26: "This build uses a sandbox payment provider, so no real money moves." -> "Payments are simulated for now, so no real money moves."
   Line 51: "Not in this build." -> "Not yet."
6. Missed by the finding, same fix: src/app/(public)/privacy/page.tsx:52-53: "Payments in this build run through a sandbox provider: no card details…" -> "Payments are simulated for now: no card details…". src/app/(public)/terms/page.tsx:48: "In this build the provider is a sandbox and no real money is transferred." -> "For now payments are simulated and no real money is transferred."
After editing, run grep -rniE "sandbox|this build|MVP|polling|on the server" "src/app/(public)" src/lib/faq.ts and confirm nothing visible is left. Then re-run tests/e2e/mobile.spec.ts as a sanity check (the copy is a similar length, so layout should not change).

## public-7 [medium] [CONFIRMED] FAQ and Contact are missing from the desktop header
- Screens: public-home, public-for-brands, public-how-it-works
- Files: src/components/site/nav-links.ts, src/components/site/site-header.tsx
- Problem: Someone with a question, or a factory wanting to ask about verification, has to scroll to the very bottom of a long page to find Contact or FAQ.
- Fix: Move `{ href: '/faq', label: 'FAQ' }` from SECONDARY_NAV to the end of PUBLIC_NAV, and add a quiet 'Contact' link (variant="ghost", hidden below lg) before Login in the desktop actions. The mobile sheet then lists FAQ under Platform, with no duplicates.
- Verifier refinement: In nav-links.ts, move `{ href: "/faq", label: "FAQ" }` from SECONDARY_NAV to the end of PUBLIC_NAV. SECONDARY_NAV then holds About and Contact, so the mobile sheet lists FAQ under Platform with no duplicates. In site-header.tsx, in the logged-out desktop actions, add `<Button asChild variant="ghost" className="hidden xl:inline-flex"><Link href="/contact">Contact</Link></Button>` before Login. Use xl rather than lg so the five nav links, Contact, Login and the accent "Start a Project" button don't crowd at 1024px. Optionally show Contact in the logged-in branch too, before "Go to dashboard". Keep "Start a Project" as the only accent action. | In src/components/site/nav-links.ts, move `{ href: "/faq", label: "FAQ" }` from SECONDARY_NAV to the end of PUBLIC_NAV, so SECONDARY_NAV becomes About and Contact. The desktop nav then shows 5 items, and the mobile sheet lists FAQ under Platform and About/Contact under Company, with no duplicates. In src/components/site/site-header.tsx, inside the logged-out branch of the desktop actions (`home` falsy), insert this before the Login button: `<Button asChild variant="ghost" className="hidden xl:inline-flex"><Link href="/contact" aria-current={pathname === "/contact" ? "page" : undefined}>Contact</Link></Button>`. Use xl rather than lg: at 1024px the content width (~944px) fits the extra FAQ link (~916px total) but not FAQ plus Contact (~1,010px). Optionally also show it when `home` is set (signed-in users visiting marketing pages), using the same xl gating. Add `shrink-0` / `whitespace-nowrap` to the nav Link className as a guard against wrapping. Afterwards, check the header at 1024, 1280 and 1440 widths in light and dark, and run tests/e2e/mobile.spec.ts. Do not touch footer links.

## public-9 [low] [CONFIRMED] Text links on the phone auth screens are tiny tap targets
- Screens: auth-login-mobile, auth-register-mobile, auth-forgot-password-mobile
- Files: src/app/(auth)/login/login-form.tsx, src/app/(auth)/login/page.tsx, src/app/(auth)/register/page.tsx, src/app/(auth)/forgot-password/page.tsx, src/components/site/site-footer.tsx
- Problem: The account-recovery and switch-form links fall well below the 40px minimum touch target on phones.
- Fix: Add `inline-flex min-h-10 items-center` to the 'Create an account', 'Sign in' and 'Back to sign in' links and to the footer mailto link. For 'Forgot password?', add `-my-2.5 py-2.5` (or `inline-flex min-h-10 items-center -mt-2.5`) so the tap area grows without moving the label row.
- Verifier refinement: 1) login/page.tsx, register/page.tsx and forgot-password/page.tsx: append `inline-flex min-h-10 items-center` to the switch-form Link's className. Leave the underline classes alone, and keep the surrounding `<p>` as-is so the text still flows inline. 2) login-form.tsx:42: change `absolute right-0 top-0` to `absolute right-0 -top-2.5 inline-flex items-center py-2.5 pl-3`. The label stays at the same visual row, the tap area is 40px tall and a little wider, and it does not cover the label text (a pointer tap on the label would only focus the input anyway). 3) site-footer.tsx:53: add `inline-flex min-h-10 items-center` to the mailto `<a>` and keep `break-all`. You may also need to change the `<dl>`'s `space-y-1` to `space-y-0` so the Email/Location rows don't drift further apart, and add `items-center` to the `flex gap-3` row so the "Email" `<dt>` lines up with the taller link. | login-form.tsx: on the "Forgot password?" Link, add `-mt-3.5 pt-3.5 pb-1.5`. The tap box becomes about 40px tall, running from -14px to 26px. The label stays where it is, and the box stops at the top edge of the password input instead of covering it; the extra height above sits in the form's space-y-5 (20px) gap. Optionally add `pl-2` to widen the target.

login/page.tsx ("Create an account"), register/page.tsx ("Sign in") and forgot-password/page.tsx ("Back to sign in"): add `py-2.5` to each inline Link. Keep them inline; do not use inline-flex. Vertical padding on a normal inline element makes the tap area 40px tall without changing the paragraph's line height. The paragraphs' `pt-5` keeps the extra area clear of the border above.

site-footer.tsx mailto link: either add `py-2.5` the same way, or use `inline-flex min-h-10 items-center` to match the sibling footer links. With inline-flex, keep `break-all` and the `min-w-0` on the dd, then check at 320px that nothing overflows (mobile.spec covers this).

Afterwards, run tests/e2e/mobile.spec.ts and re-measure at 390px; each link should be at least 40px tall.

## public-10 [low] [CONFIRMED] 'Project statuses' jump link hides the heading under the sticky header
- Screens: public-how-it-works
- Files: src/components/site/marketing.tsx
- Problem: The hero's 'On this page → Project statuses' link lands with the section title hidden.
- Fix: In SectionHeading, add `scroll-mt-24` to the h2 className (`cn('type-section scroll-mt-24 text-balance text-ink', …)`).
- Verifier refinement: 1) In src/app/(public)/how-it-works/page.tsx, give the status section its own anchor: `<Section id="statuses" labelledBy="status-title">`. Change the hero link from `href="#status-title"` to `href="#statuses"`. The Section is not sticky and already has `scroll-mt-20`, so the link lands with the section's top padding, the "03 — Statuses" kicker and the title below the 64px header on every breakpoint. 2) Also, as a safety net for other SectionHeading anchors, change the h2 className in SectionHeading (src/components/site/marketing.tsx) to `cn("type-section scroll-mt-24 text-balance text-ink", split && "lg:col-span-7")`. | Keep the reviewer's change in src/components/site/marketing.tsx SectionHeading: `<h2 id={id} className={cn("type-section scroll-mt-24 text-balance text-ink", split && "lg:col-span-7")}>`. Also make the how-it-works jump land on the section so the Kicker ("03 — Statuses") stays visible. In src/app/(public)/how-it-works/page.tsx, change `<Section labelledBy="status-title">` to `<Section id="statuses" labelledBy="status-title">` and the hero link from `href="#status-title"` to `href="#statuses"`. Section already has `scroll-mt-20` plus `py-16` top padding, so the kicker, rule and title all show below the 64px header. Leave the `status-title` id on the h2, since `aria-labelledby` needs it.

## public-11 [low] [CONFIRMED] Audience-specific closing bands still show the other audience's button at equal weight
- Screens: public-for-brands, public-sustainability, public-for-manufacturers
- Files: src/components/site/marketing.tsx
- Problem: After copy written for one audience, the band offers the other audience's sign-up as an equally prominent second action.
- Fix: Give CtaBand an optional `focused` prop (true when a custom title is passed). When it is set, render only the primary button and replace the second with a small inline text link under it ('Run a factory? Join as a manufacturer →' or 'A brand? Start a project →'). Pass it from for-brands, sustainability and for-manufacturers.
- Verifier refinement: Add an explicit `focused?: boolean` prop to CtaBand. Do not infer it from a custom title, because generic pages could pass a title later. When focused, render only the primary accent button (Start a Project or Join as a Manufacturer, chosen by `primary`). Below it, add a small text link in text-ink-inverse-muted with an underline and hover:text-ink-inverse: 'Run a factory? Join as a manufacturer →' (/register?role=manufacturer) when primary="brand", or 'Sourcing for a brand? Start a project →' (/register?role=brand) when primary="manufacturer". Pass `focused` from for-brands, sustainability (primary stays "brand") and for-manufacturers. Leave home, how-it-works, faq and about as they are, with both buttons, because those pages serve both audiences. Keep the inline link at least 44px tall on mobile (py-2 or similar) so it stays easy to tap. | In src/components/site/marketing.tsx, add an explicit optional prop `focused?: boolean` (default false) to CtaBand. Do not infer it from `title`.

When `focused` is false, keep the current two-button layout, so the home, how-it-works, about and FAQ pages stay the same.

When `focused` is true:
- Render only the `primary` audience's button: variant="accent", size="lg", with ArrowRight.
- Below it, render a small Next `<Link>` to the other role. If primary="brand", it goes to /register?role=manufacturer with the text "Run a factory? Join as a manufacturer". If primary="manufacturer", it goes to /register?role=brand with the text "A brand? Start a project".
- Style the link with semantic tokens only, e.g. `text-sm text-ink-inverse-muted underline underline-offset-4 hover:text-ink-inverse`. Add an inline ArrowRight icon marked aria-hidden rather than a literal → character.
- Give the link a tap target of at least 44px (e.g. `inline-flex min-h-11 items-center`) so it still works at 390px.

Keep the band's existing column wrapper, `flex flex-col gap-3 … lg:col-span-4`, so the layout and grid don't shift.

Pass `focused` from three pages:
- src/app/(public)/for-brands/page.tsx (primary brand)
- src/app/(public)/sustainability/page.tsx (primary brand)
- src/app/(public)/for-manufacturers/page.tsx (it already passes primary="manufacturer")

Do not rename or remove the existing button labels or /register?role=… hrefs. Afterwards, re-run tests/e2e/mobile.spec.ts for those three pages to confirm there is no overflow.

## public-12 [low] [CONFIRMED] Home page is about 14 phone screens long and repeats whole sections from the inner pages
- Screens: public-home-mobile, public-home
- Files: src/app/(public)/page.tsx
- Problem: The home page restates content from three inner pages, so visitors scroll a long way between the hero action and the closing action.
- Fix: Replace sections 05 and 06 with one short two-column row: a one-sentence summary of each plus a 'Read more' link to /sustainability and /for-manufacturers#verification. Keep the hero, workflow, audiences, matching, tracking and FAQ as they are.
- Verifier refinement: In src/app/(public)/page.tsx, replace sections 05 (lines 190-240) and 06 (lines 242-265) with a single `<Section tone="surface">` holding one SectionHeading (index="05", eyebrow="Quality and trust", title such as "Standards and verification").

Under it, add a two-column grid (stacked on mobile, lg:grid-cols-2 with a border-l divider) of two short articles. Each article gets an h3, one sentence of text and a descriptive link, using `Button variant="link"` with an ArrowRight icon:

- **(a) Quality and certifications.** "Samples are approved before bulk, inspections follow ISO 2859-1 AQL, and certifications such as GOTS or OEKO-TEX count only after an administrator reviews the certificate." Link: "Our approach to quality and sustainability", pointing to /sustainability.
- **(b) Manufacturer verification.** "An administrator reviews every factory's documents by hand before it gets the verified badge. It is not a quality guarantee, so approve samples first." Link: "How factories get verified", pointing to /for-manufacturers#mfr-steps. Alternatively, add id="verification" to the Getting listed Section in for-manufacturers/page.tsx and link to #verification.

Then:

- Renumber FAQ from "07" to "06".
- Remove imports that become unused (CERTIFICATIONS, StepList, FileText, BadgeCheck, Leaf, ScanSearch if no longer referenced).
- Keep the hero, sections 01-04, FAQ and CtaBand unchanged.
- Use only semantic tokens (text-ink, text-ink-muted, border-line, text-accent). | In src/app/(public)/page.tsx, replace sections 05 and 06 (lines 190-265) with one Section, tone="default", labelledBy="standards-title", index "05", eyebrow "Quality and verification", title "Standards you can hold a factory to". Lay it out as a two-column grid (lg:grid-cols-2) with a border-t border-line-strong divider, matching the old section 05.
- Left column: h3 "Quality and certifications". One sentence: samples are approved before bulk, inspections use ISO 2859-1 AQL, and certifications such as GOTS or OEKO-TEX count only after an administrator reviews them. Then the existing link variant button "Our approach to sustainability" pointing to /sustainability.
- Right column: h3 "How manufacturers are verified". One sentence: an administrator reviews each factory's profile and documents and records approval or rejection with a reason, and only approved factories get the verified badge. Keep the disclaimer as a second short sentence in text-ink-muted: verification is not a guarantee of quality or delivery, so approve samples before bulk. Then a link variant button "How verification works" pointing to /for-manufacturers#verification.
- In src/app/(public)/for-manufacturers/page.tsx, add id="verification" to the 'Getting listed' Section (`<Section id="verification" tone="surface" labelledBy="mfr-steps">`) so the anchor resolves. Section already supports id and has scroll-mt-20.
- Renumber the FAQ SectionHeading index from "07" to "06". Change the FAQ Section to tone="surface" so backgrounds keep alternating: 04 surface, 05 default, 06 surface, then CtaBand.
- Remove the now-unused imports (BadgeCheck, FileText, Leaf, StepList, CERTIFICATIONS, and ScanSearch/ShieldCheck if unused).
- Use semantic tokens only (text-ink, text-ink-muted, border-line, text-accent), with no new accent buttons.
- Leave the hero, workflow, audiences, matching, tracking, FAQ and CtaBand unchanged.
- Check with npm run lint and the mobile e2e spec.

## factory-2 [high] [CONFIRMED] "Requirement changes" shows raw field codes with no old or new values
- Screens: factory-opportunity-detail
- Files: src/app/(app)/opportunities/[id]/page.tsx, src/lib/labels.ts
- Problem: When the brand edits a project, the next-step card says "The brief changed after you sent vN… check that your prices still hold" and sends the factory to the Brief tab. That tab only lists camelCase field names. It never says what the quantity, price or deadline changed from or to.
- Fix: Add a `PROJECT_FIELD_LABEL` map to src/lib/labels.ts (targetUnitPrice → "Target price", maxMoq → "Maximum MOQ", fabricRequirements → "Fabric", requiredCertifications → "Certifications", deadline → "Deliver by", …). In the Requirement changes panel, render each change as its own line, "<Label>: <old, struck through> → <new>", as the brand page does. Use the readable labels in the title and keep the "· after your quotation" marker.
- Verifier refinement: 1. In src/lib/labels.ts, add PROJECT_FIELD_LABEL covering every COMPARED_FIELDS key: name → "Name", category → "Category", description → "Description", quantity → "Quantity", maxMoq → "Maximum MOQ", targetUnitPrice → "Target price", currency → "Currency", deadline → "Deliver by", fabricRequirements → "Fabric", fabrics → "Fabrics", sizes → "Sizes", colors → "Colours", additionalInstructions → "Instructions", requiredCapabilities → "Capabilities", preferredCountry → "Preferred country", requiredCertifications → "Certifications", sustainabilityNotes → "Sustainability notes". Add a fieldLabel(key) fallback that turns camelCase into a sentence-case label.
2. Add one shared formatter, formatChangeValue(field, value), next to it or in src/lib/format. It returns "—" for null. For deadline it parses the ISO string and applies formatDate. For JSON arrays it parses and joins with ", ", mapping enum values such as capabilities and certifications through the existing labels where they exist. It truncates long text (description and instructions) to about 80 characters.
3. In opportunities/[id]/page.tsx, set each Timeline item's title to `${keys.map(fieldLabel).join(", ")} changed` and keep the " · after your quotation" marker. Pass `description` as a <ul> with one <li> per change: <span class="font-medium text-ink">{label}</span>: <span class="line-through text-ink-muted">{old}</span> → {new}. Use only semantic tokens.
4. Reuse the same label and formatter in projects/[id]/page.tsx lines 438-439, so the brand page stops showing camelCase keys and raw ISO or JSON values. Better still, extract a small <RevisionChanges changes=…/> component so both pages render it the same way. | 1. **Shared labels.** In src/lib/labels.ts, export `PROJECT_FIELD_LABEL` covering every key in COMPARED_FIELDS:
   - name → Project name
   - category → Category
   - description → Product description
   - quantity → Quantity
   - maxMoq → MOQ limit
   - targetUnitPrice → Target price
   - currency → Currency
   - deadline → Delivery date
   - fabricRequirements → Fabric
   - fabrics → Fabrics
   - sizes → Sizes
   - colors → Colours
   - additionalInstructions → Instructions
   - requiredCapabilities → Capabilities
   - preferredCountry → Preferred country
   - requiredCertifications → Certifications
   - sustainabilityNotes → Sustainability notes

   Reuse the wording the edit page already uses. Then replace the local FIELD_LABEL in projects/[id]/edit/page.tsx with `{ ...PROJECT_FIELD_LABEL, techPack: "Tech pack" }`.

2. **Value formatter.** Add `formatRevisionValue(field, raw, currency)`, in labels.ts or a small helper beside it:
   - null → "empty"
   - deadline → formatDate(raw)
   - targetUnitPrice → formatMoney(raw, currency)
   - quantity and maxMoq → formatNumber(Number(raw))
   - category → categoryLabel(raw)
   - JSON array strings → JSON.parse(...).join(", "), with a try/catch fallback to raw
   - long free-text fields (description, additionalInstructions, sustainabilityNotes, fabricRequirements) → truncate to about 80 characters
   - the old value of a cleared targetUnitPrice → "removed", not the number

3. **Factory page (opportunities/[id]/page.tsx).** Keep the Timeline.
   - Title: the readable labels joined, e.g. "Quantity, Target price changed", keeping the " · after your quotation" suffix.
   - `description`: a `<ul>` with one `<li>` per change: `<span className="font-medium text-ink">{label}</span>: <span className="line-through">{from}</span> → <span className="text-ink">{to}</span>`.
   - Use only semantic tokens; the description slot is already text-ink-muted.

4. **Brand page (projects/[id]/page.tsx line 438).** Use the same label and formatter in place of the raw `{field}` and raw values, so both sides read the same words.

No server, schema or e2e changes are needed. Afterwards, check that typecheck and lint pass.

## factory-3 [high] [CONFIRMED] Dashboard "Needs your attention" leaves out orders that are waiting on the factory
- Screens: factory-dashboard, factory-dashboard-mobile
- Files: src/app/(app)/dashboard/page.tsx
- Problem: The factory's daily job (uploading stage evidence, submitting samples, recording QC, shipping) never appears as an attention item. The one order item that does appear is something the factory cannot act on, and its link opens the unfiltered order list. Order rows say "On track" rather than that the factory has to do something.
- Fix: In ManufacturerHome, compute `yourTurn = d.actionOrders.filter(o => current status !== "AWAITING_APPROVAL").length`. Replace the `awaiting` attention item with `{ key: "production", tone: "accent", icon: PackageSearch, title: "N orders need a production update", description: "Upload stage evidence, a sample, the QC report or shipment details.", href: "/orders?status=ACTIVE" }`. In the row badge, show <Badge tone="accent" dot>Your turn</Badge> instead of "On track" when the order is neither delayed nor awaiting the brand. The list is capped at 6 orders, so word the count as a lower bound or link to the list.
- Verifier refinement: 1) In src/server/services/dashboard.ts, add an uncapped count rather than deriving it from the 6-row `actionOrders` list. Count the factory's active orders whose current stage is not DELIVERY, whose current-stage milestone is not AWAITING_APPROVAL and is not delayed. Delayed ones already appear in the `delayed` item. Example: `db.order.count({ where: { ...mine, ...ACTIVE_ORDER, currentStage: { not: "DELIVERY" }, NOT: delayedOrder() } })`, then subtract the awaiting-brand ones with a separate count. Or count `productionMilestone` rows where `stage` equals the order's current stage. If that is awkward in Prisma, compute it in JS from an uncapped findMany that selects only id, currentStage and milestones.

2) In ManufacturerHome, replace the `awaiting` attention item with: `{ key: "production", tone: "accent", icon: PackageSearch, title: \`${plural(yourTurn, "order")} need${yourTurn === 1 ? "s" : ""} a production update\`, description: "Upload stage evidence, a sample, the QC report or shipment details.", href: "/orders?status=ACTIVE" }`. Use a "your turn" filter in the href if the orders list supports one.

3) Do not keep "waiting on the brand" in the attention list. Show it in the Production work panel instead, as its description or a Metric.

4) In the row badge, keep Delayed (danger) and Awaiting brand (warning). Show `<Badge tone="accent" dot>Your turn</Badge>` instead of "On track". Optionally show the stage requirement from STAGE_BY_KEY[o.currentStage] as the subline, so the factory sees what to upload.

5) Update the empty-state text of AttentionList to mention production updates as well. Keep one accent action per area: the header's "View opportunities" button is the accent there, and attention items are list rows, not buttons, so this does not conflict. | In ManufacturerHome (src/app/(app)/dashboard/page.tsx), page-only:
1. Use one shared helper so the attention count and the row badges always agree: `const turnOf = (o) => { const m = o.milestones.find(x => x.stage === o.currentStage); return m?.isDelayed ? "delayed" : m?.status === "AWAITING_APPROVAL" ? "brand" : "factory"; }`. Then set `const yourTurn = d.actionOrders.filter(o => turnOf(o) === "factory").length`. Delayed orders are left out because the "behind schedule" item already covers them.
2. Replace the `awaiting` item with `yourTurn > 0 && { key: "production", icon: PackageSearch, tone: "accent", href: "/orders?status=ACTIVE", title: d.actionOrders.length >= 6 ? "Production updates are due on your orders" : `${plural(yourTurn, "order")} ${yourTurn === 1 ? "needs" : "need"} a production update`, description: "Upload stage evidence, a sample, the QC report or shipment details." }`. Placing it right after "delayed" ranks it above revisions and new opportunities, because it is work already committed.
3. In the Production work rows, switch on turnOf(o): delayed -> <Badge tone="danger" dot>Delayed</Badge>; brand -> <Badge tone="warning" dot>Awaiting brand</Badge> (unchanged); factory -> <Badge tone="accent" dot>Your turn</Badge> instead of "On track".
4. Change the AttentionList `clear` text to "You are all caught up. Production updates, new opportunities and revision requests will appear here."
Do not change dashboard.ts or the order list filters. If an exact count is wanted later, add a read-only `db.order.count({ where: { ...mine, ...ACTIVE_ORDER, currentStage: { not: "DELIVERY" }, milestones: { none: { OR: [{ status: "AWAITING_APPROVAL" }, { isDelayed: true, completedAt: null }] } } } })` to manufacturerDashboard. That's optional and not needed for this fix.

## factory-4 [medium] [CONFIRMED] Order and opportunity tabs run off the right edge on phones with no scroll hint
- Screens: factory-order-detail-mobile, factory-opportunity-detail-mobile, factory-opportunities-mobile
- Files: src/components/app/page-tabs.tsx, src/app/(app)/opportunities/[id]/page.tsx, src/app/(app)/opportunities/page.tsx
- Problem: On a phone, "Terms & files" and "Activity" on the order page, and "Why you were matched" on the opportunity page, start off-screen. Only a sideways swipe the user has no reason to try reveals them. Disputes and agreed terms live in the hidden "Terms & files" tab.
- Fix: In page-tabs.tsx, let the list wrap on small screens: change the ul to `flex gap-1 max-sm:flex-wrap sm:min-w-max` and drop overflow-x-auto below sm, or add a right-edge fade (`max-sm:[mask-image:linear-gradient(to_right,black_85%,transparent)]`) while the strip is scrollable. Also shorten the opportunity tab labels in opportunities/[id]/page.tsx to "Quote", "Brief", "Files", "Why matched". Give the /opportunities filter nav the same treatment.
- Verifier refinement: Keep the scroll in PageTabs but make it visible and self-correcting rather than wrapping. Wrapped underline tabs give a broken two-row border-b, and the active tab's underline lands mid-block.

1) In page-tabs.tsx, add a right-edge fade on the nav below sm: `max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]`. Give the ul a matching right padding (`max-sm:pr-8`) so the last tab can scroll fully clear of the fade.

2) Make sure the selected tab is in view on load, since a deep link like ?tab=activity would otherwise render with the active tab off-screen. Use a tiny client child that calls `el.scrollIntoView({block:'nearest', inline:'nearest'})` on the `[aria-current=page]` link, or put `scroll-ml-4` on the links plus that effect.

3) Shorten the opportunity tab labels to "Your quote", "Brief", "Files", "Why matched". This keeps "Your" so the primary-action tab stays clear, and the four fit in about 330px with no scrolling.

4) On /opportunities, shorten the view labels ("Not quoted", "Open", "All") or reuse PageTabs so the strip gets the same fade.

Use semantic tokens only. A mask needs no colour token, so it works in both themes. | In src/components/app/page-tabs.tsx, wrap on phones and keep sideways scrolling from sm up:
- nav: `className="mb-6 border-b border-line sm:overflow-x-auto"` (remove the `-mx-4 px-4 sm:mx-0 sm:px-0` bleed, since it was only there for the edge-to-edge scroll)
- ul: `className="flex flex-wrap gap-x-1 sm:flex-nowrap sm:min-w-max"`
- Keep the Link classes as they are. On a wrapped row the selected tab's 2px accent underline still marks it. Optionally add `max-sm:min-h-10` to keep two rows compact.
- Update the doc comment from "Scrolls sideways on narrow screens instead of wrapping" to "Wraps onto a second row on phones so no tab is hidden".

Do the same for the /opportunities view switcher in src/app/(app)/opportunities/page.tsx:47-50:
- nav: drop `-mx-4 px-4 overflow-x-auto` below sm
- ul: `flex flex-wrap gap-x-5 gap-y-1`

Do NOT rename the opportunity tabs to "Quote" / "Why matched". tests/e2e/workflow.spec.ts:124/127 depends on "Why you were matched" and "Your quotation", and the tab body heading matches the tab label. If a shorter label is still wanted, only "Tech pack & files" -> "Tech pack" is safe (no test references it).

Check by running tests/e2e/mobile.spec.ts and workflow.spec.ts, then re-capture brand-order-detail-mobile and a factory opportunity detail at 390px to confirm all tabs appear on at most two rows.

## factory-5 [medium] [CONFIRMED] "Withdraw quotation" sits at the top of the quote form, and its warning is wrong for drafts
- Screens: factory-opportunity-detail, factory-opportunity-detail-mobile
- Files: src/app/(app)/opportunities/[id]/page.tsx, src/components/quotations/quotation-form.tsx
- Problem: An irreversible, lock-out action is the most prominent control at the top of the pricing form. For a draft it is the only "get rid of this" control, and its confirmation text describes the wrong consequence.
- Fix: Remove `actions` from the Panel and render the withdraw trigger in the QuotationForm footer as a low-emphasis `variant="ghost"` button, left-aligned and away from Send. Pass `isDraft` to WithdrawQuotationButton. For drafts, use the title "Discard and stop quoting?" and the description "Your draft is deleted and you cannot quote on this project again. The brand is not notified." Keep the current copy for sent quotations.
- Verifier refinement: 1. In opportunities/[id]/page.tsx, remove `actions` from the "Your quotation" Panel. Pass `footer={quotation ? <WithdrawQuotationButton quotationId={quotation.id} projectId={id} isDraft={!quotation.submittedAt} /> : undefined}`. Panel already has a muted footer row (primitives.tsx line 328), which sits below the form, outside it and away from Send.
2. Do not render the trigger inside QuotationForm's own footer. That footer is inside the quote `<ActionForm>`, and the dialog's `ActionForm` is a React-tree child even though it is portalled.
3. In quotation-form.tsx, change WithdrawQuotationButton to take `isDraft?: boolean`.
   - Trigger: `<Button type="button" variant="ghost" size="sm">`.
   - Label: "Discard draft" when `isDraft`, otherwise "Withdraw quotation".
   - For drafts, use the title "Discard and stop quoting?", the description "Your draft is deleted and you cannot quote on this project again. The brand is not notified." and the confirm label "Discard and stop quoting".
   - For sent quotations, keep the current title, description and confirm label.
   - Keep `tone="danger"` in both cases.
4. Optional: the draft copy says "deleted", but the record is set to WITHDRAWN, not deleted. Consider the wording "Your draft is discarded…". | In `src/app/(app)/opportunities/[id]/page.tsx`, remove `actions=` from the "Your quotation" Panel. Pass the button through the Panel's existing `footer` slot instead. That slot renders after the body, so it stays outside QuotationForm's `<form>`:

`footer={quotation ? <WithdrawQuotationButton quotationId={quotation.id} projectId={id} isDraft={!quotation.submittedAt} /> : undefined}`

The footer is a muted secondary row below Send, which keeps it away from Send.

In `src/components/quotations/quotation-form.tsx`, change WithdrawQuotationButton to take `isDraft: boolean`:
- Trigger: `<Button type="button" variant="ghost" size="sm">`. Label it "Discard draft" when `isDraft`, otherwise "Withdraw quotation" with the Undo2 icon.
- Dialog title: "Discard this draft and stop quoting?" when `isDraft`, otherwise keep "Withdraw this quotation?".
- Description when `isDraft`: "Your draft is discarded and you cannot quote on this project again. The brand never saw it and is not notified." Otherwise keep the current copy.
- `confirmLabel`: "Discard and stop quoting" or "Withdraw quotation". Keep `tone="danger"`.

Do not render the trigger inside QuotationForm's ActionForm. React submit events bubble through the dialog portal into the outer form's `onSubmit`.

Optional hardening: add `e.stopPropagation()` in ActionForm's `onSubmit` so nested dialog forms can never trigger a parent form's submit.

No server or e2e changes are needed.

## factory-6 [medium] [CONFIRMED] Factory dashboard says the same thing three times and has three competing accent actions
- Screens: factory-dashboard, factory-dashboard-mobile, factory-dashboard-dark
- Files: src/app/(app)/dashboard/page.tsx
- Problem: The top of the dashboard repeats facts instead of ranking them. Several equally loud accent items point to the same place, which goes against the design-system rule of one accent action per area.
- Fix: Show the verification Alert only while `status === "PENDING"`, since it is informational with no action. For UNSUBMITTED and REJECTED, rely on the attention item, and put `d.profile?.verificationNote` into its description when REJECTED. Change the header action to `variant="outline"`, or drop it while the attention list contains the `new` item. In the metric strip, leave the tone off "New opportunities" so the accent stays on the attention row.
- Verifier refinement: In ManufacturerHome (src/app/(app)/dashboard/page.tsx):
1. Show the Alert only when `status === "PENDING"`. Make it `{status === "PENDING" && <Alert tone="info" className="mb-6">Your verification request is being reviewed…</Alert>}` and remove the REJECTED/UNSUBMITTED branches and the "Go to verification" link.
2. For the `verify` attention item, use this description: `status === "REJECTED" ? (d.profile?.verificationNote ? `Not approved: ${d.profile.verificationNote}` : "Verification was not approved. Review the notes on your factory profile.") : "Only verified factories are matched to brand projects."`. That keeps the rejection reason on screen.
3. Header action: render `variant={attention.some((a) => a.key === "new") ? "outline" : "accent"}`, or simply always use "outline", so the accent signal is the attention row.
4. Metric "New opportunities": remove the `tone` prop. Keep warning/danger on Revision requests and Delayed orders, because those tones mean status, not an action.
5. Leave the header StatusBadge and the Production work empty-state copy as they are. They are low-key context, and the badge is the persistent status indicator. | In ManufacturerHome (src/app/(app)/dashboard/page.tsx):
(1) Render the Alert only when `status === "PENDING"`, tone "info", with the existing "being reviewed" text and no link.
(2) For the `verify` attention item, use this description: `status === "REJECTED" ? \`Not approved: ${d.profile?.verificationNote ?? "see your factory profile"}. Fix the documents and request again.\` : "Only verified factories are matched to brand projects."`. Keep the title and tone as they are, so the rejection reason stays visible.
(3) Header action: always use `variant="outline"` for "View opportunities" (keep the FileSearch icon and the /opportunities href). Don't remove it conditionally, because a header that keeps changing is harder to learn. This leaves no accent button in the header. The attention list holds the ranked next step, and the sidebar already links to Opportunities.
(4) Production work empty state when unverified: change the description to "Orders appear here once your factory is verified and a brand accepts a quotation." with no action. This avoids a fourth verification call to action while the panel still explains why it is empty.
(5) Metric strip: removing `tone="accent"` from "New opportunities" is optional, but doing it is consistent. Leave the warning and danger tones on Revision requests and Delayed orders: they are status signals, not actions, and they mirror the brand dashboard.
Keep the header StatusBadge. Don't change the services or the attention-item keys and hrefs. Run the dashboard in all three states (UNSUBMITTED, PENDING, REJECTED) in light and dark to check the result.

## factory-7 [medium] [UNVERIFIED] Verification checklist does not lead to the upload form, and the upload defaults to the wrong document type
- Screens: factory-profile, factory-profile-mobile
- Files: src/app/(app)/factory/page.tsx, src/components/profile/document-forms.tsx
- Problem: A new factory sees a disabled primary button and a checklist, but no link to where the upload happens. The form may be a long scroll below. Once a registration exists, the next upload (usually a certificate) still defaults to "Business registration".
- Fix: Add `id="upload-document"` to the "Add a document" block. Make checklist step 1 a link ("Upload your business registration ↓" pointing to #upload-document) while it is not done. Pass `defaultType={hasRegistration ? "CERTIFICATION" : "BUSINESS_REGISTRATION"}` to UploadDocumentForm and use it as the initial state.
- Verifier refinement: 1) document-forms.tsx: change the signature to `export function UploadDocumentForm({ defaultType = "BUSINESS_REGISTRATION" }: { defaultType?: "BUSINESS_REGISTRATION" | "CERTIFICATION" | "OTHER" })` and use `useState(defaultType)`. ActionForm has resetOnSuccess, but `type` is controlled state, so it survives the reset. After a successful registration upload, the server re-render passes a new defaultType that the existing state ignores. To pick it up, put `key={hasRegistration ? "cert" : "reg"}` on the form in page.tsx so it remounts when registration status changes. 2) page.tsx line 116: `<UploadDocumentForm key={hasRegistration ? "cert" : "reg"} defaultType={hasRegistration ? "CERTIFICATION" : "BUSINESS_REGISTRATION"} />`. 3) Optional, low priority: add `id="upload-document"` and `scroll-mt-24` to the "Add a document" div (line 114). While !hasRegistration, render step 1's text as `<a href="#upload-document" className="font-medium text-accent-strong underline-offset-4 hover:underline">Upload your business registration document</a>`, using semantic tokens only. Do not add a "↓" glyph. On mobile and xl the form is already directly below, so the link is only a convenience.

## factory-8 [medium] [UNVERIFIED] Order header noise pushes the factory's task below the fold on phones
- Screens: factory-order-detail-mobile
- Files: src/components/orders/order-detail.tsx
- Problem: On a 390px phone the factory has to scroll past low-value metadata and a stacked fact strip before reaching the form for the current stage, the one thing it came to do.
- Fix: Show the location MetaItem only to the brand and admin (`!isFactory && location`). Remove the "Updates every 30 seconds" MetaItem; the live refresh can stay silent. Make the fact strip `grid-cols-3` at every width, using the existing small type so the facts fit on one row. In the header, give RaiseDisputeButton `size="sm"` and a ghost or link style so it does not read as the page's main action.

## factory-9 [medium] [UNVERIFIED] Disputes on an order are only visible inside the "Terms & files" tab
- Screens: factory-order-detail, factory-order-detail-mobile
- Files: src/components/orders/order-detail.tsx
- Problem: Nothing outside a tab whose name has nothing to do with disputes says an order has an open or in-review dispute. On phones that tab is also off-screen (see the tab-overflow finding).
- Fix: In order-detail.tsx, compute `openIssues = order.issues.filter(i => ["OPEN","IN_REVIEW"].includes(i.status))`. Give the details tab `count: order.issues.length` and `attention: openIssues.length > 0`, and rename it "Terms, files & disputes" or "Details". When openIssues exist, render an `<Alert tone="warning">` above the progress panel: "A dispute is open on this order", with a link to /disputes/<id>.

## factory-10 [low] [UNVERIFIED] Choosing evidence files does not upload them, and the next button stays disabled with no clear reason
- Screens: factory-order-detail, factory-order-detail-mobile
- Files: src/components/orders/order-forms.tsx, src/components/orders/next-step.tsx
- Problem: After picking photos, the factory sees the loud accent button still disabled. The small outline button that actually uploads is easy to miss, and "Add evidence" does not say that it uploads the chosen files.
- Fix: Rename the submit button to "Upload selected files". Change the disabled-state hint to "Choose files above and press Upload selected files first."

## factory-11 [low] [UNVERIFIED] Brief and match tabs show duplicate rows and internal jargon
- Screens: factory-opportunity-detail
- Files: src/app/(app)/opportunities/[id]/page.tsx
- Problem: Two near-identical labels make the factory wonder which fabric to quote against, and an internal algorithm id means nothing to a factory owner.
- Fix: Merge the two rows into one "Fabric" row: show fabricRequirements and, if fabrics differ, append " · " + fabrics.join(", "). Replace the match Panel description with "How your profile scored against this brief."

## factory-12 [low] [UNVERIFIED] "New — not quoted" empty state says "No opportunities here yet" after the factory has quoted on everything
- Screens: factory-opportunities
- Files: src/app/(app)/opportunities/page.tsx
- Problem: The message implies the factory has never been matched, when it has simply quoted on all open projects. The offered action skips the most useful view, "Open for quotes", which holds its pending quotes.
- Fix: When `filter === "new"`, use the title "You have quoted on every open opportunity" and the action <Link href="/opportunities">See open opportunities</Link>. Keep the current copy for the open and all filters.

## crosscutting-1 [high] [UNVERIFIED] Section and status tab strips hide tabs off-screen on phones, and the selected tab can be scrolled out of view
- Screens: brand-order-detail-mobile, brand-projects-mobile, brand-payments, factory-opportunity-detail, brand-project-detail
- Files: src/components/app/page-tabs.tsx, src/components/orders/order-parts.tsx
- Problem: On phones, half the record's sections can't be found, and after a deep link the user can't tell which tab they are on.
- Fix: Add a small client wrapper (e.g. `ScrollStrip` in src/components/app/page-tabs.tsx) that both PageTabs and StatusTabs render their <ul> inside. (1) On mount, call `el.querySelector('[aria-current=page]')?.scrollIntoView({inline:'nearest', block:'nearest'})`. (2) Track scrollLeft against scrollWidth - clientWidth and show `pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-canvas` (and a left one when scrolled) only while more tabs exist in that direction. Also give StatusTabs the same `-mx-4 px-4 sm:mx-0 sm:px-0` bleed that PageTabs has.

## crosscutting-2 [high] [UNVERIFIED] Form errors appear at the top of long forms, out of sight of the submit button
- Screens: factory-profile-mobile, brand-project-new, brand-settings
- Files: src/components/forms/action-form.tsx
- Problem: After a failed submit there is no visible feedback where the user is looking.
- Fix: In ActionForm, add a useEffect on `state` that runs when `state.status === 'error'`. It focuses the first `[aria-invalid=true]` control inside `ref.current` (with `scrollIntoView({block:'center'})`), or, when there are no field errors, scrolls the summary Alert into view and focuses it (give the Alert `tabIndex={-1}` and a ref). Optionally also call `toast.error(state.message)` so the outcome is visible at once.

## crosscutting-3 [high] [UNVERIFIED] FilterBar always shows a search box, even on lists that ignore it
- Screens: factory-quotations
- Files: src/components/app/filter-bar.tsx, src/app/(app)/quotations/page.tsx
- Problem: A visible search control does nothing.
- Fix: In FilterBar, render the search field only when the page opts in. Make `searchLabel` optional with no default and render the field only when it is set (every page that does support q already passes one). The Quotations page then shows only the status filter.

## crosscutting-4 [medium] [UNVERIFIED] Equivalent list pages filter by status with different controls, and Projects shows two at once
- Screens: brand-projects, brand-projects-mobile, brand-orders, admin-orders, factory-quotations, brand-payments, admin-factories, brand-order-detail
- Files: src/components/orders/order-parts.tsx, src/components/app/page-tabs.tsx, src/components/app/filter-bar.tsx, src/app/(app)/projects/page.tsx, src/app/(app)/orders/page.tsx, src/app/(app)/quotations/page.tsx, src/app/(app)/opportunities/page.tsx, src/app/(app)/disputes/page.tsx, src/app/(app)/notifications/page.tsx
- Problem: The same job (narrowing a list by status) works differently on every list page, and Projects gives two controls for one filter.
- Fix: Move StatusTabs to src/components/app/ (re-export from order-parts for now) and give it the same type size, height and left alignment as PageTabs. Use it as the single status filter on Projects, Orders, Quotations, Opportunities, Disputes and Notifications. Remove the inline navs and the duplicate `selects` status dropdown on projects/page.tsx. Keep FilterBar for the text search only.

## crosscutting-5 [medium] [UNVERIFIED] FilterBar shows 'Clear' when nothing is filtered, and Clear jumps to a different view
- Screens: admin-factories
- Files: src/components/app/filter-bar.tsx
- Problem: Clear claims a filter is applied when none is, and it resets more than the search.
- Fix: In FilterBar, compute `active` from `q` and `selects` only, leaving out `hidden`. Point Clear at basePath plus the hidden params, e.g. `const keep = new URLSearchParams(Object.entries(hidden).filter(([,v]) => v) as [string,string][]); href={keep.size ? `${basePath}?${keep}` : basePath}`.

## crosscutting-6 [medium] [UNVERIFIED] Filter dropdowns don't apply until Apply is pressed, and the filter bar takes three full rows on phones
- Screens: brand-projects-mobile, admin-orders, factory-quotations, brand-orders
- Files: src/components/app/filter-bar.tsx
- Problem: Changing a dropdown looks like it should filter at once but doesn't, and on phones the bar pushes results below the fold.
- Fix: Add a tiny client `AutoSubmitSelect` (Select with `onChange={e => e.currentTarget.form?.requestSubmit()}`) and use it for FilterBar selects. Keep Apply for the search box and for no-JS. On phones lay out the search and Apply in one row (`grid grid-cols-[1fr_auto] gap-2`) instead of three stacked full-width rows.

## crosscutting-7 [medium] [UNVERIFIED] The 'Your next step' card is built three times and looks different on order, project and opportunity pages
- Screens: brand-order-detail, brand-order-detail-mobile, brand-project-detail, factory-opportunity-detail
- Files: src/components/app/primitives.tsx, src/components/orders/next-step.tsx, src/components/quotations/opportunity-parts.tsx, src/app/(app)/projects/[id]/page.tsx
- Problem: The one pattern meant to tell users what to do next has no consistent look, so it doesn't work as a recognisable anchor.
- Fix: Add one `NextStepCard` primitive to src/components/app/primitives.tsx with props (tone: action | waiting | done | stopped, icon, title, body, actions, footer, children for multi-task content), modelled on the opportunity version. Replace the three local versions with it, keeping the existing content and actions. Use the accent tint only for tone='action'.

## crosscutting-8 [low] [UNVERIFIED] Global search box gives no scope, competes with page search boxes, and empties itself on the results page
- Screens: brand-projects, admin-orders, admin-factories, factory-quotations, brand-dashboard
- Files: src/components/app/app-shell.tsx
- Problem: Users can't tell which search box to use or what the global one covers, and they lose their query on the results page.
- Fix: In AppShell, make the placeholder role-aware: BRAND/ADMIN 'Search projects and orders', MANUFACTURER 'Search opportunities and orders'. Prefill the input from the current query when on /search (`const sp = useSearchParams(); defaultValue={pathname === '/search' ? sp.get('q') ?? '' : ''}` with `key={sp.get('q')}`, wrapped in Suspense if the build requires it).

## crosscutting-9 [low] [UNVERIFIED] Metric values in the same row misalign when a label wraps on phones
- Screens: brand-dashboard-mobile, admin-overview-mobile
- Files: src/components/app/primitives.tsx
- Problem: Figures in a row don't line up, so the strip reads as ragged and harder to scan.
- Fix: In Metric, make the cell `flex flex-col` (add it to the `cell` class) and give the label span `flex-1` (or the value `mt-auto`), so values and hints align to the bottom across cells in the same grid row.

## crosscutting-10 [low] [UNVERIFIED] Phone top bar spends a slot on an ambiguous theme icon while search is squeezed, and the account menu lacks the profile link
- Screens: brand-order-detail-mobile, brand-projects-mobile, admin-overview-mobile, factory-profile-mobile, brand-settings
- Files: src/components/app/app-shell.tsx
- Problem: An ambiguous, rarely used control takes prime space on phones, and the account menu leaves out the user's own profile.
- Fix: In AppShell, hide the top-bar ThemeToggle below sm (`className="max-sm:hidden"`) and add a Theme radio group (Light/Dark/System, reusing THEME_OPTIONS and setThemePreference) inside the account dropdown. Add a menu item linking to the profile page for the role ('/profile' Company profile for BRAND, '/factory' Factory profile for MANUFACTURER) above Settings.


<!-- confirmed 37, unverified 16 -->
