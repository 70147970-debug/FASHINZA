/**
 * Theme preference shared by the no-flash inline script (app/layout.tsx), ThemeSync and ThemeToggle.
 *
 * The preference is stored in localStorage under THEME_STORAGE_KEY as "light" | "dark" | "system"
 * (default "system", which follows the operating system). The resolved theme is written to
 * <html data-theme="light|dark">; globals.css switches every semantic colour token on that attribute.
 */
export const THEME_STORAGE_KEY = "fz-theme";
export const THEME_CHANGE_EVENT = "fz-theme-change";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/**
 * Runs synchronously in <head> before first paint: resolves the saved preference (or the OS setting while
 * it is "system") onto <html data-theme>, and keeps following OS changes while the preference is "system".
 * Plain ES5 on purpose; any failure (blocked storage) silently falls back to the OS setting.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,k=${JSON.stringify(THEME_STORAGE_KEY)},m;try{m=window.matchMedia("(prefers-color-scheme: dark)")}catch(e){}function p(){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v==="light"||v==="dark"?v:"system"}function a(){var v=p();d.setAttribute("data-theme",v==="system"?(m&&m.matches?"dark":"light"):v)}a();try{m&&m.addEventListener("change",function(){if(p()==="system")a()})}catch(e){}})();`;
