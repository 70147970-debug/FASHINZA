import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Shared app-page building blocks ("Editorial Atelier"). Server components; see docs/design-system.md for usage.
 */

/* -------------------------------------------------------------------------------------------------
 * Page header
 * -----------------------------------------------------------------------------------------------*/

/**
 * Title block at the top of every app page: optional breadcrumbs and eyebrow, the h1 with an inline `meta`
 * slot (status badge, reference code — rendered in the same parent as the h1), a description, an optional
 * `metaRow` of secondary facts, and right-aligned actions that stack under the title on small screens.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  eyebrow,
  metaRow,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: { href: string; label: string }[];
  actions?: React.ReactNode;
  /** Inline next to the title: status badge, reference code. */
  meta?: React.ReactNode;
  /** Small uppercase label above the title. */
  eyebrow?: React.ReactNode;
  /** Secondary facts under the description (use <MetaItem>). */
  metaRow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[13px] text-ink-muted">
            {breadcrumbs.map((b) => (
              <li key={b.href} className="flex items-center gap-1">
                <Link href={b.href} className="rounded-xs transition-colors hover:text-ink hover:underline hover:decoration-accent hover:underline-offset-4">
                  {b.label}
                </Link>
                <ChevronRight className="size-3.5 text-ink-subtle" aria-hidden />
              </li>
            ))}
            <li aria-current="page" className="min-w-0 max-w-[16rem] truncate text-ink sm:max-w-md">{title}</li>
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2.5 text-ink-muted">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="type-title min-w-0 break-words text-ink">{title}</h1>
            {meta}
          </div>
          {description && <div className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{description}</div>}
          {metaRow && <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted">{metaRow}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:grow lg:shrink-0 lg:justify-end">{actions}</div>}
      </div>
    </div>
  );
}

/** One fact in PageHeader's metaRow: optional icon + text. */
export function MetaItem({ icon: Icon, children, className }: { icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {Icon && <Icon className="size-3.5 shrink-0 text-ink-subtle" strokeWidth={1.75} aria-hidden />}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Status
 * -----------------------------------------------------------------------------------------------*/

type StatusTone = React.ComponentProps<typeof Badge>["tone"];

/** Status pill (dot + label) from one of the maps in lib/labels.ts. Unknown values fall back to neutral. */
export function StatusBadge({
  map,
  value,
  className,
  dot = true,
}: {
  map: Record<string, { label: string; tone: StatusTone }>;
  value: string;
  className?: string;
  dot?: boolean;
}) {
  const s = map[value] ?? { label: value, tone: "neutral" as const };
  return (
    <Badge tone={s.tone} dot={dot} className={className}>
      {s.label}
    </Badge>
  );
}

/** A small "sandbox / demo" marker used wherever behaviour is simulated. */
export function SandboxBadge({ children = "Sandbox mode" }: { children?: React.ReactNode }) {
  return (
    <Badge tone="warning" dot>
      {children}
    </Badge>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Metrics
 * -----------------------------------------------------------------------------------------------*/

type MetricTone = "neutral" | "accent" | "success" | "warning" | "danger";

const metricCols: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6",
  7: "grid-cols-2 sm:grid-cols-4 xl:grid-cols-7",
  8: "grid-cols-2 sm:grid-cols-4 xl:grid-cols-8",
};

/**
 * One card split into metric cells by hairline dividers (replaces rows of separate stat tiles).
 * `columns` defaults to the number of children (max 8); cells wrap to 2–4 per row on smaller screens.
 */
export function MetricStrip({ children, columns, className, label }: { children: React.ReactNode; columns?: number; className?: string; label?: string }) {
  const count = React.Children.toArray(children).filter(Boolean).length;
  const cols = metricCols[Math.min(Math.max(columns ?? count, 1), 8)];
  return (
    <section aria-label={label} className={cn("mb-6 overflow-hidden rounded-lg border border-line bg-surface sm:mb-8", className)}>
      <div className={cn("-ml-px -mt-px grid", cols)}>{children}</div>
    </section>
  );
}

function isZero(value: React.ReactNode) {
  return value === 0 || value === "0" || value === "0.00";
}

/**
 * Metric cell for MetricStrip. Zero values render muted; `tone` colours the value only when it needs
 * attention (pass it conditionally, e.g. tone={delayed ? "danger" : undefined}). With `href` the whole
 * cell links to the filtered view it counts.
 */
export function Metric({
  label,
  value,
  href,
  tone = "neutral",
  hint,
  icon: Icon,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: MetricTone;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Force the muted style (defaults to true when value is 0). */
  muted?: boolean;
}) {
  const quiet = muted ?? isZero(value);
  // Quiet (zero / empty) values use ink-muted, not ink-subtle: they can render below 24px on phones or as
  // short phrases ("Not shipped yet"), so they must meet 4.5:1.
  const valueTone = quiet
    ? "text-ink-muted"
    : { neutral: "text-ink", accent: "text-accent-strong", success: "text-success-strong", warning: "text-warning-strong", danger: "text-danger-strong" }[tone];
  const dot = !quiet && tone !== "neutral" ? { accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone] : null;
  const iconTone = dot ? { accent: "text-accent", success: "text-success", warning: "text-warning", danger: "text-danger" }[tone as Exclude<MetricTone, "neutral">] : "text-ink-subtle";
  const body = (
    <>
      <span className="flex items-center gap-1.5 pr-5 text-xs font-medium leading-4 text-ink-muted">
        {Icon ? (
          <Icon className={cn("size-3.5 shrink-0", iconTone)} strokeWidth={1.75} aria-hidden />
        ) : (
          dot && <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
        )}
        <span className="min-w-0">{label}</span>
      </span>
      <span className={cn("type-metric mt-2.5 block [overflow-wrap:anywhere] max-sm:text-[clamp(1.375rem,6.5vw,1.75rem)] max-sm:leading-8", valueTone)}>{value}</span>
      {hint && <span className="mt-1 block text-xs leading-4 text-ink-muted">{hint}</span>}
    </>
  );
  const cell = "relative block min-w-0 border-l border-t border-line px-4 pt-4 pb-4 max-sm:last:odd:col-span-2 sm:px-5 sm:pt-5";
  if (!href) return <div className={cell}>{body}</div>;
  return (
    <Link href={href} className={cn(cell, "group transition-colors duration-150 hover:bg-surface-hover focus-visible:z-10 focus-visible:-outline-offset-2")}>
      {body}
      <ArrowUpRight className="absolute right-3.5 top-4 size-3.5 text-transparent transition-colors duration-150 group-hover:text-accent sm:top-5" aria-hidden />
    </Link>
  );
}

/** Legacy single-metric tile. New pages should use <MetricStrip> + <Metric>. Always links to the list it counts. */
export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  href: string;
  icon: LucideIcon;
  tone?: "neutral" | "warning" | "danger" | "success";
  hint?: string;
}) {
  const quiet = isZero(value);
  const valueTone = quiet ? "text-ink-muted" : { neutral: "text-ink", warning: "text-warning-strong", danger: "text-danger-strong", success: "text-success-strong" }[tone];
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-lg border border-line bg-surface px-4 py-3.5 transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-[13px] font-medium leading-5 text-ink-muted">{label}</span>
        <Icon className={cn("mt-0.5 size-4 shrink-0", !quiet && tone !== "neutral" ? valueTone : "text-ink-subtle")} strokeWidth={1.75} aria-hidden />
      </span>
      <span className={cn("type-metric mt-1", valueTone)}>{value}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span>}
    </Link>
  );
}

/** Thin progress bar (e.g. stages complete). */
export function ProgressBar({
  value,
  max = 100,
  label,
  tone = "accent",
  className,
}: {
  value: number;
  max?: number;
  label: string;
  /** `ink` for neutral progress; `accent` (default) for the key progress on a screen. */
  tone?: "accent" | "ink" | "warning" | "danger" | "success";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-1 w-full overflow-hidden rounded-xs bg-line", className)}
    >
      <div
        className={cn("h-full rounded-xs", { accent: "bg-accent", ink: "bg-primary", warning: "bg-warning", danger: "bg-danger", success: "bg-success" }[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Containers
 * -----------------------------------------------------------------------------------------------*/

/**
 * The standard card for app pages: header row (h2 title, description, actions) with a divider, then a
 * 20px-padded body. Use bodyClassName="p-0" (any padding class replaces the default) when the body is a list or table that runs edge to edge.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  id,
  bodyClassName,
  footer,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  bodyClassName?: string;
  /** Optional muted footer row (secondary actions, totals). */
  footer?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("min-w-0 scroll-mt-24 rounded-lg border border-line bg-surface", className)}
      aria-labelledby={id && title ? `${id}-title` : undefined}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 id={id ? `${id}-title` : undefined} className="type-heading text-ink">
                {title}
              </h2>
            )}
            {description && <div className="mt-0.5 text-[13px] leading-5 text-ink-muted">{description}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {/* tailwind-merge keeps the base `sm:p-5` when a page passes only `p-0`, so skip the default
          padding entirely whenever the page sets its own. */}
      <div className={cn(bodyClassName && /(^|\s)p[xy]?-/.test(bodyClassName) ? undefined : "p-4 sm:p-5", bodyClassName)}>{children}</div>
      {footer && <div className="flex flex-wrap items-center gap-2 rounded-b-lg border-t border-line bg-surface-muted/50 px-4 py-3 sm:px-5">{footer}</div>}
    </section>
  );
}

/**
 * Titled group of content outside a card (gives long pages a clear hierarchy): h2 + description + actions,
 * then children (cards, tables, grids).
 */
export function PageSection({
  title,
  description,
  actions,
  children,
  id,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-24", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-line-strong pt-4">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-xl font-medium leading-7 tracking-[-0.015em] text-ink">
            {title}
          </h2>
          {description && <div className="mt-0.5 text-[13px] leading-5 text-ink-muted">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Empty state: 40px hairline icon tile, serif title, one sentence, one action. `variant="plain"` drops the card chrome (use inside a Panel). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "card",
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: "card" | "plain";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center",
        variant === "card" && "rounded-lg border border-line bg-surface",
        className,
      )}
    >
      <span className="mb-4 grid size-11 place-items-center rounded-md border border-line bg-canvas text-ink-muted">
        <Icon className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="type-heading text-ink">{title}</h2>
      <div className="mt-1.5 max-w-sm text-sm leading-6 text-ink-muted">{description}</div>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Record details
 * -----------------------------------------------------------------------------------------------*/

type DescItem = { label: string; value: React.ReactNode; /** Span the full row in grid layout. */ full?: boolean };

/**
 * Label/value pairs. layout="grid" (default) is a responsive 1–4 column grid; layout="rows" is a compact
 * two-column list with values right-aligned (good for narrow side cards and money breakdowns).
 */
export function DescriptionList({
  items,
  columns = 2,
  layout = "grid",
  className,
}: {
  items: DescItem[];
  columns?: 1 | 2 | 3 | 4;
  layout?: "grid" | "rows";
  className?: string;
}) {
  if (layout === "rows") {
    return (
      <dl className={cn("divide-y divide-line-subtle text-sm", className)}>
        {items.map((i) => (
          <div key={i.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-[13px] text-ink-muted">{i.label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-ink">{i.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    );
  }
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid gap-x-8 gap-y-5 text-sm", cols, className)}>
      {items.map((i) => (
        <div key={i.label} className={cn("min-w-0", i.full && "sm:col-span-full")}>
          <dt className="text-xs font-medium leading-4 text-ink-muted">{i.label}</dt>
          <dd className="mt-1 break-words leading-5 text-ink">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Definition list for record details (legacy name; same as <DescriptionList layout="grid">). */
export function DetailList({ items, columns = 2 }: { items: { label: string; value: React.ReactNode }[]; columns?: 2 | 3 | 4 }) {
  return <DescriptionList items={items} columns={columns} />;
}

/* -------------------------------------------------------------------------------------------------
 * Tables
 * -----------------------------------------------------------------------------------------------*/

/**
 * Card container for a `<table className="data-table">`. It scrolls horizontally inside itself (never the
 * page). Pass `cards` to show a stacked card list below md instead; the table is then display:none on phones
 * and the cards are display:none from md, so only one is ever in the accessibility tree.
 */
export function DataTable({
  children,
  cards,
  label,
  className,
}: {
  children: React.ReactNode;
  cards?: React.ReactNode;
  /** Accessible name for the scroll region (recommended when the table can overflow). */
  label?: string;
  className?: string;
}) {
  return (
    <>
      <div
        role={label ? "region" : undefined}
        aria-label={label}
        tabIndex={label ? 0 : undefined}
        className={cn("relative min-w-0 overflow-x-auto rounded-lg border border-line bg-surface", cards && "hidden md:block", className)}
      >
        {children}
      </div>
      {/* Cards come after the table in the DOM so `getByText(...).first()` style lookups hit the visible
          desktop table first; only one of the two is ever displayed. */}
      {cards && <div className="md:hidden">{cards}</div>}
    </>
  );
}

/** Stacked list for phones (pair with DataTable `cards`). */
export function MobileCardList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("space-y-2", className)}>{children}</ul>;
}

/** One record card: title + badge on the first line, muted meta line, optional extra content. */
export function MobileCard({
  href,
  title,
  badge,
  meta,
  children,
}: {
  href?: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words text-sm font-medium text-ink">{title}</span>
        {badge}
      </span>
      {meta && <span className="mt-1 block text-xs leading-5 text-ink-muted">{meta}</span>}
      {children && <span className="mt-3 block">{children}</span>}
    </>
  );
  const cls = "block rounded-lg border border-line bg-surface p-4";
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(cls, "transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover")}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/** Server-rendered pagination that keeps the current filters in the URL. */
export function Pagination({
  page,
  pages,
  total,
  basePath,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pages <= 1) return <p className="tabular mt-3 text-xs text-ink-muted">{total} {total === 1 ? "result" : "results"}</p>;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${q}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="tabular text-[13px] text-ink-muted">
        Page <span className="font-medium text-ink">{page}</span> of {pages} · {total} results
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)} rel="prev">
              <ChevronLeft /> Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft /> Previous
          </Button>
        )}
        {page < pages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)} rel="next">
              Next <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Progress: stage stepper and timeline
 * -----------------------------------------------------------------------------------------------*/

export type StepState = "done" | "current" | "upcoming";
export type Step = { key: string; label: string; state: StepState; hint?: React.ReactNode; /** Current step needs attention (e.g. delayed). */ attention?: boolean };

const stepStateText: Record<StepState, string> = { done: "completed", current: "current stage", upcoming: "not started" };

/**
 * Horizontal stage stepper (vertical below md). Completed = ink check, current = terracotta ring (ochre with
 * `attention`), upcoming = numbered hairline circle.
 * It deliberately does not set aria-current="step" on its items: the order page's milestone list owns that.
 */
export function StageStepper({ stages, label = "Production stages", className }: { stages: Step[]; label?: string; className?: string }) {
  return (
    <ol
      aria-label={label}
      className={cn("flex flex-col md:grid", className)}
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((s, i) => {
        const last = i === stages.length - 1;
        const next = stages[i + 1];
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0 md:flex-col md:gap-2.5 md:pb-0 md:pr-2">
            {!last && (
              <span
                className={cn(
                  "absolute bottom-0 left-[11.5px] top-6 w-px md:bottom-auto md:left-8 md:right-1.5 md:top-[11.5px] md:h-px md:w-auto",
                  s.state === "done" && next?.state !== "upcoming" ? "bg-primary" : s.state === "done" ? "bg-line-control" : "bg-line-strong",
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative grid size-6 shrink-0 place-items-center rounded-full",
                s.state === "done" && "bg-primary text-primary-fg",
                s.state === "current" && (s.attention ? "border-2 border-warning bg-surface ring-4 ring-warning-soft" : "border-2 border-accent bg-surface ring-4 ring-accent-soft"),
                s.state === "upcoming" && "border border-line-strong bg-surface text-ink-muted",
              )}
              aria-hidden
            >
              {s.state === "done" && <Check className="size-3.5" strokeWidth={3} />}
              {s.state === "current" && <span className={cn("size-2 rounded-full", s.attention ? "bg-warning" : "bg-accent")} />}
              {s.state === "upcoming" && <span className="tabular text-2xs font-semibold">{i + 1}</span>}
            </span>
            <span className="min-w-0 pt-0.5 md:pt-0">
              <span
                className={cn(
                  "block text-[13px] leading-5",
                  s.state === "current" ? "font-semibold text-ink" : s.state === "done" ? "font-medium text-ink" : "font-medium text-ink-muted",
                )}
              >
                {s.label}
                <span className="sr-only">, {stepStateText[s.state]}</span>
              </span>
              {s.hint && <span className="mt-0.5 block text-xs leading-4 text-ink-muted">{s.hint}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export type TimelineTone = "neutral" | "info" | "accent" | "success" | "warning" | "danger";
export type TimelineItem = {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  tone?: TimelineTone;
  icon?: LucideIcon;
};

const timelineDot: Record<TimelineTone, string> = {
  neutral: "bg-ink-subtle",
  info: "bg-info",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};
const timelineIcon: Record<TimelineTone, string> = {
  neutral: "text-ink-muted",
  info: "text-info-strong",
  accent: "text-accent-strong",
  success: "text-success-strong",
  warning: "text-warning-strong",
  danger: "text-danger-strong",
};

/** Vertical activity timeline with a connecting line. */
export function Timeline({ items, empty = "No activity yet.", className }: { items: TimelineItem[]; empty?: React.ReactNode; className?: string }) {
  if (!items.length) return <p className="text-sm text-ink-muted">{empty}</p>;
  return (
    <ol className={cn("relative", className)}>
      {items.map((it, i) => {
        const tone = it.tone ?? "neutral";
        return (
          <li key={it.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < items.length - 1 && <span className="absolute bottom-0 left-[11.5px] top-6 w-px bg-line" aria-hidden />}
            <span className="relative grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface" aria-hidden>
              {it.icon ? <it.icon className={cn("size-3.5", timelineIcon[tone])} /> : <span className={cn("size-2 rounded-full", timelineDot[tone])} />}
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="break-words text-sm leading-5 text-ink">{it.title}</div>
              {it.description && <div className="mt-0.5 break-words text-sm leading-5 text-ink-muted">{it.description}</div>}
              {it.meta && <div className="mt-0.5 text-xs leading-4 text-ink-muted">{it.meta}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------------------------------
 * In-page navigation
 * -----------------------------------------------------------------------------------------------*/

/** Horizontal "on this page" links for long record pages (scrolls inside itself on phones). */
export function AnchorNav({ items, label = "On this page", className }: { items: { href: string; label: string; count?: number }[]; label?: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("mb-6 overflow-x-auto border-b border-line", className)}>
      <ul className="flex min-w-max gap-6">
        {items.map((i) => (
          <li key={i.href}>
            <a
              href={i.href}
              className="-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 border-transparent text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:border-accent hover:text-ink"
            >
              {i.label}
              {i.count !== undefined && (
                <span className="tabular rounded-sm bg-surface-muted px-1.5 text-2xs font-semibold leading-[1.125rem] text-ink-muted">{i.count}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Loading
 * -----------------------------------------------------------------------------------------------*/

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-surface-muted", className)} aria-hidden />;
}

/** Route-level loading layout (header, metric strip, two-column cards). `variant="list"` shows a table instead. */
export function PageSkeleton({ variant = "dashboard" }: { variant?: "dashboard" | "list" | "detail" }) {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-8">
        <Skeleton className="mb-3 h-3 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      {variant !== "list" && (
        <div className="mb-8 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("space-y-3 p-5", i > 0 && "border-l border-line")}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </div>
      )}
      {variant === "list" ? (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="h-10 border-b border-line-strong" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-line-subtle px-5 py-4 last:border-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-5 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          {[0, 1].map((c) => (
            <div key={c} className="rounded-lg border border-line bg-surface">
              <div className="border-b border-line px-5 py-4">
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="space-y-4 p-5">
                {Array.from({ length: c === 0 ? 5 : 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export type { BadgeTone };
