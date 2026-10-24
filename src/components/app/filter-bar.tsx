import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

/** GET filter form: works without JavaScript and keeps filters in the URL (shareable, back-button friendly). */
export function FilterBar({
  basePath,
  q,
  searchLabel = "Search",
  selects = [],
  hidden = {},
}: {
  basePath: string;
  q?: string;
  searchLabel?: string;
  selects?: { name: string; label: string; value?: string; options: { value: string; label: string }[] }[];
  hidden?: Record<string, string | undefined>;
}) {
  const active = !!q || selects.some((s) => s.value) || Object.values(hidden).some(Boolean);
  return (
    <form action={basePath} className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      {Object.entries(hidden).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <label htmlFor="filter-q" className="sr-only">{searchLabel}</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="filter-q" name="q" type="search" defaultValue={q} placeholder={searchLabel} className="pl-9" />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="sm:w-48">
          <label htmlFor={`filter-${s.name}`} className="sr-only">{s.label}</label>
          <Select id={`filter-${s.name}`} name={s.name} defaultValue={s.value ?? ""}>
            <option value="">{s.label}: all</option>
            {s.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" variant="outline">Apply</Button>
        {active && <Button asChild variant="ghost"><Link href={basePath}>Clear</Link></Button>}
      </div>
    </form>
  );
}
