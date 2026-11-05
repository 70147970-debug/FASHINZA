import { Outlet, ScrollRestoration } from "react-router";
import { Toaster } from "@/components/ui/toaster";
import { ThemeSync } from "@/components/theme/theme-sync";

/**
 * Root layout (src/app/layout.tsx): ThemeSync keeps <html data-theme> in sync (the no-flash script in
 * index.html sets it before first paint), the page, and the toaster. ScrollRestoration reproduces Next's
 * scroll-to-top on navigation (links with `preventScrollReset` keep the position, like `scroll={false}`).
 */
export default function RootLayout() {
  return (
    <>
      <ThemeSync />
      <Outlet />
      <Toaster />
      <ScrollRestoration />
    </>
  );
}
