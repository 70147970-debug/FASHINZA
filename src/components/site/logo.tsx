import Link from "next/link";
import { cn } from "@/lib/utils";

/** Navy monogram + Manrope wordmark (matches the app shell). `inverted` for navy backgrounds. */
export function Logo({ className, inverted = false, href = "/" }: { className?: string; inverted?: boolean; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex shrink-0 items-center gap-2.5 rounded-md", className)} aria-label="Fashinza home">
      <span
        aria-hidden
        className={cn(
          "grid size-7 place-items-center rounded-md font-display text-[13px] font-bold",
          inverted ? "bg-white text-navy" : "bg-navy text-white",
        )}
      >
        F
      </span>
      <span aria-hidden className={cn("font-display text-[17px] font-semibold tracking-[-0.02em]", inverted ? "text-white" : "text-navy")}>
        Fashinza
      </span>
    </Link>
  );
}
