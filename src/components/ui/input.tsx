import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared control styling: 36px high (40px on phones), 1px strong line, teal focus ring, red when aria-invalid. */
export const fieldClass =
  "w-full min-w-0 rounded-md border border-line-strong bg-white px-3 text-sm text-ink shadow-card transition-colors duration-150 placeholder:text-subtle hover:border-neutral-400 focus:border-teal focus:outline-none focus:ring-[3px] focus:ring-teal/15 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        fieldClass,
        "h-9 max-sm:h-10 file:mr-3 file:h-full file:border-0 file:bg-transparent file:text-[13px] file:font-medium file:text-navy",
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
