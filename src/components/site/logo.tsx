import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-semibold", className)} aria-label="Fashinza home">
      <span
        aria-hidden
        className={cn(
          "grid size-8 place-items-center rounded-md text-sm font-bold",
          inverted ? "bg-white text-navy" : "bg-navy text-white",
        )}
      >
        F
      </span>
      <span className={cn("text-lg tracking-tight", inverted ? "text-white" : "text-navy")}>Fashinza</span>
    </Link>
  );
}
