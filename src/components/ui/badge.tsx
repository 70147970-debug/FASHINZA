import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Pill label. Tones: neutral, info, accent, success, warning, danger (plus `navy`, a solid navy pill).
 * `teal` is a legacy alias of `accent`. Status badges (see StatusBadge) show a small leading dot.
 */
const badgeVariants = cva(
  "inline-flex h-[1.375rem] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "bg-neutral-100 text-neutral-700",
        info: "bg-info-50 text-slate-blue",
        accent: "bg-teal-50 text-teal-700",
        teal: "bg-teal-50 text-teal-700",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
        navy: "bg-navy text-white",
        outline: "border border-line-strong bg-white text-neutral-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const dotTone: Record<string, string> = {
  neutral: "bg-neutral-400",
  info: "bg-slate-blue",
  accent: "bg-teal",
  teal: "bg-teal",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  navy: "bg-white",
  outline: "bg-neutral-400",
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
