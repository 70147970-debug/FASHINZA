"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  className,
  children,
  title,
  side = "right",
  hideTitle = false,
  ...props
}: React.ComponentProps<typeof Dialog.Content> & { title: string; side?: "left" | "right"; hideTitle?: boolean }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-[85vw] max-w-sm flex-col bg-white p-5 shadow-pop focus:outline-none",
          side === "right" ? "right-0" : "left-0",
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-center justify-between">
          <Dialog.Title className={cn("text-base font-semibold text-navy", hideTitle && "sr-only")}>{title}</Dialog.Title>
          <Dialog.Close className="ml-auto rounded-md p-2 text-navy hover:bg-navy-50" aria-label="Close menu">
            <X className="size-5" />
          </Dialog.Close>
        </div>
        <Dialog.Description className="sr-only">{title}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
