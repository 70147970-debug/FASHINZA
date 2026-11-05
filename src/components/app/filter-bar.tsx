import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoSubmitSelect } from "./auto-submit-select";

/**
 * GET filter form: works without JavaScript and keeps filters in the URL (shareable, back-button friendly).
 *
 * - The search box only renders when the page passes `searchLabel` (i.e. the list really supports `q`).
 *   Status filters belong in <StatusTabs>; `selects` are for other dimensions (role, record type) and apply
 *   as soon as an option is chosen.
 * - `hidden` carries the page's current view (a status tab, a "delayed" toggle) through a search.
 * - "Clear" appears only when the search or a select is set, and clears just those: the current tab or toggle
 *   in `hidden` is kept, and the page number is dropped.
 */
export function FilterBar({
  basePath,
  q,
  searchLabel,
  selects = [],
  hidden = {},
}: {
  basePath: string;
  q?: string;
  /** Accessible name and placeholder of the search box. Omit it to render no search box. */
  searchLabel?: string;
  selects?: { name: string; label: string; value?: string; options: { value: string; label: string }[] }[];
  hidden?: Record<string, string | undefined>;
}) {
  const active = (!!searchLabel && !!q) || selects.some((s) => s.value);
  const keep = new URLSearchParams(Object.entries(hidden).filter((e): e is [string, string] => !!e[1]));
  const clearHref = keep.size ? `${basePath}?${keep}` : basePath;
  if (!searchLabel && selects.length === 0) return null;
  return (
    <form action={basePath} className="mb-4 flex flex-wrap items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      {searchLabel && (
        <div className="relative min-w-0 flex-1 basis-44 sm:max-w-xs">
          <label htmlFor="filter-q" className="sr-only">{searchLabel}</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden />
          <Input id="filter-q" name="q" type="search" defaultValue={q} placeholder={searchLabel} className="pl-9" />
        </div>
      )}
      {selects.map((s) => (
        <div key={s.name} className="min-w-0 flex-1 basis-40 sm:w-48 sm:flex-none">
          <label htmlFor={`filter-${s.name}`} className="sr-only">{s.label}</label>
          <AutoSubmitSelect id={`filter-${s.name}`} name={s.name} defaultValue={s.value ?? ""}>
            <option value="">{s.label}: all</option>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </AutoSubmitSelect>
        </div>
      ))}
      <div className="flex shrink-0 gap-2">
        <Button type="submit" variant="outline">{searchLabel ? "Search" : "Apply"}</Button>
        {active && (
          <Button asChild variant="ghost" className="text-ink-muted hover:text-ink">
            <Link href={clearHref}><X aria-hidden /> {selects.length === 0 ? "Clear search" : "Clear"}</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
