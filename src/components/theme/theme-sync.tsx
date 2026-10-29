"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readThemePreference, subscribeTheme } from "./theme-client";

/**
 * Mounted once in the root layout. Re-applies the theme after hydration (React's development remount resets
 * the attributes on <html> that the inline script set) and keeps every page in sync with OS changes and
 * with choices made in other tabs. Renders nothing.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readThemePreference());
    return subscribeTheme(() => {});
  }, []);
  return null;
}
