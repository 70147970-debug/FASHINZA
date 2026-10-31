import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { DescriptionList } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

/*
 * Building blocks for the factory's opportunity page (src/app/(app)/opportunities/[id]/page.tsx).
 * Server components.
 */

export type NextStepTone = "action" | "warning" | "waiting" | "success" | "closed";

const toneStyles: Record<NextStepTone, { card: string; icon: string }> = {
  action: { card: "border-accent-line bg-accent-soft", icon: "border-accent-line bg-surface text-accent-strong" },
  warning: { card: "border-warning-line bg-warning-soft", icon: "border-warning-line bg-surface text-warning-strong" },
  waiting: { card: "border-line bg-surface", icon: "border-line bg-canvas text-ink-muted" },
  success: { card: "border-success-line bg-success-soft", icon: "border-success-line bg-surface text-success-strong" },
  closed: { card: "border-line bg-surface-muted", icon: "border-line bg-surface text-ink-muted" },
};

/**
 * "Your next step": the one thing this viewer should do now, with the control for it. When nothing is
 * required of them the card is calm (`waiting` / `closed`) and says who they are waiting for.
 */
export function NextStepCard({
  tone,
  icon: Icon,
  title,
  children,
  actions,
  className,
}: {
  tone: NextStepTone;
  icon: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = toneStyles[tone];
  return (
    <section aria-labelledby="next-step-title" className={cn("mb-6 rounded-lg border px-4 py-4 sm:px-5", t.card, className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 gap-3.5">
          <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-md border", t.icon)}>
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="eyebrow text-ink-muted">Your next step</p>
            <h2 id="next-step-title" className="type-heading mt-1 break-words text-ink">
              {title}
            </h2>
            {children && <div className="mt-1 text-sm leading-6 text-ink-muted [overflow-wrap:anywhere]">{children}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 max-md:pl-[3.125rem] max-sm:pl-0 max-sm:[&>*]:grow md:shrink-0">{actions}</div>}
      </div>
    </section>
  );
}

export type BriefItem = { label: string; value: React.ReactNode };

/**
 * The requirements a factory needs while pricing, kept beside the quotation form: a sticky side card on
 * lg+ screens and a collapsed disclosure above the form on smaller ones.
 */
export function BriefSummary({ items, footer, variant }: { items: BriefItem[]; footer?: React.ReactNode; variant: "aside" | "disclosure" }) {
  if (variant === "disclosure") {
    return (
      <details className="group rounded-lg border border-line bg-surface lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
          <span>Brief at a glance</span>
          <ChevronDown className="size-4 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-line px-4 py-4">
          <DescriptionList layout="rows" items={items} />
          {footer && <div className="mt-4 border-t border-line-subtle pt-3 text-[13px] leading-5">{footer}</div>}
        </div>
      </details>
    );
  }
  return (
    <aside aria-labelledby="brief-summary-title" className="hidden lg:block">
      <div className="sticky top-24 rounded-lg border border-line bg-surface">
        <h2 id="brief-summary-title" className="border-b border-line px-5 py-3.5 text-sm font-semibold text-ink">
          Brief at a glance
        </h2>
        <div className="px-5 py-4">
          <DescriptionList layout="rows" items={items} />
          {footer && <div className="mt-4 border-t border-line-subtle pt-3 text-[13px] leading-5">{footer}</div>}
        </div>
      </div>
    </aside>
  );
}

/** Inline link to another tab of the same page. */
export function TabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} className="rounded-xs font-medium text-accent-strong underline-offset-4 hover:underline hover:decoration-accent">
      {children}
    </Link>
  );
}
