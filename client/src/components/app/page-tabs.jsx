import { Link } from "react-router";
import { cn } from "@fashinza/shared/utils.js";
import { TabStrip } from "./tab-strip";

/**
 * Section tabs for record pages. Each tab is a real link (`?tab=key`), so the selected section survives
 * a reload, can be shared, and works without JavaScript. Only the selected section is rendered by the page.
 * When the tabs do not fit (phones) the strip scrolls sideways, fades the clipped edge so the hidden tabs
 * read as "more this way", and scrolls the selected tab into view on load.
 */
export function PageTabs({ tabs, active, basePath, label }) {
  return (
    <TabStrip label={label} active={active} className="-mx-4 mb-6 border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <li key={t.key}>
              <Link
                to={`${basePath}?tab=${t.key}`}
                preventScrollReset
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                  selected ? "border-accent text-ink" : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={cn(
                      "tabular rounded-sm px-1.5 text-2xs font-semibold leading-[1.125rem]",
                      selected ? "bg-accent-soft text-accent-strong" : "bg-surface-muted text-ink-muted",
                    )}
                  >
                    {t.count}
                  </span>
                )}
                {t.attention && <span className="size-2 rounded-full bg-warning" aria-label="needs your action" role="img" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </TabStrip>
  );
}

/** Reads `?tab=` and falls back to the first tab when it is missing or unknown. */
export function resolveTab(value, keys, fallback) {
  return keys.includes(value) ? value : fallback;
}
