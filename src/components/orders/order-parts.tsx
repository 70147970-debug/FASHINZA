import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { FileText, ImageIcon } from "lucide-react";
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
        className="flex h-12 w-36 min-w-0 items-center gap-2 rounded-md border border-line bg-white px-2.5 text-xs font-medium text-navy transition-colors duration-150 hover:border-line-strong hover:bg-surface-muted"
      >
        <FileText className="size-4 shrink-0 text-slate-blue" aria-hidden />
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
        "relative block shrink-0 overflow-hidden rounded-md border border-line bg-surface-muted transition-colors duration-150 hover:border-line-strong",
        box,
      )}
    >
      <ImageIcon className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-subtle" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element -- private, authorised file route; not optimisable by next/image */}
      <img src={href} alt={alt} loading="lazy" className="relative size-full object-cover text-[0px]" />
    </a>
  );
}

/** Quiet one-line empty state for use inside a Panel (the full EmptyState is for whole pages). */
export function InlineEmpty({ icon: Icon, children, className }: { icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-sm text-muted", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-muted text-neutral-500">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Small uppercase label used for sub-sections inside a Panel. */
export function SubHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("label-caps mb-3 text-muted", className)}>{children}</h3>;
}

/**
 * Status filter as link tabs (GET, no JavaScript): "All" plus one tab per status. Used on lists whose only
 * filter is a status, so there is no search box that would do nothing. Other query params are kept.
 */
export function StatusTabs({
  basePath,
  value,
  options,
  param = "status",
  allValue,
  allLabel = "All",
  params = {},
  label = "Filter by status",
}: {
  basePath: string;
  value?: string;
  options: { value: string; label: string }[];
  param?: string;
  /** Query value for the "All" tab when the list defaults to a narrower view (e.g. "ALL"). */
  allValue?: string;
  allLabel?: string;
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
  const tabs = [{ value: allValue, label: allLabel }, ...options];
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto border-b border-line">
      <ul className="flex min-w-max gap-5">
        {tabs.map((t) => {
          const active = (t.value ?? undefined) === (value ?? allValue ?? undefined);
          return (
            <li key={t.value ?? "all"}>
              <Link
                href={href(t.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 text-[13px] font-medium transition-colors duration-150",
                  active ? "border-teal text-navy" : "border-transparent text-muted hover:border-line-strong hover:text-navy",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
