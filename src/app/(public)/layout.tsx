import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/components/app/nav";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Signed-in visitors get a link back to their workspace instead of Login / Register.
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-line focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-ink focus:shadow-pop">
        Skip to content
      </a>
      <SiteHeader home={user ? homeFor(user.role) : null} />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
