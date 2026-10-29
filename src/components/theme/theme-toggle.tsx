"use client";

import { useSyncExternalStore } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_OPTIONS, type ThemePreference } from "./theme";
import { readThemePreference, setThemePreference, subscribeTheme } from "./theme-client";

const ICONS: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

function useThemePreference(): ThemePreference {
  // The server cannot know the stored preference, so it renders "system"; React swaps in the real value
  // right after hydration without a mismatch.
  return useSyncExternalStore(subscribeTheme, readThemePreference, () => "system");
}

/**
 * Icon button (accessible name "Theme") that opens a small menu: Light / Dark / System.
 * Used in the app top bar and the public site header.
 *
 *   import { ThemeToggle } from "@/components/theme/theme-toggle";
 *   <ThemeToggle />                       // 36px (40px on phones) ghost icon button
 *   <ThemeToggle align="start" className="…" />
 */
export function ThemeToggle({ className, align = "end" }: { className?: string; align?: "start" | "center" | "end" }) {
  const pref = useThemePreference();
  const Icon = ICONS[pref];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Theme"
          title="Theme"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink data-[state=open]:bg-surface-hover data-[state=open]:text-ink max-sm:size-10",
            className,
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={8}
          className="z-50 w-44 rounded-lg border border-line bg-surface-raised p-1 text-ink shadow-pop"
        >
          <DropdownMenu.Label className="label-caps px-2.5 pb-1 pt-1.5 text-ink-muted">Theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={pref} onValueChange={(v) => setThemePreference(v as ThemePreference)}>
            {THEME_OPTIONS.map((o) => {
              const ItemIcon = ICONS[o.value];
              return (
                <DropdownMenu.RadioItem
                  key={o.value}
                  value={o.value}
                  className="flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-sm text-ink outline-none transition-colors data-[highlighted]:bg-surface-hover max-sm:h-10"
                >
                  <ItemIcon className="size-4 text-ink-muted" strokeWidth={1.75} aria-hidden />
                  <span className="flex-1">{o.label}</span>
                  <DropdownMenu.ItemIndicator>
                    <Check className="size-4 text-accent-strong" aria-hidden />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Segmented Light / Dark / System control (a group of toggle buttons named "Colour theme") for settings pages.
 *
 *   import { ThemeSegmented } from "@/components/theme/theme-toggle";
 *   <ThemeSegmented />
 */
export function ThemeSegmented({ className }: { className?: string }) {
  const pref = useThemePreference();
  return (
    <div role="group" aria-label="Colour theme" className={cn("inline-flex rounded-md border border-line-strong bg-surface p-0.5", className)}>
      {THEME_OPTIONS.map((o) => {
        const ItemIcon = ICONS[o.value];
        const on = pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => setThemePreference(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-[13px] font-medium transition-colors duration-150 max-sm:h-10",
              on ? "bg-primary text-primary-fg" : "text-ink-muted hover:bg-surface-hover hover:text-ink",
            )}
          >
            <ItemIcon className="size-3.5" strokeWidth={1.75} aria-hidden />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
