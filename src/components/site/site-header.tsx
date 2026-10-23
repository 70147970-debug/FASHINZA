"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "./logo";
import { PUBLIC_NAV } from "./nav-links";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-slate-blue hover:bg-navy-50 hover:text-navy",
                pathname === item.href && "text-navy bg-navy-50",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="accent">
            <Link href="/register?role=brand">Start a Project</Link>
          </Button>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent title="Menu">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {[...PUBLIC_NAV, { href: "/about", label: "About" }, { href: "/contact", label: "Contact" }].map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link href={item.href} className="rounded-md px-3 py-2.5 text-sm font-medium text-navy hover:bg-navy-50">
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
              <SheetClose asChild>
                <Button asChild variant="outline">
                  <Link href="/login">Login</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button asChild variant="accent">
                  <Link href="/register?role=brand">Start a Project</Link>
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
