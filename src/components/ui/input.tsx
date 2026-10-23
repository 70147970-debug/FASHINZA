import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:bg-canvas aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "h-10 pr-8", className)} {...props} />;
}
