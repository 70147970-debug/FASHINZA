import { Plus } from "lucide-react";
import type { FAQ } from "@/lib/faq";

/** Accessible disclosure list (native <details>), works without JavaScript. Ruled, editorial: no box. */
export function FaqList({ items }: { items: typeof FAQ }) {
  return (
    <div className="border-t border-line-strong">
      {items.map((f) => (
        <details key={f.q} className="group border-b border-line [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-display text-[1.0625rem] font-medium leading-6 tracking-[-0.01em] text-ink transition-colors duration-150 hover:text-accent-strong sm:text-lg">
            {f.q}
            <span
              className="grid size-8 shrink-0 place-items-center rounded-md border border-line-strong text-ink-muted transition-colors duration-150 group-open:border-accent group-open:bg-accent-soft group-open:text-accent-strong"
              aria-hidden
            >
              <Plus className="size-4 transition-transform duration-150 group-open:rotate-45" strokeWidth={1.75} />
            </span>
          </summary>
          <p className="-mt-1 max-w-[68ch] pb-6 pr-12 text-[0.9375rem] leading-7 text-ink-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
