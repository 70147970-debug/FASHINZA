import { Link, useLocation } from "react-router";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "./logo";
import { PUBLIC_NAV, SECONDARY_NAV } from "./nav-links";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@fashinza/shared/utils.js";

/**
 * Public header: ivory bar over a hairline, Playfair wordmark, quiet nav whose active item is ink with a
 * forest-green rule on the header line. The sign-up action follows the audience of the page (manufacturer
 * pages invite factories, everything else invites brands). On phones Login stays visible next to the menu.
 */
export function SiteHeader({ home }) {
  const { pathname } = useLocation();
  const factory = pathname.startsWith("/for-manufacturers");
  const cta = factory
    ? { href: "/register?role=manufacturer", label: "Join as a Manufacturer", short: "Join as a factory" }
    : { href: "/register?role=brand", label: "Start a Project", short: "Start a Project" };
  const other = factory
    ? { href: "/register?role=brand", label: "Sourcing for a brand? Start a project" }
    : { href: "/register?role=manufacturer", label: "Run a garment factory? Join as a manufacturer" };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="container-page flex h-16 items-center justify-between gap-3 lg:gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden h-full items-stretch gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex shrink-0 items-center whitespace-nowrap px-2.5 text-sm transition-colors duration-150 xl:px-3",
                  active ? "font-medium text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn("absolute inset-x-2.5 -bottom-px h-0.5 transition-colors duration-150 xl:inset-x-3", active ? "bg-accent" : "bg-transparent")}
                />
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-2">
          <ThemeToggle />
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-line lg:block" />
          <div className="hidden items-center gap-2 lg:flex">
            <Button asChild variant="ghost" className="hidden xl:inline-flex">
              <Link to="/contact" aria-current={pathname === "/contact" ? "page" : undefined}>
                Contact
              </Link>
            </Button>
            {home ? (
              <Button asChild>
                <Link to={home}>Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link to={cta.href}>
                    <span className="xl:hidden">{cta.short}</span>
                    <span className="hidden xl:inline">{cta.label}</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
          {/* Returning users reach their account in one tap on phones. */}
          <Button asChild variant="ghost" size="sm" className="shrink-0 px-2.5 lg:hidden">
            {home ? (
              <Link to={home}>
                <span className="max-[359px]:hidden">Dashboard</span>
                <span className="min-[360px]:hidden">Account</span>
              </Link>
            ) : (
              <Link to="/login">Login</Link>
            )}
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent title="Menu" className="bg-canvas">
              <nav aria-label="Mobile" className="flex flex-col">
                <p className="label-caps border-b border-line pb-2 text-ink-muted">Explore</p>
                {PUBLIC_NAV.map((item) => (
                  <MobileLink key={item.href} href={item.href} active={pathname === item.href}>
                    {item.label}
                  </MobileLink>
                ))}
                <p className="label-caps mt-7 border-b border-line pb-2 text-ink-muted">Company</p>
                {SECONDARY_NAV.map((item) => (
                  <MobileLink key={item.href} href={item.href} active={pathname === item.href}>
                    {item.label}
                  </MobileLink>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 pt-8">
                {home ? (
                  <SheetClose asChild>
                    <Button asChild variant="accent" size="lg">
                      <Link to={home}>Go to dashboard</Link>
                    </Button>
                  </SheetClose>
                ) : (
                  <>
                    <SheetClose asChild>
                      <Button asChild variant="accent" size="lg" className="h-auto min-h-11 whitespace-normal py-2.5 text-center">
                        <Link to={cta.href}>
                          {cta.label} <ArrowRight />
                        </Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild variant="outline" size="lg">
                        <Link to="/login">Login</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to={other.href}
                        className="inline-flex min-h-11 items-center justify-center rounded-md px-2 text-center text-sm leading-5 text-ink-muted underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline"
                      >
                        {other.label}
                      </Link>
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileLink({ href, active, children }) {
  return (
    <SheetClose asChild>
      <Link
        to={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex min-h-12 items-center justify-between gap-3 border-b border-line-subtle font-display text-[1.1875rem] tracking-[-0.01em] transition-colors duration-150",
          active ? "text-ink" : "text-ink-muted hover:text-ink",
        )}
      >
        <span className="flex items-center gap-2.5">
          {active && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
          {children}
        </span>
        <ArrowRight className="size-4 text-ink-subtle transition-colors duration-150 group-hover:text-accent" aria-hidden />
      </Link>
    </SheetClose>
  );
}
