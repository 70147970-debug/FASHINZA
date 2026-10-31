import Link from "next/link";
import { cn } from "@/lib/utils";

export type PageTab = {
  key: string;
  label: string;
  /** Small number after the label (items in the tab). */
  count?: number;
  /** Shows a dot: something in this tab needs the viewer's action. */
  attention?: boolean;
};

/**
 * Section tabs for record pages. Each tab is a real link (`?tab=key`), so the selected section survives
 * a reload, can be shared, and works without JavaScript. Only the selected section is rendered by the page.
 * Scrolls sideways on narrow screens instead of wrapping.
 */
export function PageTabs({ tabs, active, basePath, label }: { tabs: PageTab[]; active: string; basePath: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={`${basePath}?tab=${t.key}`}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                  selected ? "border-accent text-ink" : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={cn("tabular rounded-sm px-1.5 text-2xs font-semibold leading-[1.125rem]", selected ? "bg-accent-soft text-accent-strong" : "bg-surface-muted text-ink-muted")}>
                    {t.count}
                  </span>
                )}
                {t.attention && (
                  <span className="size-2 rounded-full bg-warning" aria-label="needs your action" role="img" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Reads `?tab=` and falls back to the first tab when it is missing or unknown. */
export function resolveTab<T extends string>(value: string | undefined, keys: readonly T[], fallback: T): T {
  return keys.includes(value as T) ? (value as T) : fallback;
}
