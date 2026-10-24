import { ChevronDown } from "lucide-react";
import type { FAQ } from "@/lib/faq";

/** Accessible disclosure list (native <details>), works without JavaScript. */
export function FaqList({ items }: { items: typeof FAQ }) {
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-white">
      {items.map((f) => (
        <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-navy">
            {f.q}
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
