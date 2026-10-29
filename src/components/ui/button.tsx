import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Crisp rectangular buttons (4px radius, no pills, no shadows). Sizes: sm 32px, md 36px, lg 44px (marketing);
 * below `sm` every size grows to at least 40px so it is a comfortable touch target. Variants:
 *  - primary  ink (ivory in dark), the default action on a page
 *  - accent   terracotta: the single most important action on a screen ("Create production project")
 *  - outline  secondary actions (hairline border on surface)
 *  - ghost    tertiary / toolbar actions
 *  - subtle   quiet filled secondary (parchment)
 *  - danger   destructive confirmations
 *  - inverse  light button on bg-inverse bands
 *  - link     inline text action in accent-strong (no padding, no fixed height)
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary-hover",
        accent: "bg-accent text-accent-fg hover:bg-accent-hover",
        outline: "border border-line-strong bg-surface text-ink hover:border-line-control hover:bg-surface-hover",
        ghost: "text-ink hover:bg-surface-hover",
        subtle: "bg-surface-muted text-ink hover:bg-line",
        danger: "bg-danger text-danger-fg hover:bg-danger-strong",
        inverse: "bg-ink-inverse text-inverse hover:bg-ink-inverse/85",
        link: "rounded-xs text-accent-strong underline-offset-4 hover:underline hover:decoration-accent",
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. Not available with asChild. */
  loading?: boolean;
}

export function Button({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }: ButtonProps) {
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
