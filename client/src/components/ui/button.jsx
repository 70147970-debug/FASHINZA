import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@fashinza/shared/utils.js";

/**
 * Tailored buttons (6px radius, no pills). Filled variants carry a 1px top highlight and a soft shadow that deepens
 * on hover (the accent button glows faintly green), and every button presses down 1px when clicked. Sizes: sm
 * 32px, md 36px, lg 44px (marketing); below `sm` every size grows to at least 40px so it is a comfortable touch
 * target. `group/button` lets a trailing arrow nudge on hover (`group-hover/button:translate-x-0.5`). Variants:
 *  - primary  ink (ivory in dark), the default action on a page
 *  - accent   forest green: the single most important action on a screen ("Create production project")
 *  - outline  secondary actions (hairline border on surface)
 *  - ghost    tertiary / toolbar actions
 *  - subtle   quiet filled secondary (muted surface)
 *  - danger   destructive confirmations
 *  - inverse  light button on bg-inverse bands
 *  - link     inline text action in accent-strong (no padding, no fixed height)
 */
const buttonVariants = cva(
  "group/button relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[color,background-color,border-color,box-shadow,translate] duration-200 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_var(--color-shadow)] hover:bg-primary-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_8px_20px_-10px_var(--color-shadow)]",
        accent:
          "bg-accent text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_var(--color-shadow)] hover:bg-accent-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-10px_color-mix(in_srgb,var(--color-accent)_75%,transparent)]",
        outline:
          "border border-line-strong bg-surface text-ink shadow-[0_1px_2px_var(--color-shadow-soft)] hover:border-line-control hover:bg-surface-hover",
        ghost: "text-ink hover:bg-surface-hover",
        subtle: "bg-surface-muted text-ink hover:bg-line",
        danger: "bg-danger text-danger-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_var(--color-shadow)] hover:bg-danger-strong",
        inverse: "bg-ink-inverse text-inverse shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_var(--color-shadow)] hover:bg-ink-inverse/85",
        link: "rounded-xs text-accent-strong underline-offset-4 hover:underline hover:decoration-accent active:translate-y-0",
      },
      size: {
        sm: "h-8 px-3 text-[13px] max-sm:h-10",
        md: "h-9 px-4 text-sm max-sm:h-10",
        lg: "h-11 px-6 text-[0.9375rem]",
        icon: "size-9 max-sm:size-10",
      },
    },
    compoundVariants: [
      // Inline text links never get a fixed height or horizontal padding, whatever size is passed.
      { variant: "link", size: ["sm", "md", "lg", "icon"], class: "h-auto px-0 max-sm:h-auto" },
      { variant: "link", size: "sm", class: "text-[13px]" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }) {
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || props["aria-busy"] || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export { buttonVariants };
