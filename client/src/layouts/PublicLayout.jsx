import { Outlet } from "react-router";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { homeFor } from "@/components/app/nav";
import { useSessionUser } from "@/lib/session";

/** Public website layout (src/app/(public)/layout.tsx). */
export default function PublicLayout() {
  // Signed-in visitors get a link back to their workspace instead of Login / Register.
  const user = useSessionUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-line focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-ink focus:shadow-pop"
      >
        Skip to content
      </a>
      <SiteHeader home={user ? homeFor(user.role) : null} />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
