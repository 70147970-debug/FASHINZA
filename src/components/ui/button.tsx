import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Buttons. Sizes: sm 32px, md 36px, lg 44px (marketing); below `sm` every size grows to at least 40px so it
 * is a comfortable touch target. Variants:
 *  - primary  navy, the default action on a page
 *  - accent   teal-700, create / advance actions ("Create production project", "Submit quotation")
 *  - outline  secondary actions
 *  - ghost    tertiary / toolbar actions
 *  - danger   destructive confirmations
 *  - link     inline text action (no padding, no fixed height)
 *  - subtle   quiet filled secondary (neutral tint)
 *  - inverse  white button on navy bands
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-navy text-white shadow-card hover:bg-navy-800 active:bg-navy-700",
        accent: "bg-teal-700 text-white shadow-card hover:bg-teal-800 active:bg-teal-800",
        outline: "border border-line-strong bg-white text-navy shadow-card hover:border-neutral-400 hover:bg-surface-muted",
        ghost: "text-navy hover:bg-neutral-100",
        subtle: "bg-neutral-100 text-navy hover:bg-navy-100",
        danger: "bg-danger text-white shadow-card hover:bg-danger-700",
        inverse: "bg-white text-navy hover:bg-navy-50",
        link: "rounded-sm text-teal-700 underline-offset-4 hover:text-teal-800 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[13px] max-sm:h-10",
        md: "h-9 px-4 text-sm max-sm:h-10",
        lg: "h-11 px-5 text-[0.9375rem]",
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
