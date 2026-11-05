# Fashinza design system — "Atelier"

The reference for every screen in the app and the public website. Fashinza is a **fashion-manufacturing**
business (garment manufacturing, factory sourcing, sample development, quality inspection); the interface
looks like a premium fashion house that runs a precise production floor: deep charcoal on warm ivory, white
cards, Playfair Display editorial headings over Inter, muted taupe rules, real garment photography and one
disciplined forest-green accent. Light and dark themes are both first-class. Positioning and copy rules are in
`docs/website-brief.md` (never describe Fashinza as software, a tech marketplace or SaaS).

- Tokens and type utilities: `src/app/globals.css`
- Photography: `src/lib/images.ts` (`PHOTOS`), `src/components/ui/photo.tsx` (`<Photo>`), files and credits in
  `public/images` (`CREDITS.md`)
- Theme system: `src/components/theme/*` (inline no-flash script, `ThemeSync`, `ThemeToggle`, `ThemeSegmented`)
- UI kit: `src/components/ui/*`
- App building blocks: `src/components/app/primitives.tsx`
- Shell: `src/components/app/app-shell.tsx` (navigation in `nav.ts`)
- Status label/tone maps: `src/lib/labels.ts`

Brand palette: **deep charcoal #202020 · warm ivory #F8F6F1 · muted taupe #B7A895 · forest green #536B55 ·
white #FFFFFF**. Components never use these hex values directly: they are expressed through the semantic
tokens in section 3.

## 1. Principles

1. **Charcoal on ivory.** Most of the UI is `text-ink` (charcoal) on `bg-canvas` (ivory) and `bg-surface`
   (white cards). Colour is information, not decoration.
2. **Accent discipline.** Forest green is used for the single most important action on a screen
   (`variant="accent"`), active navigation, focus rings, progress and key highlights. Never as background
   decoration, never on several buttons in one area.
3. **Taupe is a rule, not a text colour.** Taupe draws decorative rules, marks and soft fills. It is only
   2.1:1 on ivory, so it is never text on light backgrounds; as text it appears only on charcoal bands and
   photographs (eyebrows).
4. **Real garment work, not technology.** Imagery is the approved photography of sewing, cutting, fabrics,
   sampling and inspection (section 6). No tech imagery, no illustrations of screens or circuits.
5. **Structure from lines, not shadows.** 1px hairlines (`border-line`) define cards and sections. Only
   popovers, menus, dialogs and toasts float (`shadow-pop`).
6. **Tailored geometry.** Controls 4px (`rounded-md`), cards and photos 6px (`rounded-lg`), dialogs 8px
   (`rounded-xl`). Buttons are crisp rectangles; badges are small 3px-radius tags. No pills except avatars and dots.
7. **Editorial type, interface clarity.** Playfair Display for display, page and section titles; Inter for
   everything you read or enter in volume: body, forms, tables, labels, data and metric values.
8. **Generous whitespace, deliberate rules.** Use space first; use a thin rule (`border-line`,
   `border-line-strong` for section rules) where a magazine would.
9. **Zeros are not news.** Zero metrics are muted; attention tones are applied conditionally.
10. **Same thing, same look.** One status mapping (`lib/labels.ts`), one badge, one table style, one empty state.
11. **Phones are first-class.** No page-level horizontal scroll at 320px. Touch targets at least 40px.

## 2. Theming contract

- Every colour is a **semantic token**. The light values live in `@theme`; the dark values override the same
  CSS variables on `html[data-theme="dark"]`. Use the Tailwind utilities (`bg-surface`, `text-ink-muted`,
  `border-line`, `ring-focus` …) and everything works in both themes automatically.
- **Never** use hex values, `bg-white`, `text-white`, `bg-black`, `text-black`, Tailwind palette colours
  (`bg-amber-50`, `text-emerald-700`, `bg-stone-100` …) or the retired "Atelier Ops" names (section 10) in components.
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

Utility suffix → value → use. Ratios are WCAG 2.1 contrast, computed with a script for every text-on-background
pair in both themes (light / dark). Targets: 4.5:1 for text, 3:1 for large text and non-text UI (icons, focus
rings, control borders). Every pair listed meets its target.

### Surfaces

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | #F8F6F1 (warm ivory) | #161616 | Page background, sidebar, top bar |
| `surface` | #FFFFFF (white) | #1E1E1E | Cards, panels, tables, inputs |
| `surface-muted` | #F0ECE5 | #252422 | Taupe-tinted wells: card footers, neutral badges, quiet fills, tracks |
| `surface-sunken` | #E9E4DC | #121212 | Inset wells, image boxes, photo placeholders while loading |
| `surface-raised` | #FFFFFF | #262626 | Popovers, menus, dialogs, sheets, toasts |
| `surface-hover` | #F4F1EB | #2B2A28 | Hover tint for rows, items, ghost buttons |
| `inverse` | #202020 (charcoal) | #262524 | Contrasting band (CTA band, footer, auth aside). Text on it: `text-ink-inverse` |
| `scrim` | #141414 | #141414 | Base of photo overlays (`<Photo overlay>`, `bg-scrim/70`, `from-scrim/90`). Same in both themes |

### Text

| Token | Light | Dark | Ratios (light / dark) | Use |
| --- | --- | --- | --- | --- |
| `ink` | #202020 | #F8F6F1 | 12.9–16.3 / 13.2–17.4 on every surface and tint | Primary text, headings, values |
| `ink-muted` | #5E5850 | #B8B1A6 | 5.5–7.0 / 6.7–8.8 (every surface and `-soft` tint) | Secondary text, labels, captions (smallest text allowed) |
| `ink-subtle` | #8A8378 | #847D73 | 3.2–3.8 / 3.7–4.5 | **≥3:1 only**: decorative icons, chevrons, large display numerals. Never small text |
| `ink-placeholder` | #736C62 | #9A9388 | 5.2 / 5.5 on `surface` (4.8 / 5.0 worst case) | Input placeholders (`placeholder:text-ink-placeholder`) |
| `ink-inverse` | #F8F6F1 | #F8F6F1 | 15.1 / 14.2 on `inverse`, 17.1 on `scrim` | Text on `bg-inverse` and on photographs |
| `ink-inverse-muted` | #C9BEAF | #C9BEAF | 8.9 / 8.4 on `inverse`, 10.1 on `scrim` | Secondary text on `bg-inverse` and photographs |

### Brand accents on dark bands and photos

| Token | Light | Dark | Ratios | Use |
| --- | --- | --- | --- | --- |
| `taupe` | #B7A895 | #B7A895 | 7.0 / 6.6 on `inverse`, 7.9 on `scrim`; **2.15 on ivory** | Decorative rules and marks anywhere (`bg-taupe`, `border-taupe`); as TEXT only on `bg-inverse` and photos (eyebrows `eyebrow text-taupe`) |
| `accent-inverse` | #A9C0AA | #A9C0AA | 8.4 / 7.9 on `inverse`, 9.5 on `scrim` | Forest-green text, numerals and marks on `bg-inverse` bands and photos (`text-accent` there is only 2.8:1) |

### Lines

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `line` | #E5E0D7 | #33312E | Default border and divider (cards, header rules). Also the global default border colour |
| `line-subtle` | #EEEAE3 | #292826 | Row dividers inside cards and tables |
| `line-strong` | #CFC6B8 (light taupe) | #4A4641 | Emphasised rules (table header rule, PageSection rule), outline buttons, upcoming steps |
| `line-control` | #8F877B | #7A746B | Form-control borders: 3.3–3.6 / 3.3–3.9 (meets 3:1 non-text contrast) |

### Actions and accent

| Token | Light | Dark | Use and ratios |
| --- | --- | --- | --- |
| `primary` / `primary-hover` / `primary-fg` | #202020 / #3A3835 / #F8F6F1 | #F8F6F1 / #E3DFD6 / #202020 | Primary button (charcoal in light, ivory in dark). 15.1 / 15.1 (hover 10.8 / 12.3) |
| `accent` | #536B55 (forest green) | #8FAB91 | Forest-green **fills**: accent button, active-nav bar, progress, dots, focus. As text 5.4 canvas, 5.8 surface / 6.1–7.2 |
| `accent-hover` | #445946 | #A2BCA4 | Hover of accent fills |
| `accent-strong` | #435A45 | #A7C2A9 | Accent **text** and links. 5.9–7.5 on every surface, 6.2 on `accent-soft` / 7.5–9.8, 7.9 |
| `accent-soft` | #E6EBE6 | #1E2820 | Selected / active background tint |
| `accent-line` | #C5D1C4 | #3A4D3C | Border around accent-soft areas |
| `accent-fg` | #FFFFFF | #161616 | Text on `bg-accent` (5.8 / 7.2; on hover 7.6 / 8.9) |
| `focus` | #536B55 | #8FAB91 | Focus rings (`ring-focus`, `outline-focus`; global `:focus-visible` already uses it). ≥5.4 / ≥6.1 |
| `overlay` | charcoal 45% | black 62% | Modal / drawer scrim (`bg-overlay`) |

### Status

Each tone has four steps. **base** = fills, dots, icons (≥3:1); **-strong** = text (≥4.5:1 on surface and on
its soft tint); **-soft** = tint background; **-line** = border on a tint.

| Tone | base (L / D) | -strong (L / D) | -soft (L / D) | -line (L / D) | -strong on -soft | base on surface |
| --- | --- | --- | --- | --- | --- | --- |
| `success` (olive leaf) | #4B7A1C / #9CC45F | #3B6114 / #B6D686 | #EEF3D6 / #252E12 | #C9D9AC / #3C4F24 | 6.3 / 8.8 | 5.1 / 8.3 |
| `warning` (ochre) | #B07A1A / #D9A441 | #7E530C / #E8BE6A | #F7EEDB / #2D2513 | #E6D3A8 / #594620 | 5.8 / 8.7 | 3.7 / 7.4 |
| `danger` (brick) | #B03A2E / #E0705F | #962E24 / #F0907F | #F8E5E0 / #331A18 | #EAC4BB / #64302A | 6.4 / 6.9 | 6.0 / 5.3 |
| `info` (slate blue) | #4A6684 / #8FA8C4 | #3A5571 / #AFC3DA | #E7ECF1 / #1A212B | #C6D1DD / #34445A | 6.5 / 9.0 | 6.0 / 6.8 |

`danger-fg` (#FFFFFF / #161616) is the text on a `bg-danger` button (6.0 / 5.7; on `danger-strong` hover 7.7 / 7.8).

**Success vs accent.** Both are green, so they are kept apart deliberately: the accent is a muted, grey forest
green; success is a brighter, yellower olive-leaf green. CIEDE2000 distance: fills 15.9 / 16.6, text 13.5,
soft tints 9.2 / 8.8 (anything above ~5 is clearly visible side by side). Status badges also carry a dot and a
label, so meaning never depends on hue alone.

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

**Playfair Display Variable** (`font-display` / `font-serif`; weight axis 400–900, roman and italic, from
`@fontsource-variable/playfair-display`, imported in `globals.css`) for editorial headings, and **Inter
Variable** (`font-sans`, the default; imported in `app/layout.tsx`) for the interface. `h1–h4` default to
Playfair 500 in `ink`; add `font-sans` to a tiny label-style heading.

- **Weights.** Playfair reads best at 400–500 (`font-normal` / `font-medium`); 600 at most for small titles.
  Its lightest weight is 400, so `font-light` or `font-[380]` on Playfair render as 400. Never bold display type.
- **Figures.** Playfair's default figures are old-style and it has no tabular figures. Headings, `font-display`,
  the `type-*` utilities and `.tabular` switch lining figures on. Numbers that must line up (tables, money,
  metrics) are set in Inter.
- **Italic.** `font-display italic` is Playfair Italic (the italic file is imported): an accent for a word or
  phrase in marketing headlines, and for editorial numbering ("01"). Sparingly.

| Role | Class | Spec |
| --- | --- | --- |
| Marketing display | `type-display` | Playfair 500, 40px → 64px lg, line height 1.1 → 1.05, tracking −0.015 → −0.02em |
| Marketing section title | `type-section` | Playfair 500, 30px → 44px lg |
| App page title (h1) | `type-title` (PageHeader does this) | Playfair 500, 26px → 32px sm |
| Card / panel title | `type-heading` | Playfair 500, 18px |
| Page section title | PageSection | Playfair 500, 20px over a `line-strong` rule |
| Metric value | `type-metric` | **Inter** 500, 30px, tracking −0.025em, lining tabular figures |
| Editorial accent | `font-display italic` | Playfair italic for a word or phrase in marketing headlines (sparingly) |
| Body (app) | `text-sm` | Inter 14px |
| Body (marketing) | `text-base` / `text-lg` | Inter 16–18px, `leading-7` |
| Secondary / labels | `text-[13px]` | Inter 13px |
| Caption | `text-xs` | Inter 12px |
| Eyebrow | `eyebrow text-ink-muted` (marketing on light: `eyebrow text-accent-strong`; on `bg-inverse` / photos: `eyebrow text-taupe`) | Inter 11px 600 caps, 0.14em |
| Table header / group label | `label-caps text-ink-muted` | Inter 11px 600 caps, 0.1em |
| Numbers | `tabular` | lining tabular figures (tables, money, counts) |

The `type-*`, `eyebrow` and `label-caps` utilities never set colour; add a `text-*` colour.
Do **not** invent `text-<name>` font-size tokens: `cn()`/tailwind-merge treats unknown `text-*` names as
colours and will drop your colour class. Use `text-[13px]` for one-off sizes.

## 6. Photography

Real photographs of garment work carry the brand: sewing lines, fabric cutting, fabric rolls, sample fittings,
design sketches, quality inspection, finished garments, linen texture. They are the **only** images used.

- **Source.** Only entries of `PHOTOS` in `src/lib/images.ts`, rendered with `<Photo>`. The files are in
  `public/images`, licensed under the Unsplash License and credited in `public/images/CREDITS.md`. Adding a
  photo means adding the file, its `CREDITS.md` row (licence checked; no "Unsplash+" or paid images) and a
  `PHOTOS` entry with real width, height, alt text and credit. Never hotlink, never use generic technology
  stock (screens, code, circuit boards, developers), illustrations of software, or AI-generated "factories".
- **Never caption a photo as a Fashinza partner, factory, customer or order.** They are generic industry
  photographs. Captions describe the activity ("Sample development", "Quality inspection"), never "Our partner
  factory in …", a named brand, a location presented as fact, or a statistic.
- **Alt text is required.** The catalogue alt text is the default; pass `alt` for a better description in
  context. Use `decorative` (empty alt) only when the adjacent text already says what the photo shows.
- **Sizes.** Always pass `sizes` (the rendered width per breakpoint) so the right srcset width is fetched.
  `priority` only on the hero / largest above-the-fold image, at most one per page.
- **Shape.** `rounded="lg"` (6px) by default, like cards; `rounded="none"` for full-bleed bands; `xl` for a
  large feature image inside a section. Crops use `object-cover`; choose `aspect` (`natural | square |
  portrait 4:5 | landscape 3:2 | wide 16:9 | none`) and `position` to keep the subject (hands, garment) in frame.
- **Text on photos** needs `overlay` and ivory text: `text-ink-inverse` for titles and body, `text-taupe` /
  `text-ink-inverse-muted` for eyebrows and secondary lines, `text-accent-inverse` for accent marks. Worst case
  (a white pixel under the text) `text-ink-inverse` is ≥4.5:1 wherever the scrim is ≥62% opaque and the muted /
  taupe colours wherever it is ≥82%: keep text in the darkest part of the gradient (`bottom`: lowest third;
  `left`: left 45%; `full`: 70% everywhere, ivory text only). Never put text on a photo without an overlay.
- **Themes.** Photos are dimmed slightly in dark mode (`dark:brightness-[0.92]`, built into `<Photo>`);
  overlays and ivory text are the same in both themes. While loading, the frame shows `surface-sunken`.
- **Where.** The public website and the sign-in / sign-up pages. Inside the signed-in workspace the UI stays
  data-first: at most a photo in an onboarding or empty state, never decorating tables or forms.
- **Optimisation.** next/image serves WebP at quality 75 through `sharp` (present in `node_modules` and traced
  into the standalone build, verified), so no `images` config is needed.

### Photo — `ui/photo`

```tsx
import { Photo, photoCredit, type PhotoName } from "@/components/ui/photo";

<Photo photo="factorySewingLines" sizes="(min-width: 1024px) 50vw, 100vw" aspect="landscape" />
<Photo photo="heroSewing" sizes="(min-width: 1024px) 55vw, 100vw" priority aspect="portrait" credit />
<section className="relative isolate min-h-[32rem]">                     {/* full-bleed band */}
  <Photo photo="fabricRolls" sizes="100vw" fill rounded="none" overlay="left" decorative />
  <div className="relative container-page py-20 text-ink-inverse">…</div>
</section>
<Photo photo="qualityInspection" sizes="(min-width: 768px) 33vw, 100vw" aspect="portrait" overlay="bottom">
  <p className="eyebrow text-taupe">Quality inspection</p>
  <p className="type-heading text-ink-inverse">AQL checks before shipment</p>
</Photo>
<p className="text-xs text-ink-muted">{photoCredit("linenTexture")}</p>    {/* "Photo: engin akyurt / Unsplash" */}
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `photo` | `PhotoName` (a `PHOTOS` key) or a `PHOTOS` entry | — | Required |
| `sizes` | string | — | Required, e.g. `"(min-width: 1024px) 50vw, 100vw"` |
| `alt` | string | catalogue alt | Better description for this context |
| `decorative` | boolean | false | Empty alt; credit hidden from assistive technology |
| `priority` | boolean | false | Preload in `<head>`, eager, `fetchPriority="high"` (Next 16 `preload`; `priority` on next/image is deprecated). One per page |
| `fill` | boolean | false | Frame becomes `absolute inset-0` and covers the nearest positioned ancestor; `aspect` ignored |
| `aspect` | `natural \| square \| portrait \| landscape \| wide \| none` | `natural` | `none`: size the frame with `className` (`h-[28rem]`, responsive `aspect-*` classes) |
| `position` | CSS object-position | center | e.g. `"center 30%"` |
| `rounded` | `none \| sm \| md \| lg \| xl` | `lg` | |
| `overlay` | `none \| bottom \| left \| full` | `none` | Scrim for ivory text (see thresholds above) |
| `credit` | `boolean \| "top" \| "bottom"` | false | Small "Photo: … / Unsplash" chip on the photo (bottom-right, or top-right) |
| `className` | string | | Frame (root `div`, `relative isolate overflow-hidden`) |
| `imageClassName` | string | | The `<img>` (e.g. a hover zoom) |
| `children` | ReactNode | | Rendered over the photo in an `absolute inset-0` bottom-aligned column, ivory text, `p-5 sm:p-8` |
| `contentClassName` | string | | Overrides that column's alignment / padding |

`<Photo>` is a server component (no `"use client"`).

## 7. Components (UI kit — `@/components/ui/*`)

### Button — `ui/button`

```tsx
<Button>Save</Button>                                   // primary (charcoal; ivory in dark), md
<Button variant="accent"><Plus /> Create production project</Button>   // the ONE key action on a screen
<Button variant="outline" size="sm">Export</Button>
<Button variant="ghost" size="icon" aria-label="More"><MoreHorizontal /></Button>
<Button variant="danger">Cancel order</Button>
<Button variant="link" size="sm" asChild><Link href="/payments">All payments <ArrowRight /></Link></Button>
<Button variant="inverse" size="lg">Create an account</Button>   // on bg-inverse bands
<Button loading>Saving</Button>                          // spinner + disabled + aria-busy
```
- Variants: `primary` (charcoal; ivory in dark), `accent` (forest green), `outline` (hairline on surface), `ghost`,
  `subtle` (taupe-tinted `surface-muted` fill), `danger` (brick), `inverse` (ivory on `bg-inverse`), `link`
  (accent-strong text, no box).
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

`Card` (surface, hairline, 6px, no shadow), `CardHeader` (`divided`), `CardTitle` (Playfair `type-heading`,
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
  placeholders, forest-green focus border
  + soft ring, brick border when `aria-invalid`. Labels Inter 13px medium ink; required asterisk in
  `accent-strong`; " (optional)" in `ink-muted` (keep it — tests rely on label text).
- `fieldClass` is exported for custom controls. Checkboxes/radios use the accent colour globally.
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
`DialogContent` takes `title` (Playfair 20px, accessible name), `description`, `size="sm|md|lg"`. 8px radius,
`surface-raised`, `shadow-pop`, `bg-overlay` scrim. The ActionDialog action row is a `surface-muted` footer.
Initial focus goes to the first control (Close is last in DOM order).

### Sheet — `ui/sheet`

Side drawer: `<SheetContent title="Menu" side="left|right" hideTitle?>` on `surface-raised` (the app nav
drawer passes `bg-canvas` to match the sidebar).

### Avatar — `ui/avatar`

`<Avatar name="Ayesha Khan" />` (round, accent tint, Playfair initials) · `<Avatar name={org} shape="square" tone="ink" />`.
Tones `accent | ink | neutral`. Sizes `sm|md|lg`. Decorative: show the name as text too.

### Toasts — `ui/toaster`

`toast.success("Saved")` / `toast.error(...)`. Top-right below the top bar; raised surface, hairline border,
status-coloured icon. Follows the theme.

## 8. App building blocks (`@/components/app/primitives`)

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
- Eyebrow `ink-muted`, Playfair title 26/32px, description `ink-muted`.
- `meta` sits in the same parent as the `<h1>` (tests read the heading's parent for the status).
- Actions are right-aligned on desktop and stretch full width on phones.

### MetricStrip + Metric

```tsx
<MetricStrip label="Summary">
  <Metric label="Projects seeking quotes" value={d.activeProjects} href="/projects?status=QUOTING" icon={ClipboardList} hint={drafts ? `${drafts} drafts` : undefined} />
  <Metric label="Delayed orders" value={d.delayedOrders} href="/orders?delayed=1" tone={d.delayedOrders ? "danger" : undefined} />
</MetricStrip>
```
- One hairline-divided card. Label 12px `ink-muted` with a 14px icon; value Inter 30px (`type-metric`).
- Zero / empty values render `ink-muted` automatically (`muted` to force); quiet, but still 4.5:1 because
  values shrink below 24px on phones and can be phrases ("Not shipped yet"). `tone`: `neutral | accent | success |
  warning | danger` colours the value (`-strong`) and the icon. Apply tones conditionally.
- With `href` the cell links to its filtered list; an accent arrow appears on hover.
- `StatCard` still exists for old code; do not use it in redesigned pages.

### Panel (the standard card)

```tsx
<Panel id="payments" title="Payment schedule" description="Milestone payments" actions={<Button variant="link" size="sm" asChild><Link href="/payments">All payments <ArrowRight /></Link></Button>}>
  …
</Panel>
<Panel title="Recent projects" bodyClassName="p-0">{/* edge-to-edge list or table */}</Panel>
<Panel title="Totals" footer={<Button size="sm">Pay now</Button>}>…</Panel>
```
Surface card, Playfair 18px title over a hairline, 20px body (16px phones), optional `surface-muted` footer.
`id` sets the anchor and `aria-labelledby` (tests use `#payments`, `#sampling`). Any padding class in
`bodyClassName` replaces the default padding at every breakpoint.

### PageSection

Titled group **outside** cards: a `line-strong` rule, then a Playfair 20px title, description and actions.
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
| accent | open for quotations, waiting for manufacturers (forest green, so only these) | Submitted, Receiving quotes |
| success | done, approved, paid, verified | Delivered, Accepted, Paid, Verified |
| warning | waiting on a decision, due | Quality check, Revision requested, Due, Under review |
| danger | failed, rejected, blocked, cancelled | Cancelled, Declined, Failed, Suspended |

### EmptyState

```tsx
<EmptyState icon={PackageSearch} title="No active orders" description="Accepted quotations become orders here." action={<Button variant="accent" asChild><Link href="/opportunities">Browse opportunities</Link></Button>} />
<EmptyState variant="plain" … />   // inside a Panel: no card chrome
```
44px hairline icon tile (canvas fill, `ink-muted` icon), Playfair title, one sentence, one action.

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
  `cell-primary` = ink medium name/link with an accent underline on hover.
- The container scrolls horizontally inside itself. With `cards`, the table is hidden below md and the cards
  from md; cards render after the table in the DOM. Keep a real `<table>` at desktop (tests use
  `getByRole("table")`).
- `ProgressBar value={3} max={8} label="3 of 8 stages complete" tone="accent|ink|success|warning|danger"`:
  4px bar on a `line` track. `accent` (default) for the key progress on a screen, `ink` for neutral progress.
  In lists (projects, orders): `ink` while running, `success` once delivered, `warning` when delayed.

### StageStepper

Horizontal from md, vertical below. Done = ink circle with check + ink connector, current = forest-green ring
with `accent-soft` halo (ochre with `attention`), upcoming = numbered hairline circle. It does **not** set
`aria-current="step"`: the order page's milestone list owns `li[aria-current="step"]`.

### Timeline / ActivityTimeline

Hairline connector; 24px nodes with a tone dot (`bg-{tone}`) or icon (`text-{tone}-strong`).

### AnchorNav

In-page links over a hairline; hover underlines in the accent. Counts are quiet `surface-muted` tags.

### Others

- `FilterBar`: GET filter form (search + selects + Apply/Clear). Keep its props.
- `Pagination`: "Page x of y · n results" + Previous / Next (outline buttons).
- `NotificationList`: accent unread dot, title, message, time.
- `PageSkeleton variant="dashboard|list|detail"`, `Skeleton className="h-4 w-32"` (`surface-muted` blocks).

## 9. Layout rules

**App shell.** Ivory (`canvas`) 248px sidebar separated by a hairline: serif wordmark "Fashinza" with an
accent full stop; workspace block between two hairlines (eyebrow "Brand workspace" + organisation in
Playfair); grouped nav (11px caps labels in `ink-muted`); items `ink-muted` → hover `surface-hover`;
**active item** = ink text on `surface` with a hairline inset, accent icon and a 3px accent bar at the
sidebar edge; user block with sign-out at the bottom. 64px top bar on `canvas`: search (placeholder "Search",
accessible name "Search projects and orders", `/` focuses it), `ThemeToggle`, notifications (accent count),
account menu. Below lg the sidebar is a drawer ("Open navigation").

**Page structure** (inside `<main>`, max 1280px, 40px padding desktop / 16px phones):
1. `PageHeader` 2. optional alerts (`mb-6`) 3. optional `MetricStrip`, or a `StageStepper` panel on order
pages 4. content: one column of `PageSection`s, or a main/side grid
`grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]` with `space-y-6` columns.

**Responsive.** `minmax(0, …)` / `min-w-0` for grid and flex children holding long text (globals also sets
`min-width: 0` on `main .grid > *`). Check 320px: no page-level horizontal overflow. Targets ≥40px on phones.

**Images.** Brand photography: `<Photo>` (section 6). Uploaded files (tech packs, sample and QC photos) go in
fixed-size boxes:
`size-16 overflow-hidden rounded-md border border-line bg-surface-sunken` with `<img className="size-full object-cover">`.

**Motion.** 150–200ms colour/opacity transitions only (`transition-colors duration-150`). No entrance
animations. `prefers-reduced-motion` is respected globally; theme switches never animate.

**Marketing.** `.container-page` (1216px). Editorial: large Playfair headlines (`type-display`,
`type-section`, an italic phrase at most), a large editorial photograph in the hero (`<Photo priority>`),
asymmetric grids (e.g. `lg:grid-cols-12` with 7/5 splits), numbered sections ("01", "02" in `eyebrow` or
Playfair italic), thin rules between sections (`border-t border-line`; a short `bg-taupe` rule as an editorial
mark), sections alternating `bg-canvas` / `bg-surface`, CTA band on `bg-inverse` with `text-ink-inverse`,
`eyebrow text-taupe` and a `variant="inverse"` or `accent` button, footer on `bg-inverse` or canvas with
hairlines. Product-UI mocks use the same tokens and keep their visible "Example data" labels. Copy uses
fashion-industry language (garment manufacturing, tech packs, sample development, MOQ, production capacity,
quality inspection). Only `PHOTOS` photography (section 6); no tech imagery, invented partners, customers,
testimonials, logos, certifications, sustainability figures or performance statistics, and no claim of an AI
model (matching is rule-based). No emoji. No gradients beyond a whisper, except photo overlays.

## 10. Migration notes

### From "Editorial Atelier" (terracotta / Fraunces) to the current palette

Token **names did not change**; only their values did, so existing classes keep working:

- Terracotta accent → forest green (`accent*`, `focus`). Charcoal #202020 replaces the old warm ink; the canvas
  is warm ivory #F8F6F1 and cards are white. `success` moved to a brighter olive-leaf green so it is not
  confused with the accent.
- Fraunces → Playfair Display (`font-display`, `font-serif`, `h1–h4`, `type-display/section/title/heading`).
  The Fraunces package is removed. Playfair starts at weight 400 (`font-light`, `font-[380]` render as 400).
- `type-metric` is now **Inter** 500 (data), not the display face.
- New tokens: `taupe` (decorative rules; text only on charcoal bands and photos), `accent-inverse` (accent text
  and marks on `bg-inverse` / photos) and `scrim` (photo overlays). `inverse` stays charcoal in both themes.
- Comments in some components still say "terracotta" or "Fraunces"; they mean `accent` and `font-display`.

### Old "Atelier Ops" class → current class


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
| `font-display … font-semibold` headings | `font-display … font-medium` | Playfair reads best at 400–500 |
| Tailwind palette (`amber-*`, `emerald-*`, `red-*`, `stone-*` …) | the matching status / surface token | never raw palette |

## 11. Do / Don't

| Do | Don't |
| --- | --- |
| Use semantic tokens: `bg-surface`, `text-ink-muted`, `border-line`, `bg-accent-soft` | Hex values, `bg-white`, `text-white`, Tailwind palette colours, retired names (section 10) |
| `text-accent-strong` for accent text and links (`text-accent-inverse` on charcoal bands and photos) | `text-accent` on small text; `text-accent` on `bg-inverse` (2.8:1) |
| One `accent` button per screen, for the key action | Forest green as decoration, on several buttons, or as large background areas |
| Hairlines (`border-line`) and whitespace for structure | Shadows on cards; nested cards |
| Playfair 400–500 for titles; Inter for data and metric values | Playfair bold, Playfair for body, table text or numbers that must align |
| Taupe for rules, marks and eyebrows on charcoal / photos | Taupe text on ivory or white (2.1:1) |
| `<Photo>` with a `PHOTOS` entry, real alt text and `sizes` | Tech stock imagery, hotlinked images, captions that present a photo as a Fashinza partner, factory or customer |
| Ivory text on photos only over an `overlay` | Text on a raw photograph |
| One `MetricStrip` per page, muted zeros | Rows of separate tiles full of zeros |
| `StatusBadge` with the shared maps | Ad-hoc coloured spans for statuses |
| `Panel` with `bodyClassName="p-0"` for lists/tables | Cards nested inside cards |
| `EmptyState` with one action | Empty cards with a lone "No data" line |
| Keep button, label, heading and dialog texts identical (e2e tests) | Rename visible strings without grepping `tests/e2e` |
| Real `<table>` at desktop; cards on phones via `DataTable cards` | Page-level horizontal scroll |
| Check both themes (`SCREENSHOT_THEME=dark`) | `dark:` overrides for colours a token should carry |
| Server components; `"use client"` only for interaction | Client components for static layout |
