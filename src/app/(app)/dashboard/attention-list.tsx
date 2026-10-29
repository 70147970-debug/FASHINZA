import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  tone: "neutral" | "accent" | "warning" | "danger";
};

const tile: Record<AttentionItem["tone"], string> = {
  neutral: "border border-line bg-canvas text-ink-muted",
  accent: "bg-accent-soft text-accent-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
};

/** "Needs your attention": one row per actionable thing, each linking to the filtered view that resolves it. */
export function AttentionList({ items, clear }: { items: AttentionItem[]; clear: string }) {
  if (!items.length) {
    return (
      <p className="flex items-center gap-3 px-4 py-4 text-sm text-ink-muted sm:px-5">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-success-soft text-success-strong">
          <CircleCheck className="size-4" aria-hidden />
        </span>
        {clear}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line-subtle">
      {items.map((it) => (
        <li key={it.key}>
          <Link
            href={it.href}
            className="group flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:px-5"
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", tile[it.tone])}>
              <it.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-5 text-ink">{it.title}</span>
              <span className="block text-[13px] leading-5 text-ink-muted">{it.description}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-colors duration-150 group-hover:text-accent-strong" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
