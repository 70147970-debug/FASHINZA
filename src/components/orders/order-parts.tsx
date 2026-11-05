import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { FileText, ImageIcon } from "lucide-react";
import { TabStrip } from "@/components/app/tab-strip";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Small presentational pieces shared by the order, payment and admin screens.
 */

const shortDateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "24 Oct" (UTC, like lib/format). For dense places where the year is obvious. */
export function shortDate(d: Date | string | null | undefined) {
  return d ? shortDateFmt.format(new Date(d)) : "—";
}

/** "5 Nov – 9 Nov 2026", or a single date when both ends fall on the same day. */
export function dateRange(start: Date | string | null | undefined, end: Date | string | null | undefined) {
  if (!start || !end) return `${shortDate(start)} – ${formatDate(end)}`;
  const same = new Date(start).toISOString().slice(0, 10) === new Date(end).toISOString().slice(0, 10);
  return same ? formatDate(end) : `${shortDate(start)} – ${formatDate(end)}`;
}

/**
 * Fixed-size link to an uploaded file. Images are cropped into the box (object-cover) so a broken or odd-sized
 * image never moves the layout; other files show a document tile with the file name.
 */
export function FileThumb({
  fileKey,
  fileName,
  mimeType,
  alt,
  title,
  size = "md",
}: {
  fileKey: string;
  fileName: string;
  mimeType?: string;
  alt: string;
  title?: string;
  size?: "sm" | "md" | "lg";
}) {
  const href = `/api/files/${fileKey}`;
  const isImage = mimeType ? mimeType.startsWith("image/") : true;
  const box = { sm: "size-12", md: "size-16", lg: "size-20" }[size];
  if (!isImage) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        title={title ?? fileName}
        className="flex h-12 w-36 min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover"
      >
        <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <span className="truncate">{fileName}</span>
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      title={title ?? fileName}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md border border-line bg-surface-sunken transition-colors duration-150 hover:border-line-strong",
        box,
      )}
    >
      <ImageIcon className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element -- private, authorised file route; not optimisable by next/image */}
      <img src={href} alt={alt} loading="lazy" className="relative size-full object-cover text-[0px]" />
    </a>
  );
}

/** Quiet one-line empty state for use inside a Panel (the full EmptyState is for whole pages). */
export function InlineEmpty({ icon: Icon, children, className }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-sm text-ink-muted", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-canvas text-ink-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Small uppercase label used for sub-sections inside a Panel. */
export function SubHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("label-caps mb-3 text-ink-muted", className)}>{children}</h3>;
}

export type StatusTabOption = {
  value: string;
  label: string;
  /** Small number after the label (shown whenever it is defined, including 0). */
  count?: number;
  /** Colours the count as a warning while it is above zero (a queue with work waiting). */
  attention?: boolean;
  /** Screen-reader words after the count, e.g. "unread". */
  countLabel?: string;
};

/**
 * The one status filter for list pages (projects, orders, quotations, payments, disputes, notifications and the
 * admin queues): link tabs that work without JavaScript, keep the other query params (search, toggles) and drop
 * the page number. "All" comes first unless `allPosition="end"` (queues whose default view is a single status).
 * On phones the strip scrolls sideways with a faded edge and keeps the selected tab in view (see TabStrip).
 */
export function StatusTabs({
  basePath,
  value,
  options,
  param = "status",
  allValue,
  allLabel = "All",
  allCount,
  allPosition = "start",
  params = {},
  label = "Filter by status",
}: {
  basePath: string;
  value?: string;
  options: StatusTabOption[];
  param?: string;
  /** Query value for the "All" tab when the list defaults to a narrower view (e.g. "ALL"). */
  allValue?: string;
  allLabel?: string;
  allCount?: number;
  allPosition?: "start" | "end";
  params?: Record<string, string | undefined>;
  label?: string;
}) {
  const href = (v: string | undefined) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, val]) => val && k !== param && k !== "page" && q.set(k, val));
    if (v) q.set(param, v);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  type Tab = Omit<StatusTabOption, "value"> & { value: string | undefined };
  const all: Tab = { value: allValue, label: allLabel, count: allCount };
  const tabs: Tab[] = allPosition === "end" ? [...options, all] : [all, ...options];
  const selected = value ?? allValue ?? undefined;
  return (
    <TabStrip label={label} active={selected ?? "all"} className="-mx-4 mb-4 border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-5">
        {tabs.map((t) => {
          const active = (t.value ?? undefined) === selected;
          return (
            <li key={t.value ?? "all"}>
              <Link
                href={href(t.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center gap-2 whitespace-nowrap border-b-2 text-sm transition-colors duration-150",
                  active ? "border-accent font-medium text-ink" : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "tabular rounded-sm px-1.5 text-2xs font-semibold leading-[1.125rem]",
                      t.attention && t.count > 0 ? "bg-warning-soft text-warning-strong" : active ? "bg-accent-soft text-accent-strong" : "bg-surface-muted text-ink-muted",
                    )}
                  >
                    {t.count}
                    {t.countLabel && <span className="sr-only"> {t.countLabel}</span>}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </TabStrip>
  );
}
