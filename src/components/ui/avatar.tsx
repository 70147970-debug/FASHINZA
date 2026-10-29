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
 * Initials avatar for people (round) and organisations (square), set in Fraunces. Decorative by default:
 * the name should also appear as text next to it.
 * Tones: `accent` (terracotta tint), `ink` (solid), `neutral`.
 */
export function Avatar({
  name,
  shape = "circle",
  size = "md",
  tone = "accent",
  className,
}: {
  name: string;
  shape?: "circle" | "square";
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "ink" | "neutral";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 select-none place-items-center font-display font-medium tracking-[0.01em]",
        shape === "circle" ? "rounded-full" : "rounded-md",
        { sm: "size-7 text-[11px]", md: "size-8 text-xs", lg: "size-10 text-sm" }[size],
        {
          accent: "bg-accent-soft text-accent-strong",
          ink: "bg-primary text-primary-fg",
          neutral: "bg-surface-muted text-ink-muted",
        }[tone],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
