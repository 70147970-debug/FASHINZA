"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

/**
 * Side drawer (a Radix dialog). The title is always the dialog's accessible name; `hideTitle` keeps it for
 * screen readers only, in which case the close button floats in the top-right corner over the content.
 */
export function SheetContent({
  className,
  children,
  title,
  side = "right",
  hideTitle = false,
  ...props
}: React.ComponentProps<typeof Dialog.Content> & { title: string; side?: "left" | "right"; hideTitle?: boolean }) {
  const close = (
    <Dialog.Close
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink",
        hideTitle && "absolute right-2 top-2 z-10",
      )}
      aria-label="Close menu"
    >
      <X className="size-5" />
    </Dialog.Close>
  );
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-[85vw] max-w-sm flex-col overflow-y-auto bg-surface-raised p-5 text-ink shadow-pop focus:outline-none",
          side === "right" ? "right-0 border-l border-line" : "left-0 border-r border-line",
          className,
        )}
        {...props}
      >
        {hideTitle ? (
          <>
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            {close}
          </>
        ) : (
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="font-display text-lg font-medium text-ink">{title}</Dialog.Title>
            <span className="-mr-2">{close}</span>
          </div>
        )}
        <Dialog.Description className="sr-only">{title}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
