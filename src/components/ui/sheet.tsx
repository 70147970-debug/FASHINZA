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
  ...props
}: React.ComponentProps<typeof Dialog.Content> & { title: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[85vw] max-w-sm flex-col bg-white p-5 shadow-pop focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className="mb-4 flex items-center justify-between">
          <Dialog.Title className="text-base font-semibold text-navy">{title}</Dialog.Title>
          <Dialog.Close className="rounded-md p-2 text-navy hover:bg-navy-50" aria-label="Close menu">
            <X className="size-5" />
          </Dialog.Close>
        </div>
        <Dialog.Description className="sr-only">{title}</Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
