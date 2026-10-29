"use client";

import { Toaster as Sonner, toast } from "sonner";

/** Toasts on the raised surface (themed through tokens, so they follow light/dark automatically). */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      offset={{ top: 68, right: 20 }}
      mobileOffset={{ top: 64, left: 12, right: 12 }}
      toastOptions={{
        classNames: {
          toast:
            "!gap-2.5 !rounded-lg !border !border-line !bg-surface-raised !px-4 !py-3 !text-sm !text-ink !shadow-pop !font-sans [&_[data-title]]:!font-medium [&_[data-title]]:!text-ink",
          description: "!text-[13px] !text-ink-muted",
          closeButton: "!border-line !bg-surface-raised !text-ink-muted hover:!bg-surface-hover hover:!text-ink",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          warning: "[&_[data-icon]]:!text-warning",
          info: "[&_[data-icon]]:!text-info",
        },
      }}
    />
  );
}

export { toast };
