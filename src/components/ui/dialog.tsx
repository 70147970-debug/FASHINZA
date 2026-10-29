"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * Accessible modal: focus is trapped, Escape closes it, and it scrolls within the viewport on small screens.
 * `size`: sm 400px, md 512px (default), lg 640px. 8px radius, raised surface, the one place with a soft shadow. Put the action row last in children; ActionDialog does this.
 */
export function DialogContent({
  title,
  description,
  className,
  size = "md",
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: React.ReactNode; size?: "sm" | "md" | "lg" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface-raised text-ink shadow-pop focus:outline-none",
          { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size],
          className,
        )}
        {...props}
      >
        <div className="px-6 pt-6 pb-1 pr-14 max-sm:px-5 max-sm:pt-5">
          <DialogPrimitive.Title className="font-display text-xl font-medium leading-7 tracking-[-0.015em] text-ink">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-sm leading-6 text-ink-muted">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        <div className="overflow-y-auto px-6 pt-4 pb-6 max-sm:px-5 max-sm:pb-5">{children}</div>
        {/* Last in DOM order so initial focus lands on the first form control, not on Close. */}
        <DialogPrimitive.Close
          className="absolute right-3 top-3.5 grid size-9 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink max-sm:size-10"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
