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
  neutral: "bg-neutral-100 text-neutral-600",
  accent: "bg-teal-50 text-teal-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

/** "Needs your attention": one row per actionable thing, each linking to the filtered view that resolves it. */
export function AttentionList({ items, clear }: { items: AttentionItem[]; clear: string }) {
  if (!items.length) {
    return (
      <p className="flex items-center gap-3 px-4 py-4 text-sm text-muted sm:px-5">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-success-50 text-success-700">
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
            className="group flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-muted sm:px-5"
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", tile[it.tone])}>
              <it.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-5 text-navy">{it.title}</span>
              <span className="block text-[13px] leading-5 text-muted">{it.description}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-subtle transition-colors duration-150 group-hover:text-navy" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
