import { Plus } from "lucide-react";
import type { FAQ } from "@/lib/faq";

/** Accessible disclosure list (native <details>), works without JavaScript. */
export function FaqList({ items }: { items: typeof FAQ }) {
  return (
    <div className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line bg-white shadow-card">
      {items.map((f) => (
        <details key={f.q} className="group [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-[0.9375rem] font-semibold text-navy transition-colors duration-150 hover:bg-surface-muted sm:px-6">
            {f.q}
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-neutral-500 transition-colors duration-150 group-open:border-teal-100 group-open:bg-teal-50 group-open:text-teal-700" aria-hidden>
              <Plus className="size-3.5 group-open:rotate-45" />
            </span>
          </summary>
          <p className="-mt-1 max-w-[68ch] px-5 pb-5 text-sm leading-6 text-muted sm:px-6">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
