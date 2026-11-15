import { useEffect } from "react";
import { Outlet, ScrollRestoration } from "react-router";
import { Toaster } from "@/components/ui/toaster";
import { ThemeSync } from "@/components/theme/theme-sync";
import { NavigationProgress } from "@/components/site/navigation-progress";

/**
 * Smooth scrolling for same-page anchor links ("New here? See how it works", on-this-page navigation): the
 * html.fz-smooth-scroll class (globals.css) is set only while such a scroll runs, so route changes still jump
 * to the top instantly, and never under prefers-reduced-motion.
 */
function useSmoothAnchorScroll() {
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      root.classList.remove("fz-smooth-scroll");
    };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
      if (!link || link.getAttribute("href") === "#") return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      root.classList.add("fz-smooth-scroll");
      window.clearTimeout(timer);
      timer = window.setTimeout(done, 1200);
      window.addEventListener("scrollend", done, { once: true });
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scrollend", done);
      done();
    };
  }, []);
}

/**
 * Root layout (src/app/layout.tsx): ThemeSync keeps <html data-theme> in sync (the no-flash script in
 * index.html sets it before first paint), a navigation progress bar, the page, and the toaster. ScrollRestoration reproduces Next's
 * scroll-to-top on navigation (links with `preventScrollReset` keep the position, like `scroll={false}`).
 */
export default function RootLayout() {
  useSmoothAnchorScroll();
  return (
    <>
      <ThemeSync />
      <NavigationProgress />
      <Outlet />
      <Toaster />
      <ScrollRestoration />
    </>
  );
}
