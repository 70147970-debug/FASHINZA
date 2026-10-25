"use client";

import { Toaster as Sonner, toast } from "sonner";

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
            "!gap-2.5 !rounded-lg !border !border-line !bg-white !px-4 !py-3 !text-sm !text-ink !shadow-pop !font-sans [&_[data-title]]:!font-medium [&_[data-title]]:!text-navy",
          description: "!text-[13px] !text-muted",
          closeButton: "!border-line !bg-white !text-muted hover:!bg-neutral-100 hover:!text-navy",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
          warning: "[&_[data-icon]]:!text-warning",
          info: "[&_[data-icon]]:!text-slate-blue",
        },
      }}
    />
  );
}

export { toast };
