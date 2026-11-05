import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Playfair "Fashinza" wordmark with a small forest-green full stop (matches the app shell).
 * `inverted` sets it in ivory for bg-inverse bands and photographs.
 */
export function Logo({ className, inverted = false, href = "/" }: { className?: string; inverted?: boolean; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex min-h-10 shrink-0 items-center rounded-sm", className)}
      aria-label="Fashinza home"
    >
      <span className="inline-flex items-baseline" aria-hidden>
        <span
          className={cn(
            "font-display text-[1.4375rem] font-medium leading-none tracking-[-0.03em]",
            inverted ? "text-ink-inverse" : "text-ink",
          )}
        >
          Fashinza
        </span>
        <span className={cn("ml-0.5 size-[5px] translate-y-[-1px] rounded-full", inverted ? "bg-accent-inverse" : "bg-accent")} />
      </span>
    </Link>
  );
}
