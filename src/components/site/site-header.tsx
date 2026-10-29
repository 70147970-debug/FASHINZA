"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "./logo";
import { PUBLIC_NAV, SECONDARY_NAV } from "./nav-links";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Marketing header: ivory bar over a hairline, serif wordmark, quiet nav whose active item is ink with a
 * terracotta rule on the header line. Theme toggle sits beside the actions (and the phone menu button).
 */
export function SiteHeader({ home }: { home?: string | null }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden h-full items-stretch gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center px-3 text-sm transition-colors duration-150",
                  active ? "font-medium text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-3 -bottom-px h-0.5 transition-colors duration-150",
                    active ? "bg-accent" : "bg-transparent",
                  )}
                />
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1 lg:gap-2">
          <ThemeToggle />
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-line lg:block" />
          <div className="hidden items-center gap-2 lg:flex">
            {home ? (
              <Button asChild>
                <Link href={home}>Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/register?role=brand">Start a Project</Link>
                </Button>
              </>
            )}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent title="Menu" className="bg-canvas">
              <nav aria-label="Mobile" className="flex flex-col">
                <p className="label-caps border-b border-line pb-2 text-ink-muted">Platform</p>
                {PUBLIC_NAV.map((item) => (
                  <MobileLink key={item.href} href={item.href} active={pathname === item.href}>{item.label}</MobileLink>
                ))}
                <p className="label-caps mt-7 border-b border-line pb-2 text-ink-muted">Company</p>
                {SECONDARY_NAV.map((item) => (
                  <MobileLink key={item.href} href={item.href} active={pathname === item.href}>{item.label}</MobileLink>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 pt-8">
                {home ? (
                  <SheetClose asChild>
                    <Button asChild variant="accent" size="lg">
                      <Link href={home}>Go to dashboard</Link>
                    </Button>
                  </SheetClose>
                ) : (
                  <>
                    <SheetClose asChild>
                      <Button asChild variant="accent" size="lg">
                        <Link href="/register?role=brand">Start a Project <ArrowRight /></Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild variant="outline" size="lg">
                        <Link href="/login">Login</Link>
                      </Button>
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

function MobileLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
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
