# Fashinza design system — "Editorial Atelier"

The reference for every screen in the app and the marketing site. Fashion magazine meets precise operations
tool: ink on warm ivory, Fraunces display type, hairline rules, sharp tailored geometry and one disciplined
terracotta accent. Light and dark themes are both first-class.

- Tokens and type utilities: `src/app/globals.css`
- Theme system: `src/components/theme/*` (inline no-flash script, `ThemeSync`, `ThemeToggle`, `ThemeSegmented`)
- UI kit: `src/components/ui/*`
- App building blocks: `src/components/app/primitives.tsx`
- Shell: `src/components/app/app-shell.tsx` (navigation in `nav.ts`)
- Status label/tone maps: `src/lib/labels.ts`

## 1. Principles

1. **Ink on ivory.** Most of the UI is `text-ink` on `bg-canvas` / `bg-surface`. Colour is information, not
   decoration.
2. **Accent discipline.** Terracotta is used for the single most important action on a screen
   (`variant="accent"`), active navigation, focus rings, progress and key highlights. Never as background
   decoration, never on several buttons in one area.
3. **Structure from lines, not shadows.** 1px hairlines (`border-line`) define cards and sections. Only
   popovers, menus, dialogs and toasts float (`shadow-pop`).
4. **Tailored geometry.** Controls 4px (`rounded-md`), cards 6px (`rounded-lg`), dialogs 8px (`rounded-xl`).
   Buttons are crisp rectangles; badges are small 3px-radius tags. No pills except avatars and dots.
5. **Editorial type.** Fraunces for display, page and section titles and big numbers; Inter for everything
   you read or enter in volume: body, forms, tables, labels, data.
6. **Generous whitespace, deliberate rules.** Use space first; use a thin rule (`border-line`,
   `border-line-strong` for section rules) where a magazine would.
7. **Zeros are not news.** Zero metrics are muted; attention tones are applied conditionally.
8. **Same thing, same look.** One status mapping (`lib/labels.ts`), one badge, one table style, one empty state.
9. **Phones are first-class.** No page-level horizontal scroll at 320px. Touch targets at least 40px.

## 2. Theming contract

- Every colour is a **semantic token**. The light values live in `@theme`; the dark values override the same
  CSS variables on `html[data-theme="dark"]`. Use the Tailwind utilities (`bg-surface`, `text-ink-muted`,
  `border-line`, `ring-focus` …) and everything works in both themes automatically.
- **Never** use hex values, `bg-white`, `text-white`, `bg-black`, `text-black`, Tailwind palette colours
  (`bg-amber-50`, `text-emerald-700`, `bg-stone-100` …) or the retired "Atelier Ops" names (section 9) in components.
  Those names no longer exist, so they compile to nothing and the element silently loses its colour.
- `dark:` targets `[data-theme=dark]`. Use it only for the rare case no token expresses (e.g. an image
  treatment). If you find yourself writing `dark:` for colours, a token is missing: ask for one.
- Opacity modifiers work on tokens (`bg-accent/15`, `bg-surface-muted/50`, `ring-accent/20`).
- In inline styles or arbitrary values use the variables: `var(--color-accent)`, `var(--color-line)`.
- The theme is `data-theme="light" | "dark"` on `<html>`. It is resolved before first paint by the inline
  script in `app/layout.tsx` from `localStorage["fz-theme"]` (`light | dark | system`, default `system`,
  which follows the OS and keeps following OS changes). `ThemeSync` (root layout) re-applies it after
  hydration and syncs other tabs. Without JavaScript the CSS follows `prefers-color-scheme`.
- Switching theme disables transitions for one frame (`.fz-theme-switching`), so nothing animates.

### ThemeToggle

```tsx
import { ThemeToggle, ThemeSegmented } from "@/components/theme/theme-toggle";

<ThemeToggle />                 // icon button, accessible name "Theme"; menu with Light / Dark / System
<ThemeToggle align="start" />   // menu alignment ("start" | "center" | "end", default "end")
<ThemeSegmented />              // inline Light / Dark / System toggle buttons (group "Colour theme"), for settings
```
The app top bar already contains `ThemeToggle`. The public site header places it next to the menu button.
Do not create another control named "Theme".

## 3. Colour tokens

Utility suffix → use. Ratios are WCAG contrast, verified with a script (light / dark).

### Surfaces

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | #F6F1EA | #151210 | Page background, sidebar, top bar |
| `surface` | #FFFDF9 | #1D1915 | Cards, panels, tables, inputs |
| `surface-muted` | #EFE8DE | #231E19 | Parchment wells: card footers, neutral badges, quiet fills |
| `surface-sunken` | #EBE3D7 | #181411 | Inset wells, image boxes |
| `surface-raised` | #FFFDF9 | #241F1A | Popovers, menus, dialogs, sheets, toasts |
| `surface-hover` | #F3EDE4 | #2A241E | Hover tint for rows, items, ghost buttons |
| `inverse` | #1C1917 | #2A2420 | Contrasting band (marketing CTA band, footer). Text on it: `text-ink-inverse` |

### Text

| Token | Light | Dark | Ratios | Use |
| --- | --- | --- | --- | --- |
| `ink` | #1C1917 | #F1EBE3 | ≥13.8 everywhere | Primary text, headings, values |
| `ink-muted` | #6B5E4F | #B3A898 | 5.2–6.2 / 6.6–8.0 | Secondary text, labels, captions (smallest text allowed) |
| `ink-subtle` | #8F8170 | #857A6C | 3.1–3.7 / 3.9–4.4 | **≥3:1 only**: decorative icons, chevrons, large display numerals. Never small text |
| `ink-placeholder` | #7A6C5B | #958978 | 5.0 / 5.1 on `surface` | Input placeholders (`placeholder:text-ink-placeholder`) |
| `ink-inverse` | #F6F1EA | #F1EBE3 | 15.6 / 12.9 on `inverse` | Text on `bg-inverse` |
| `ink-inverse-muted` | #B3A898 | #B3A898 | 7.5 / 6.5 on `inverse` | Secondary text on `bg-inverse` |

### Lines

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `line` | #E4DCD0 | #342D26 | Default border and divider (cards, header rules). Also the global default border colour |
| `line-subtle` | #ECE5DA | #2A241F | Row dividers inside cards and tables |
| `line-strong` | #CFC4B5 | #4A4138 | Emphasised rules (table header rule, PageSection rule), outline buttons, upcoming steps |
| `line-control` | #968876 | #766A5A | Form-control borders (3.4/3.1 light, 3.3/3.5 dark: meets 3:1 non-text contrast) |

### Actions and accent

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` / `primary-hover` / `primary-fg` | #1C1917 / #3A322B / #FFFDF9 | #F1EBE3 / #DCD3C7 / #1C1917 | Primary button (ink in light, ivory in dark). 17.2 / 14.8 |
| `accent` | #B4532A | #E0794A | Terracotta **fills**: accent button, active-nav bar, progress, dots, focus. 4.9 on surface (light) |
| `accent-hover` | #97431F | #EB8D60 | Hover of accent fills |
| `accent-strong` | #97431F | #EE9467 | Terracotta **text** and links. 6.6 on surface, 5.9 on canvas / 7.5, 8.0 |
| `accent-soft` | #F5E6DC | #3A2419 | Selected / active background tint |
| `accent-line` | #E5C3AF | #6A3B25 | Border around accent-soft areas |
| `accent-fg` | #FFFDF9 | #1C1917 | Text on `bg-accent` (4.9 / 5.8) |
| `focus` | #B4532A | #E0794A | Focus rings (`ring-focus`, `outline-focus`; global `:focus-visible` already uses it) |
| `overlay` | ink 42% | near-black 62% | Modal / drawer scrim (`bg-overlay`) |

### Status

Each tone has four steps. **base** = fills, dots, icons (≥3:1); **-strong** = text (≥4.5:1 on surface and on
its soft tint); **-soft** = tint background; **-line** = border on a tint.

| Tone | base (L / D) | -strong (L / D) | -soft (L / D) | -line (L / D) | -strong on -soft |
| --- | --- | --- | --- | --- | --- |
| `success` (olive-forest) | #4D7A35 / #86AE6E | #3B6328 / #A3C68C | #E9EFDF / #1F2A1A | #C9D8B6 / #3A4D2F | 6.0 / 7.8 |
| `warning` (ochre) | #B98222 / #D9A441 | #82560D / #E8BE6A | #F7ECD6 / #2F2614 | #E8D2A4 / #5A4620 | 5.5 / 8.5 |
| `danger` (brick) | #B23B2E / #E0705F | #9A2F24 / #F0907F | #F7E3DE / #36191A | #E9C1B8 / #663029 | 6.1 / 6.9 |
| `info` (ink-blue) | #4A6684 / #8FA8C4 | #3B5672 / #AFC3DA | #E5EAF0 / #1B2330 | #C5D0DC / #34445A | 6.3 / 8.8 |

`danger-fg` (#FFFDF9 / #1C1917) is the text on a `bg-danger` button (5.8 / 5.5).

Rules of thumb: tinted label = `bg-{tone}-soft text-{tone}-strong`; dot/icon/fill = `bg-{tone}` / `text-{tone}`;
callout = `border-{tone}-line bg-{tone}-soft`.

## 4. Radius, elevation, layout

- `rounded-xs` 2px (bars, tiny marks) · `rounded-sm` 3px (badges, chips-in-chips, kbd) · `rounded-md` 4px
  (controls, buttons, nav items) · `rounded-lg` 6px (cards, panels, tables) · `rounded-xl` 8px (dialogs,
  large callouts) · `rounded-full` (avatars, dots only).
- `shadow-card` is **none** (kept so old classes are harmless). `shadow-raised` is a 1px whisper (rare).
  `shadow-pop` for menus, popovers, dialogs, sheets and toasts only.
- `max-w-app` 1280px (app content) · `max-w-site` 1216px (marketing via `.container-page`, gutters 16/24/40px)
  · `w-sidebar` / `pl-sidebar` 248px.
- Spacing: 4px grid. Card padding 20px (`p-5`, `p-4` on phones). Gaps between cards 24px (`gap-6`). Page
  sections 32–40px apart (`space-y-8`/`space-y-10`). App main padding 40px desktop / 16px phones.

## 5. Type

Fraunces Variable (`font-display` / `font-serif`; weight + optical size axes, roman and italic) and Inter
Variable (`font-sans`, default). `h1–h4` default to Fraunces 500 in `ink`; add `font-sans` to a tiny
label-style heading. Avoid heavy weights in Fraunces: use 400–500 (`font-normal`/`font-medium`), 600 at most.

| Role | Class | Spec |
| --- | --- | --- |
| Marketing display | `type-display` | Fraunces 500, 40px → 64px lg, tracking −0.025 → −0.035em |
| Marketing section title | `type-section` | Fraunces 500, 30px → 44px lg |
| App page title (h1) | `type-title` (PageHeader does this) | Fraunces 500, 26px → 32px sm |
| Card / panel title | `type-heading` | Fraunces 500, 18px |
| Page section title | PageSection | Fraunces 500, 20px over a `line-strong` rule |
| Metric value | `type-metric` | Fraunces 450, 30px, lining tabular figures |
| Editorial accent | `font-display italic` | Fraunces italic for a word or phrase in marketing headlines (sparingly) |
| Body (app) | `text-sm` | Inter 14px |
| Body (marketing) | `text-base` / `text-lg` | Inter 16–18px, `leading-7` |
| Secondary / labels | `text-[13px]` | Inter 13px |
| Caption | `text-xs` | Inter 12px |
| Eyebrow | `eyebrow text-ink-muted` (marketing: `eyebrow text-accent-strong`) | Inter 11px 600 caps, 0.14em |
| Table header / group label | `label-caps text-ink-muted` | Inter 11px 600 caps, 0.1em |
| Numbers | `tabular` | tabular figures (tables, money, counts) |

The `type-*`, `eyebrow` and `label-caps` utilities never set colour; add a `text-*` colour.
Do **not** invent `text-<name>` font-size tokens: `cn()`/tailwind-merge treats unknown `text-*` names as
colours and will drop your colour class. Use `text-[13px]` for one-off sizes.

## 6. Components (UI kit — `@/components/ui/*`)

### Button — `ui/button`

```tsx
<Button>Save</Button>                                   // primary (ink; ivory in dark), md
<Button variant="accent"><Plus /> Create production project</Button>   // the ONE key action on a screen
<Button variant="outline" size="sm">Export</Button>
<Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button>
<Button variant="danger">Cancel order</Button>
<Button variant="link" size="sm" asChild><Link href="/payments">All payments <ArrowRight /></Link></Button>
<Button variant="inverse" size="lg">Create an account</Button>   // on bg-inverse bands
<Button loading>Saving</Button>                          // spinner + disabled + aria-busy
```
- Variants: `primary` (ink), `accent` (terracotta), `outline` (hairline on surface), `ghost`, `subtle`
  (parchment fill), `danger` (brick), `inverse` (ivory on `bg-inverse`), `link` (accent-strong text, no box).
- Sizes: `sm` 32px · `md` 36px · `lg` 44px (marketing) · `icon` 36px square. Below 640px every size is ≥40px.
- 4px radius, no shadow. One `primary` or `accent` per area. Icons are 16px automatically.
- `asChild` renders the child with button styles. `buttonVariants({variant,size})` for custom elements.

### Badge — `ui/badge`

```tsx
<Badge tone="accent">Fastest</Badge>
<Badge tone="warning" dot>Sandbox mode</Badge>
```
Small 3px-radius soft tint, 22px tall, 12px medium text. Tones: `neutral`, `info`, `accent`, `success`,
`warning`, `danger`, `ink` (solid), `outline`.
Status values go through **StatusBadge** (adds the dot).

### Alert — `ui/alert`

```tsx
<Alert tone="info" title="Verification pending">We will notify you when it is reviewed.</Alert>
```
Tones `info | success | warning | error`: soft tint + `-line` border + base-tone icon. `error` is
`role="alert"`, others `role="status"`.

### Card — `ui/card`

`Card` (surface, hairline, 6px, no shadow), `CardHeader` (`divided`), `CardTitle` (Fraunces `type-heading`,
`as="h2"|"h3"|"h4"`), `CardDescription`, `CardAction`, `CardBody`, `CardFooter`. In app pages prefer **Panel**.

### Form controls — `ui/input`, `ui/field`, `ui/label`

```tsx
<Field id="name" label="Project name" required hint="At least 3 characters">
  <Input name="name" />
</Field>
<Field id="category" label="Category"><Select name="category">…</Select></Field>
<Field id="notes" label="Notes"><Textarea name="notes" /></Field>
```
- Controls: 36px (40px on phones), 4px radius, `surface` fill, `line-control` border, `ink-placeholder`
  placeholders, terracotta focus border
  + soft ring, brick border when `aria-invalid`. Labels Inter 13px medium ink; required asterisk in
  `accent-strong`; " (optional)" in `ink-muted` (keep it — tests rely on label text).
- `fieldClass` is exported for custom controls. Checkboxes/radios use the terracotta accent colour globally.
- `ChipSelect` (`components/forms/chip-select`): 4px-radius toggle chips; selected = `accent-soft` +
  `accent` border + `accent-strong` text.

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
`DialogContent` takes `title` (Fraunces 20px, accessible name), `description`, `size="sm|md|lg"`. 8px radius,
`surface-raised`, `shadow-pop`, `bg-overlay` scrim. The ActionDialog action row is a parchment footer.
Initial focus goes to the first control (Close is last in DOM order).

### Sheet — `ui/sheet`

Side drawer: `<SheetContent title="Menu" side="left|right" hideTitle?>` on `surface-raised` (the app nav
drawer passes `bg-canvas` to match the sidebar).

### Avatar — `ui/avatar`

`<Avatar name="Ayesha Khan" />` (round, accent tint, Fraunces initials) · `<Avatar name={org} shape="square" tone="ink" />`.
Tones `accent | ink | neutral`. Sizes `sm|md|lg`. Decorative: show the name as text too.

### Toasts — `ui/toaster`

`toast.success("Saved")` / `toast.error(...)`. Top-right below the top bar; raised surface, hairline border,
status-coloured icon. Follows the theme.

## 7. App building blocks (`@/components/app/primitives`)

APIs are unchanged from the previous system; only the look changed.

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
- Eyebrow `ink-muted`, Fraunces title 26/32px, description `ink-muted`.
- `meta` sits in the same parent as the `<h1>` (tests read the heading's parent for the status).
- Actions are right-aligned on desktop and stretch full width on phones.

### MetricStrip + Metric

```tsx
<MetricStrip label="Summary">
  <Metric label="Projects seeking quotes" value={d.activeProjects} href="/projects?status=QUOTING" icon={ClipboardList} hint={drafts ? `${drafts} drafts` : undefined} />
  <Metric label="Delayed orders" value={d.delayedOrders} href="/orders?delayed=1" tone={d.delayedOrders ? "danger" : undefined} />
</MetricStrip>
```
- One hairline-divided card. Label 12px `ink-muted` with a 14px icon; value Fraunces 30px (`type-metric`).
- Zero / empty values render `ink-muted` automatically (`muted` to force); quiet, but still 4.5:1 because
  values shrink below 24px on phones and can be phrases ("Not shipped yet"). `tone`: `neutral | accent | success |
  warning | danger` colours the value (`-strong`) and the icon. Apply tones conditionally.
- With `href` the cell links to its filtered list; a terracotta arrow appears on hover.
- `StatCard` still exists for old code; do not use it in redesigned pages.

### Panel (the standard card)

```tsx
<Panel id="payments" title="Payment schedule" description="Milestone payments" actions={<Button variant="link" size="sm" asChild><Link href="/payments">All payments <ArrowRight /></Link></Button>}>
  …
</Panel>
<Panel title="Recent projects" bodyClassName="p-0">{/* edge-to-edge list or table */}</Panel>
<Panel title="Totals" footer={<Button size="sm">Pay now</Button>}>…</Panel>
```
Surface card, Fraunces 18px title over a hairline, 20px body (16px phones), optional parchment footer.
`id` sets the anchor and `aria-labelledby` (tests use `#payments`, `#sampling`). Any padding class in
`bodyClassName` replaces the default padding at every breakpoint.

### PageSection

Titled group **outside** cards: a `line-strong` rule, then a Fraunces 20px title, description and actions.
```tsx
<PageSection id="production" title="Production" description="Stages, samples and QC" actions={…}>…</PageSection>
```

### StatusBadge / SandboxBadge

```tsx
<StatusBadge map={PROJECT_STATUS} value={p.status} />   // dot + label, tone from lib/labels.ts
<SandboxBadge />                                        // warning "Sandbox mode"
```

| Tone | Meaning | Examples |
| --- | --- | --- |
| neutral | not started, draft, closed, withdrawn | Draft, Not started, Scheduled, Closed |
| info | moving normally: in progress, in production, in transit | In production, Processing, Ready to ship, Shipped |
| accent | open in the marketplace, waiting for factories (terracotta, so only these) | Submitted, Receiving quotes |
| success | done, approved, paid, verified | Delivered, Accepted, Paid, Verified |
| warning | waiting on a decision, due | Quality check, Revision requested, Due, Under review |
| danger | failed, rejected, blocked, cancelled | Cancelled, Declined, Failed, Suspended |

### EmptyState

```tsx
<EmptyState icon={PackageSearch} title="No active orders" description="Accepted quotations become orders here." action={<Button variant="accent" asChild><Link href="/opportunities">Browse opportunities</Link></Button>} />
<EmptyState variant="plain" … />   // inside a Panel: no card chrome
```
44px hairline icon tile (canvas fill, `ink-muted` icon), Fraunces title, one sentence, one action.

### DescriptionList (DetailList)

`grid` (default): 12px `ink-muted` label above an ink value, 1–4 columns. `rows`: label left, value right,
hairline dividers (side cards, money breakdowns). `DetailList` is the legacy alias.

### Tables: DataTable + `.data-table`

```tsx
<DataTable label="Orders" cards={<MobileCardList>{items.map((o) => <MobileCard key={o.id} href={`/orders/${o.id}`} title={o.project.name} badge={<StatusBadge map={ORDER_STATUS} value={o.status} />} meta={`${o.reference} · ${party}`} />)}</MobileCardList>}>
  <table className="data-table">
    <thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col" className="num">Value</th></tr></thead>
    <tbody><tr><td><Link className="cell-primary" href="…">{name}</Link><p className="text-xs text-ink-muted">{ref}</p></td><td>…</td><td className="num">{money}</td></tr></tbody>
  </table>
</DataTable>
```
- `.data-table`: editorial header (no fill; 11px tracked caps in `ink-muted` over a `line-strong` rule),
  14px rows with `line-subtle` dividers, `surface-hover` row hover. `num` = right-aligned tabular;
  `cell-primary` = ink medium name/link with a terracotta underline on hover.
- The container scrolls horizontally inside itself. With `cards`, the table is hidden below md and the cards
  from md; cards render after the table in the DOM. Keep a real `<table>` at desktop (tests use
  `getByRole("table")`).
- `ProgressBar value={3} max={8} label="3 of 8 stages complete" tone="accent|ink|success|warning|danger"`:
  4px bar on a `line` track. `accent` (default) for the key progress on a screen, `ink` for neutral progress.
  In lists (projects, orders): `ink` while running, `success` once delivered, `warning` when delayed.

### StageStepper

Horizontal from md, vertical below. Done = ink circle with check + ink connector, current = terracotta ring
with `accent-soft` halo (ochre with `attention`), upcoming = numbered hairline circle. It does **not** set
`aria-current="step"`: the order page's milestone list owns `li[aria-current="step"]`.

### Timeline / ActivityTimeline

Hairline connector; 24px nodes with a tone dot (`bg-{tone}`) or icon (`text-{tone}-strong`).

### AnchorNav

In-page links over a hairline; hover underlines in terracotta. Counts are quiet parchment tags.

### Others

- `FilterBar`: GET filter form (search + selects + Apply/Clear). Keep its props.
- `Pagination`: "Page x of y · n results" + Previous / Next (outline buttons).
- `NotificationList`: terracotta unread dot, title, message, time.
- `PageSkeleton variant="dashboard|list|detail"`, `Skeleton className="h-4 w-32"` (parchment blocks).

## 8. Layout rules

**App shell.** Ivory (`canvas`) 248px sidebar separated by a hairline: serif wordmark "Fashinza" with a
terracotta full stop; workspace block between two hairlines (eyebrow "Brand workspace" + organisation in
Fraunces); grouped nav (11px caps labels in `ink-muted`); items `ink-muted` → hover `surface-hover`;
**active item** = ink text on `surface` with a hairline inset, terracotta icon and a 3px terracotta bar at the
sidebar edge; user block with sign-out at the bottom. 64px top bar on `canvas`: search (placeholder "Search",
accessible name "Search projects and orders", `/` focuses it), `ThemeToggle`, notifications (terracotta count),
account menu. Below lg the sidebar is a drawer ("Open navigation").

**Page structure** (inside `<main>`, max 1280px, 40px padding desktop / 16px phones):
1. `PageHeader` 2. optional alerts (`mb-6`) 3. optional `MetricStrip`, or a `StageStepper` panel on order
pages 4. content: one column of `PageSection`s, or a main/side grid
`grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]` with `space-y-6` columns.

**Responsive.** `minmax(0, …)` / `min-w-0` for grid and flex children holding long text (globals also sets
`min-width: 0` on `main .grid > *`). Check 320px: no page-level horizontal overflow. Targets ≥40px on phones.

**Images.** Uploaded thumbnails go in fixed-size boxes:
`size-16 overflow-hidden rounded-md border border-line bg-surface-sunken` with `<img className="size-full object-cover">`.

**Motion.** 150–200ms colour/opacity transitions only (`transition-colors duration-150`). No entrance
animations. `prefers-reduced-motion` is respected globally; theme switches never animate.

**Marketing.** `.container-page` (1216px). Editorial: large Fraunces headlines (`type-display`,
`type-section`, an italic phrase at most), asymmetric grids (e.g. `lg:grid-cols-12` with 7/5 splits),
numbered sections ("01", "02" in `eyebrow` or Fraunces), thin rules between sections (`border-t border-line`),
sections alternating `bg-canvas` / `bg-surface`, CTA band on `bg-inverse` with `text-ink-inverse` and a
`variant="inverse"` or `accent` button, footer on `bg-inverse` or canvas with hairlines. Product-UI mocks use
the same tokens and keep their visible "Example data" labels. `bg-dot-grid` only as a whisper in the hero.
No stock photos, invented customers, testimonials, logos, certifications or statistics. No emoji. No
gradients beyond a whisper.

## 9. Migration notes (old "Atelier Ops" class → current class)

Historical reference for the move from the previous navy/teal look. The old names (`navy*`, `teal*`,
`slate-blue`, `card`, `muted`, `subtle`, `neutral-*`, the `-700/-100/-50` status shades and the re-pointed
`white` / `black`) have been **deleted** from globals.css; nothing in `src` uses them. If you port old code,
translate it with this table. The mapping applies to every prefix (`bg-`, `text-`, `border-`, `ring-`,
`divide-`, `outline-`, `fill-`, `stroke-`, …) and to opacity modifiers (`bg-teal/10` → `bg-accent/10`).

| Old | New | Notes |
| --- | --- | --- |
| `text-navy` (headings, names, values) | `text-ink` | |
| `bg-navy` (solid button / band) | `bg-primary` (button-like) or `bg-inverse` (band) | text on it: `text-primary-fg` / `text-ink-inverse` |
| `bg-navy` + `text-white` | `bg-primary text-primary-fg` | |
| `bg-navy-800`, `bg-navy-700` (hover) | `bg-primary-hover` | |
| `bg-navy-50`, `bg-navy-100` | `bg-surface-muted` | `border-navy-100` → `border-line` |
| `bg-navy/35` (scrim) | `bg-overlay` | |
| `text-slate-blue` (eyebrow) | `text-ink-muted` (app) / `text-accent-strong` (marketing) | info status text → `text-info-strong` |
| `bg-slate-blue` (bars, dots) | `bg-info` (status) or `bg-primary` (neutral data bar) | |
| `text-teal-700`, `text-teal-800` | `text-accent-strong` | links, accent text |
| `text-teal` | `text-accent` (icons only) | small text must be `text-accent-strong` |
| `bg-teal` | `bg-accent` | fills, dots, progress |
| `bg-teal-700` + `text-white` | `bg-accent text-accent-fg` | prefer `<Button variant="accent">` |
| `bg-teal-800` | `bg-accent-hover` | |
| `bg-teal-50` | `bg-accent-soft` | `/40`, `/60` modifiers stay |
| `bg-teal-100`, `border-teal-100` | `bg-accent-soft`, `border-accent-line` | |
| `border-teal`, `ring-teal`, `outline-teal` | `border-accent`, `ring-focus` / `ring-accent`, `outline-focus` | |
| `bg-white` | `bg-surface` | popovers/menus: `bg-surface-raised` |
| `bg-white/90` etc. (sticky bars) | `bg-canvas/90` or `bg-surface/90` | |
| `text-white` | `text-primary-fg` / `text-accent-fg` / `text-ink-inverse` / `text-danger-fg` | depends on the fill under it |
| `text-white/60`…`/85` on navy bands | `text-ink-inverse-muted` (or `text-ink-inverse`) | |
| `border-white/10`, `bg-white/10` on bands | `border-ink-inverse/15`, `bg-ink-inverse/10` | |
| `ring-white` (badge cut-outs) | `ring-canvas` or `ring-surface` | match the background |
| `bg-canvas` | `bg-canvas` | unchanged name, new colour |
| `bg-card` | `bg-surface` | |
| `text-muted` | `text-ink-muted` | |
| `text-subtle` | `text-ink-subtle` | ≥3:1 only (large text, icons) |
| `text-ink`, `border-line`, `border-line-subtle`, `border-line-strong`, `bg-surface`, `bg-surface-muted` | same | unchanged names |
| `bg-surface-muted` as hover | `hover:bg-surface-hover` | |
| `shadow-card`, `shadow-raised` on cards | remove | borders define structure |
| `rounded-full` on buttons/chips/badges | `rounded-md` (controls) / `rounded-sm` (tags) | avatars and dots stay round |
| `neutral-25`, `neutral-50` | `bg-surface`, `bg-surface-muted` | |
| `bg-neutral-100` | `bg-surface-muted` (fill) / `hover:bg-surface-hover` (hover) | |
| `border-neutral-200/300/400` | `border-line` / `border-line-strong` / `border-line-control` | |
| `text-neutral-500` | `text-ink-subtle` (icons) | |
| `text-neutral-600/700` | `text-ink-muted` | |
| `text-neutral-800/900` | `text-ink` | |
| `bg-neutral-300/400` (dots, tracks) | `bg-line-strong` / `bg-ink-subtle` | |
| `text-success-700` / `warning-700` / `danger-700` | `text-success-strong` / `text-warning-strong` / `text-danger-strong` | |
| `bg-success-50` / `warning-50` / `danger-50` / `info-50` | `bg-success-soft` / `bg-warning-soft` / `bg-danger-soft` / `bg-info-soft` | |
| `border-success-100` / `warning-100` / `danger-100` | `border-success-line` / `border-warning-line` / `border-danger-line` | |
| `bg-success`, `bg-warning`, `bg-danger`, `bg-info`, `text-success`… | same | base = fills/dots/icons |
| `text-danger` on small text | `text-danger-strong` | |
| `ring-warning-50`, `ring-navy-50` | `ring-warning-soft`, `ring-accent-soft` | |
| `var(--color-teal)`, `var(--color-neutral-100)`, `var(--color-navy)` | `var(--color-accent)`, `var(--color-line)`, `var(--color-ink)` | inline styles |
| Badge `tone="teal"` / `"navy"`, Avatar `tone="teal"` / `"navy"`, ProgressBar `tone="navy"` | `"accent"` / `"ink"` | old values removed |
| `font-display … font-semibold` headings | `font-display … font-medium` | Fraunces reads best at 400–500 |
| Tailwind palette (`amber-*`, `emerald-*`, `red-*`, `stone-*` …) | the matching status / surface token | never raw palette |

## 10. Do / Don't

| Do | Don't |
| --- | --- |
| Use semantic tokens: `bg-surface`, `text-ink-muted`, `border-line`, `bg-accent-soft` | Hex values, `bg-white`, `text-white`, Tailwind palette colours, retired names (section 9) |
| `text-accent-strong` for terracotta text and links | `text-accent` on small text |
| One `accent` button per screen, for the key action | Terracotta as decoration, on several buttons, or as large background areas |
| Hairlines (`border-line`) and whitespace for structure | Shadows on cards; nested cards |
| Fraunces 400–500 for titles and big numbers | Fraunces bold, Fraunces for body or table text |
| One `MetricStrip` per page, muted zeros | Rows of separate tiles full of zeros |
| `StatusBadge` with the shared maps | Ad-hoc coloured spans for statuses |
| `Panel` with `bodyClassName="p-0"` for lists/tables | Cards nested inside cards |
| `EmptyState` with one action | Empty cards with a lone "No data" line |
| Keep button, label, heading and dialog texts identical (e2e tests) | Rename visible strings without grepping `tests/e2e` |
| Real `<table>` at desktop; cards on phones via `DataTable cards` | Page-level horizontal scroll |
| Check both themes (`SCREENSHOT_THEME=dark`) | `dark:` overrides for colours a token should carry |
| Server components; `"use client"` only for interaction | Client components for static layout |
