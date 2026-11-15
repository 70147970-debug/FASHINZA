import { Toaster as Sonner, toast } from "sonner";

/** Toasts on a strong liquid-glass surface (themed through tokens, so they follow light/dark automatically). */
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
            "!glass-strong !gap-2.5 !rounded-xl !border !border-line !px-4 !py-3 !text-sm !text-ink !font-sans [&_[data-title]]:!font-medium [&_[data-title]]:!text-ink",
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
