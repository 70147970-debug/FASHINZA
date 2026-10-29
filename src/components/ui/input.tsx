import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared control styling: 36px high (40px on phones), 4px radius, 1px line-control border (≥3:1), terracotta
 * focus border + soft ring, brick red when aria-invalid.
 */
export const fieldClass =
  "w-full min-w-0 rounded-md border border-line-control bg-surface px-3 text-sm text-ink transition-colors duration-150 placeholder:text-ink-placeholder hover:border-ink-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        fieldClass,
        "h-9 max-sm:h-10 file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "select-chevron h-9 cursor-pointer pr-9 max-sm:h-10", className)} {...props} />;
}
