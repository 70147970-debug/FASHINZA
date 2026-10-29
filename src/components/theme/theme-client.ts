"use client";

import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "./theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readThemePreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== "system") return pref;
  try {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Writes the resolved theme to <html data-theme>. With `instant` (a user-initiated switch) transitions are
 * suppressed for a frame so the whole UI does not animate its colours at once.
 */
export function applyTheme(pref: ThemePreference = readThemePreference(), instant = false) {
  const root = document.documentElement;
  const next = resolveTheme(pref);
  if (root.getAttribute("data-theme") === next) return;
  if (instant) root.classList.add("fz-theme-switching");
  root.setAttribute("data-theme", next);
  if (instant) {
    // Force a style flush with transitions disabled, then re-enable them after the next frame.
    void window.getComputedStyle(root).color;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => root.classList.remove("fz-theme-switching")));
  }
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  applyTheme(pref, true);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: pref }));
}

/** Subscribe to anything that can change the preference or the resolved theme. */
export function subscribeTheme(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === THEME_STORAGE_KEY) {
      applyTheme(readThemePreference(), true);
      callback();
    }
  };
  let mq: MediaQueryList | null = null;
  try {
    mq = window.matchMedia(DARK_QUERY);
  } catch {
    mq = null;
  }
  const onMedia = () => {
    if (readThemePreference() === "system") applyTheme("system", true);
    callback();
  };
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  mq?.addEventListener("change", onMedia);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
    mq?.removeEventListener("change", onMedia);
  };
}
