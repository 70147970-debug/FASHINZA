import * as React from "react";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

/**
 * Initials avatar for people (round) and organisations (square). Decorative by default: the name should
 * also appear as text next to it.
 */
export function Avatar({
  name,
  shape = "circle",
  size = "md",
  tone = "teal",
  className,
}: {
  name: string;
  shape?: "circle" | "square";
  size?: "sm" | "md" | "lg";
  tone?: "teal" | "navy" | "neutral";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 select-none place-items-center font-display font-semibold",
        shape === "circle" ? "rounded-full" : "rounded-md",
        { sm: "size-7 text-[11px]", md: "size-8 text-xs", lg: "size-10 text-sm" }[size],
        { teal: "bg-teal-50 text-teal-700", navy: "bg-navy text-white", neutral: "bg-neutral-100 text-neutral-700" }[tone],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
