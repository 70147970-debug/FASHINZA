import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, ChevronRight as Crumb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Page title, breadcrumb and contextual actions shown at the top of every app page. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
}: {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: { href: string; label: string }[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
              {breadcrumbs.map((b) => (
                <li key={b.href} className="flex items-center gap-1">
                  <Link href={b.href} className="hover:text-navy hover:underline">{b.label}</Link>
                  <Crumb className="size-3" aria-hidden />
                </li>
              ))}
              <li aria-current="page" className="truncate text-ink">{title}</li>
            </ol>
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-words text-xl font-semibold sm:text-2xl">{title}</h1>
          {meta}
        </div>
        {description && <div className="mt-1 max-w-3xl text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ map, value, className }: { map: Record<string, { label: string; tone: React.ComponentProps<typeof Badge>["tone"] }>; value: string; className?: string }) {
  const s = map[value] ?? { label: value, tone: "neutral" as const };
  return <Badge tone={s.tone} className={className}>{s.label}</Badge>;
}

/** Dashboard metric. Always links to the filtered list it counts. */
export function StatCard({ label, value, href, icon: Icon, tone = "neutral", hint }: { label: string; value: React.ReactNode; href: string; icon: LucideIcon; tone?: "neutral" | "warning" | "danger" | "success"; hint?: string }) {
  const toneCls = { neutral: "bg-navy-50 text-navy", warning: "bg-warning-50 text-warning-700", danger: "bg-danger-50 text-danger-700", success: "bg-success-50 text-success" }[tone];
  return (
    <Link href={href} className="group flex items-start gap-3 rounded-lg border border-line bg-white p-4 shadow-card transition-colors hover:border-slate-blue/40 focus-visible:border-teal">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", toneCls)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted">{label}</span>
        <span className="tabular mt-0.5 block font-display text-2xl font-semibold text-navy">{value}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </Link>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-line bg-white px-6 py-10 text-center", className)}>
      <span className="mb-3 grid size-11 place-items-center rounded-full bg-navy-50 text-slate-blue">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-1 max-w-md text-sm text-muted">{description}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, id, bodyClassName }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string; bodyClassName?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 rounded-lg border border-line bg-white shadow-card", className)} aria-labelledby={id && title ? `${id}-title` : undefined}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 id={id ? `${id}-title` : undefined} className="text-base font-semibold">{title}</h2>}
            {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Definition list for record details; collapses to one column on phones. */
export function DetailList({ items, columns = 2 }: { items: { label: string; value: React.ReactNode }[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 text-sm", cols)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words text-ink">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Server-rendered pagination that keeps the current filters in the URL. */
export function Pagination({ page, pages, total, basePath, params }: { page: number; pages: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  if (pages <= 1) return <p className="mt-4 text-xs text-muted">{total} {total === 1 ? "result" : "results"}</p>;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${q}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-xs text-muted">Page {page} of {pages} · {total} results</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm"><Link href={href(page - 1)} rel="prev"><ChevronLeft /> Previous</Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled><ChevronLeft /> Previous</Button>
        )}
        {page < pages ? (
          <Button asChild variant="outline" size="sm"><Link href={href(page + 1)} rel="next">Next <ChevronRight /></Link></Button>
        ) : (
          <Button variant="outline" size="sm" disabled>Next <ChevronRight /></Button>
        )}
      </div>
    </nav>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-navy-50", className)} aria-hidden />;
}

/** Generic loading layout used by route-level loading.tsx files. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="mb-2 h-3 w-32" />
      <Skeleton className="mb-8 h-7 w-64" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-64" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** A small "sandbox / demo" marker used wherever behaviour is simulated. */
export function SandboxBadge({ children = "Sandbox mode" }: { children?: React.ReactNode }) {
  return <Badge tone="warning">{children}</Badge>;
}
