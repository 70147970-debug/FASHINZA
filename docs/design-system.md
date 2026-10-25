# Fashinza design system — "Atelier Ops"

The reference for every screen in the app and the marketing site. The UI should feel like a premium,
daily-use operations tool for fashion manufacturing: calm, precise, editorial. Not a generic dashboard.

- Tokens: `src/app/globals.css` (`@theme`)
- UI kit: `src/components/ui/*`
- App building blocks: `src/components/app/primitives.tsx`
- Shell: `src/components/app/app-shell.tsx` (navigation in `nav.ts`)
- Status label/tone maps: `src/lib/labels.ts`

## 1. Principles

1. **Quiet by default, loud only when it matters.** Neutral surfaces, navy text, one accent (teal). Colour
   appears for status and for values that need attention, never for decoration.
2. **One card, many facts.** Group related numbers in one `MetricStrip` instead of many tiles. Group related
   fields in one `Panel` instead of many small cards.
3. **Hierarchy through type and space.** Page title, then section titles (`PageSection` / `Panel`), then
   body. Avoid extra borders, icons-in-boxes and backgrounds to create hierarchy.
4. **Zeros are not news.** Zero metrics are muted; attention tones are applied conditionally.
5. **Same thing, same look.** One status mapping (`lib/labels.ts`), one badge, one table style, one empty state.
6. **Phones are first-class.** No page-level horizontal scroll at 320px. Touch targets at least 40px.

## 2. Tokens

Never hard-code hex values in components. Use the Tailwind utilities generated from the tokens.

### Colour

| Token (utility suffix) | Hex | Use |
| --- | --- | --- |
| `navy` | #14263D | Primary: headings, primary buttons, current step |
| `navy-800` / `navy-700` | #1A304C / #1C3352 | Hover / active of navy |
| `navy-50`, `navy-100` | #EEF2F7 / #DFE6EF | Info tint, subtle hover |
| `slate-blue` (= `info`) | #456078 | Secondary brand, info status, eyebrows |
| `teal` | #168C83 | Accent for **fills, icons, borders, focus ring, indicators** only (4.1:1 on white) |
| `teal-700` | #11706A | Accent **text** and accent buttons (5.9:1) |
| `teal-800`, `teal-100`, `teal-50` | | Hover, selection, accent tint (active nav, empty-state tile) |
| `canvas` = `surface-muted` | #F7F8FA | Page background, table header, muted footers |
| `card` = `surface` | #FFFFFF | Cards, sidebar, top bar |
| `surface-sunken` | #F1F4F7 | Inset wells |
| `ink` | #202938 | Body text |
| `muted` | #657286 | Secondary text (4.9:1) — smallest text allowed in muted |
| `subtle` | #8792A3 | Large text only (muted zero metrics), placeholders, decorative icons (3.1:1) |
| `line` | #E2E7EE | Default border / divider |
| `line-subtle` | #EDF0F4 | Row dividers inside cards and tables |
| `line-strong` | #CFD7E1 | Control borders, upcoming steps |
| `neutral-25 … 900` | | Navy-tinted greys (`neutral-100` hover bg, `neutral-500` icons, `neutral-700` nav text) |
| `success` / `success-700` / `-100` / `-50` | #16835D / #0F6B4B | Fill-dot-icon / small text / border / tint |
| `warning` / `warning-700` / `-100` / `-50` | #C27A19 / #8A5510 | same pattern |
| `danger` / `danger-700` / `-100` / `-50` | #C43D4B / #A3303D | same pattern (error) |

Rule of thumb: `bg-{tone}-50` + `text-{tone}-700` for tinted labels; `bg-{tone}` for dots and fills.

### Radius, shadow, layout

- `rounded-sm` 4px · `rounded-md` 6px (controls, buttons) · `rounded-lg` 10px (cards) · `rounded-xl` 12px (dialogs) · `rounded-full` (badges, avatars).
- `shadow-card` (barely there; every card) · `shadow-raised` (hover lift, rarely) · `shadow-pop` (menus, dialogs, toasts).
- `max-w-app` 1280px (app content) · `max-w-site` 1200px (marketing, via `.container-page`) · `w-sidebar` / `pl-sidebar` 248px.
- Spacing: 4px grid. Card padding 20px (`p-5`, `p-4` on phones). Gaps between cards 24px (`gap-6`). Page sections 32px apart (`space-y-8`).

## 3. Type

Inter for body, forms and tables; Manrope for display and headings (`font-display`). Headings `h1–h4` are navy, Manrope 600 by default.

| Role | Class | Size |
| --- | --- | --- |
| Marketing display | `type-display` | 36px phone → 56px lg |
| Marketing section title | `type-section` | 28px → 40px |
| App page title (h1) | `type-title` (PageHeader does this) | 22px → 26px |
| Card / section title | `type-heading` | 15px semibold |
| Page section title | `font-display text-base font-semibold` (PageSection) | 16px |
| Metric value | `type-metric` | 24px semibold, tabular |
| Body (app) | `text-sm` | 14px |
| Body (marketing) | `text-base` | 16px |
| Secondary / labels | `text-[13px]` | 13px |
| Caption | `text-xs` | 12px |
| Eyebrow | `eyebrow text-slate-blue` (marketing: `eyebrow text-teal-700`) | 12px upper, tracked |
| Table header / group label | `label-caps text-muted` | 11px upper, tracked |
| Numbers | add `tabular` | tabular figures |

The `type-*`, `eyebrow` and `label-caps` utilities never set colour; add a `text-*` colour.
Do **not** invent `text-<name>` font-size tokens: `cn()`/tailwind-merge treats unknown `text-*` names as
colours and will drop your colour class. Use `text-[13px]` for one-off sizes.

## 4. Components (UI kit — `@/components/ui/*`)

### Button — `ui/button`

```tsx
<Button>Save</Button>                                   // primary (navy), md
<Button variant="accent"><Plus /> Create production project</Button>
<Button variant="outline" size="sm">Export</Button>
<Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button>
<Button variant="danger">Cancel order</Button>
<Button variant="link" size="sm" asChild><Link href="/payments">All payments</Link></Button>
<Button loading>Saving</Button>                          // spinner + disabled + aria-busy
```

- Variants: `primary` (navy; default action), `accent` (teal-700; create/advance), `outline` (secondary),
  `ghost` (tertiary/toolbars), `subtle` (quiet filled), `danger`, `inverse` (white on navy bands), `link` (inline, no height/padding).
- Sizes: `sm` 32px · `md` 36px · `lg` 44px (marketing) · `icon` 36px square. Below 640px every size is at least 40px tall.
- One `primary` or `accent` button per area. Icons are 16px automatically.
- `asChild` renders the child (e.g. `<Link>`) with button styles. `buttonVariants({variant,size})` for custom elements.

### Badge — `ui/badge`

```tsx
<Badge tone="accent">Fastest</Badge>
<Badge tone="warning" dot>Sandbox mode</Badge>
```
Tones: `neutral`, `info`, `accent`, `success`, `warning`, `danger`, `navy` (solid), `outline`. `teal` = legacy alias of `accent`.
Status values should go through **StatusBadge** (below), which adds the dot.

### Alert — `ui/alert`

```tsx
<Alert tone="info" title="Verification pending">We will notify you when it is reviewed.</Alert>
```
Tones `info | success | warning | error`. `error` uses `role="alert"`, others `role="status"`. Optional `title`.

### Card — `ui/card`

`Card`, `CardHeader` (`divided` adds a bottom border), `CardTitle` (`as="h2"|"h3"|"h4"`), `CardDescription`,
`CardAction`, `CardBody`, `CardFooter`. In app pages prefer **Panel**.

### Form controls — `ui/input`, `ui/field`, `ui/label`

```tsx
<Field id="name" label="Project name" required hint="At least 3 characters">
  <Input name="name" />
</Field>
<Field id="category" label="Category"><Select name="category">…</Select></Field>
<Field id="notes" label="Notes"><Textarea name="notes" /></Field>
```
- Controls are 36px (40px on phones), 1px `line-strong` border, teal focus ring, red border when `aria-invalid`.
- `Field` wires label, hint, error and `aria-*`; errors come from the enclosing `ActionForm` automatically.
  It appends " (optional)" when not required — keep it, tests rely on label text.
- `fieldClass` is exported for custom controls. Checkboxes/radios get the teal-700 accent colour globally.
- `ChipSelect` (`components/forms/chip-select`) for multi-select chips.

### Dialog — `ui/dialog`, ActionDialog — `components/forms/action-dialog`

```tsx
<ActionDialog
  trigger={<Button variant="accent">Approve factory</Button>}
  title="Approve factory"
  description="The factory becomes visible to brands."
  action={approveFactory}
  hidden={{ id }}
  confirmLabel="Approve factory"
  tone="accent"
/>
```
`DialogContent` takes `title` (accessible name), `description`, `size="sm|md|lg"`. The action row is a muted
footer. Initial focus goes to the first control (Close is last in DOM order).

### Sheet — `ui/sheet`

Side drawer: `<SheetContent title="Menu" side="left|right" hideTitle?>`. Used by the app and site navigation.

### Avatar — `ui/avatar`

`<Avatar name="Ayesha Khan" />` (round, teal tint) · `<Avatar name={org} shape="square" tone="navy" />`. Sizes `sm|md|lg`. Decorative (aria-hidden): always show the name as text too.

### Toasts — `ui/toaster`

`toast.success("Saved")` / `toast.error(...)`. Top-right below the top bar; white card, coloured icon.

## 5. App building blocks (`@/components/app/primitives`)

### PageHeader

```tsx
<PageHeader
  eyebrow="Order"
  title={project.name}
  breadcrumbs={[{ href: "/orders", label: "Orders" }]}
  meta={<StatusBadge map={ORDER_STATUS} value={order.status} />}
  description="Produced by Demo Knitwear Mills"
  metaRow={<><MetaItem icon={Hash}>{order.reference}</MetaItem><MetaItem icon={CalendarDays}>Due {date}</MetaItem></>}
  actions={<Button variant="accent">…</Button>}
/>
```
- `meta` sits in the same parent as the `<h1>` (tests read the heading's parent for the status). Use it for the status badge / reference chip.
- `metaRow` is a row of `MetaItem`s (icon + text) under the description.
- Actions are right-aligned on desktop and stretch full width on phones.

### MetricStrip + Metric

```tsx
<MetricStrip label="Summary">
  <Metric label="Projects seeking quotes" value={d.activeProjects} href="/projects?status=QUOTING" icon={ClipboardList} hint={drafts ? `${drafts} drafts` : undefined} />
  <Metric label="Delayed orders" value={d.delayedOrders} href="/orders?delayed=1" tone={d.delayedOrders ? "danger" : undefined} />
  <Metric label="Payments due" value={due} href="/payments" tone={due ? "warning" : undefined} />
</MetricStrip>
```
- One card divided by hairlines. `columns` defaults to the number of metrics (max 8) and wraps to 2–4 per row on smaller screens.
- Zero values are muted automatically (`muted` to force). `tone`: `neutral | accent | success | warning | danger` colours the value and tints the icon (a dot is shown only when the metric has no icon). Apply tones conditionally.
- On phones the value steps down to 20px and wraps instead of clipping; an odd last metric spans both columns of the 2-up phone grid.
- Every metric with `href` links to its filtered list; an arrow appears on hover.
- `StatCard` still exists for old code; do not use it in redesigned pages.

### Panel (the standard card)

```tsx
<Panel id="payments" title="Payment schedule" description="Milestone payments" actions={<Button variant="link" size="sm" asChild><Link href="/payments">All payments</Link></Button>}>
  …
</Panel>
<Panel title="Recent projects" bodyClassName="p-0">{/* edge-to-edge list or table */}</Panel>
<Panel title="Totals" footer={<Button size="sm">Pay now</Button>}>…</Panel>
```
`id` sets the section anchor and `aria-labelledby` (tests use `#payments`, `#sampling`). Header has a divider; body padding 20px (16px on phones). Any padding class in `bodyClassName` (`p-0`, `px-…`, `py-…`) replaces the default padding at every breakpoint.
Header links (`actions`) are `Button variant="link" size="sm"` with a trailing `ArrowRight`.

### PageSection

Titled group **outside** cards to structure long pages:
```tsx
<PageSection id="production" title="Production" description="Stages, samples and QC" actions={…}>
  <div className="grid gap-6 lg:grid-cols-2">…</div>
</PageSection>
```

### StatusBadge / SandboxBadge

```tsx
<StatusBadge map={PROJECT_STATUS} value={p.status} />   // dot + label, tone from lib/labels.ts
<SandboxBadge />                                        // warning "Sandbox mode"
```
Tone semantics (one mapping, everywhere):

| Tone | Meaning | Examples |
| --- | --- | --- |
| neutral | not started, draft, closed, withdrawn | Draft, Not started, Scheduled, Closed |
| info | moving normally / in progress | In production, In progress, Processing, In review |
| accent | open in the marketplace / in transit | Submitted, Receiving quotes, Ready to ship, Shipped |
| success | done, approved, paid, verified | Delivered, Accepted, Paid, Verified |
| warning | waiting on a decision, due | Quality check, Revision requested, Due, Under review |
| danger | failed, rejected, blocked, cancelled | Cancelled, Declined, Failed, Suspended |

### EmptyState

```tsx
<EmptyState icon={PackageSearch} title="No active orders" description="Accepted quotations become orders here." action={<Button variant="accent" asChild><Link href="/opportunities">Browse opportunities</Link></Button>} />
<EmptyState variant="plain" … />   // inside a Panel: no card chrome
```
40px teal-50 icon tile, title, one sentence, one primary action.

### DescriptionList (DetailList)

```tsx
<DescriptionList columns={3} items={[{ label: "Quantity", value: "500" }, { label: "Notes", value: notes, full: true }]} />
<DescriptionList layout="rows" items={[{ label: "Subtotal", value: money }, { label: "Total", value: total }]} />
```
`grid` (default): label above value, 1–4 columns. `rows`: label left, value right, hairline dividers (side cards, money breakdowns). `DetailList` is the legacy alias.

### Tables: DataTable + `.data-table`

```tsx
<DataTable
  label="Orders"
  cards={<MobileCardList>{items.map((o) => <MobileCard key={o.id} href={`/orders/${o.id}`} title={o.project.name} badge={<StatusBadge map={ORDER_STATUS} value={o.status} />} meta={`${o.reference} · ${party}`} />)}</MobileCardList>}
>
  <table className="data-table">
    <thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col" className="num">Value</th></tr></thead>
    <tbody>
      <tr><td><Link className="cell-primary" href="…">{name}</Link><p className="text-xs text-muted">{ref}</p></td><td>…</td><td className="num">{money}</td></tr>
    </tbody>
  </table>
</DataTable>
```
- `.data-table`: muted header row with 11px uppercase labels, 14px rows with hairline dividers, hover tint. `num` = right-aligned tabular; `cell-primary` = navy medium name/link.
- The container scrolls horizontally inside itself. With `cards`, the table is `display:none` below md and the cards are `display:none` from md — never both in the accessibility tree. The cards are rendered after the table in the DOM, so `getByText(...).first()` finds the visible desktop row first. Keep real `<table>` at desktop (tests use `getByRole("table")`).
- `ProgressBar value={3} max={8} label="3 of 8 stages complete"` for inline progress.

### StageStepper

```tsx
const steps = STAGES.map((s, i) => ({
  key: s.stage,
  label: s.label,
  state: i < current ? "done" : i === current ? "current" : "upcoming",
  hint: completedAt ? formatDate(completedAt) : undefined,
  attention: isDelayed && i === current,
}));
<Panel><StageStepper stages={steps} label="Production stages" /></Panel>
```
Horizontal from md, vertical below. Done = teal check, current = navy ring (warning ring with `attention`), upcoming = numbered grey.
It does **not** set `aria-current="step"`: the milestone list on the order page owns `li[aria-current="step"]` (e2e tests depend on there being exactly one).

### Timeline / ActivityTimeline

```tsx
<Timeline items={[{ id, title: "Sample approved", meta: "24 Oct 2026 · Ayesha Khan", tone: "success", icon?: Check }]} empty="No activity yet." />
<ActivityTimeline items={activity} />   // record activity log (from components/app/activity-timeline)
```

### AnchorNav

`<AnchorNav items={[{ href: "#milestones", label: "Milestones" }, { href: "#payments", label: "Payments", count: 3 }]} />` — in-page links for long record pages; scrolls inside itself on phones.

### Others

- `FilterBar` (components/app/filter-bar): GET filter form (search + selects + Apply/Clear). Keep its props.
- `Pagination`: "Page x of y · n results" + Previous / Next.
- `NotificationList`: unread dot, title, message, time.
- `PageSkeleton variant="dashboard|list|detail"`, `Skeleton className="h-4 w-32"`: loading states that match the layout.

## 6. Layout rules

**App shell.** Light 248px sidebar (white, right border): monogram + wordmark, workspace block (organisation + role), grouped nav (11px caps labels), active item = teal-50 bg + teal-700 text + 2px teal bar, user block with sign-out at the bottom. 56px top bar: search (placeholder "Search", accessible name "Search projects and orders", `/` focuses it), notifications with unread count, account menu. Below lg the sidebar is a drawer ("Open navigation").

**Page structure** (inside `<main>`, max 1280px, 32px padding desktop / 16px phones):

1. `PageHeader`
2. Optional alerts (`mb-6`)
3. Optional `MetricStrip`, or a `StageStepper` panel on order pages
4. Content: either one column of `PageSection`s, or a main/side grid: `grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]` with `space-y-6` columns.

**Responsive.** Use `minmax(0, …)` / `min-w-0` for grid and flex children holding long text (globals also sets `min-width: 0` on `main .grid > *`). Long tables: `DataTable` with `cards`, or let it scroll inside its card. Check 320px: no page-level horizontal overflow. Interactive targets ≥40px on phones (buttons and controls do this automatically).

**Images.** Uploaded thumbnails go in fixed-size boxes: `size-16 overflow-hidden rounded-md border border-line bg-surface-muted` with `<img className="size-full object-cover">`, so broken images do not break the layout.

**Motion.** Only 150ms colour/background transitions (`transition-colors duration-150`). No entrance animations. `prefers-reduced-motion` is respected globally.

**Marketing.** `.container-page` (1200px), hero copy left + composed product-UI mock right (label example data as example), `bg-dot-grid` only in the hero at very low opacity, sections alternate white / canvas with `py-16 lg:py-24`, navy CTA band, navy footer. No stock photos, invented customers, testimonials, logos, certifications or statistics. No emoji.

## 7. Do / Don't

| Do | Don't |
| --- | --- |
| Use `bg-navy`, `text-muted`, `border-line`, `bg-surface-muted` | Hard-code hex or arbitrary colours |
| Use `text-teal-700` for teal text and links | Put `text-teal` on small text (fails AA) |
| One `MetricStrip` per page, muted zeros | Rows of separate tiles full of zeros |
| `StatusBadge` with the shared maps | Ad-hoc coloured spans for statuses |
| `Panel` with `bodyClassName="p-0"` for lists/tables | Cards nested inside cards |
| `EmptyState` with one action | Empty cards with a lone "No data" line |
| Keep button, label, heading and dialog texts identical (e2e tests) | Rename visible strings without grepping `tests/e2e` |
| Real `<table>` at desktop; cards on phones via `DataTable cards` | Page-level horizontal scroll |
| `text-[13px]` for a one-off size | New `--text-*` tokens with non t-shirt names |
| Server components; `"use client"` only for interaction | Client components for static layout |
