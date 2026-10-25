"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "./logo";
import { PUBLIC_NAV, SECONDARY_NAV } from "./nav-links";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader({ home }: { home?: string | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-[border-color,box-shadow] duration-150 supports-[backdrop-filter]:bg-white/85",
        scrolled ? "border-line shadow-card" : "border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden h-full items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150",
                  active ? "text-navy" : "text-neutral-700 hover:bg-neutral-100 hover:text-navy",
                )}
              >
                {item.label}
                {active && <span aria-hidden className="absolute inset-x-3 -bottom-[15px] h-0.5 rounded-full bg-teal" />}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {home ? (
            <Button asChild variant="accent">
              <Link href={home}>Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild variant="accent">
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
          <SheetContent title="Menu">
            <nav aria-label="Mobile" className="flex flex-col">
              <p className="label-caps mb-1 px-3 text-muted">Platform</p>
              {PUBLIC_NAV.map((item) => (
                <MobileLink key={item.href} href={item.href} active={pathname === item.href}>{item.label}</MobileLink>
              ))}
              <p className="label-caps mb-1 mt-5 px-3 text-muted">Company</p>
              {SECONDARY_NAV.map((item) => (
                <MobileLink key={item.href} href={item.href} active={pathname === item.href}>{item.label}</MobileLink>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
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
          "relative flex h-11 items-center rounded-md px-3 text-[0.9375rem] font-medium transition-colors duration-150",
          active ? "bg-teal-50 text-teal-700" : "text-navy hover:bg-neutral-100",
        )}
      >
        {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-teal" />}
        {children}
      </Link>
    </SheetClose>
  );
}
