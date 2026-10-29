import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small, quiet label: a 3px-radius soft tint with optional leading dot (never a loud pill).
 * Tones: neutral, info, accent, success, warning, danger, plus `ink` (solid) and `outline`.
 * Status badges (see StatusBadge) show the dot.
 */
const badgeVariants = cva(
  "inline-flex h-[1.375rem] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-ink-muted",
        info: "bg-info-soft text-info-strong",
        accent: "bg-accent-soft text-accent-strong",
        success: "bg-success-soft text-success-strong",
        warning: "bg-warning-soft text-warning-strong",
        danger: "bg-danger-soft text-danger-strong",
        ink: "bg-primary text-primary-fg",
        outline: "border border-line-strong bg-transparent text-ink-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const dotTone: Record<string, string> = {
  neutral: "bg-ink-subtle",
  info: "bg-info",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  ink: "bg-primary-fg",
  outline: "bg-ink-subtle",
};

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className={cn("size-1.5 shrink-0 rounded-full", dotTone[tone ?? "neutral"])} aria-hidden />}
      {children}
    </span>
  );
}

export { badgeVariants };
