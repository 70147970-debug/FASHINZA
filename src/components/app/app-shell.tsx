"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Logo } from "@/components/site/logo";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { NAV, homeFor } from "./nav";

type ShellUser = { name: string; email: string; role: Role; org: string | null };

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Application" className="flex flex-col gap-5">
      {NAV[role].map((group, gi) => (
        <div key={gi}>
          {group.label && <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-wider text-white/45">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
              return <li key={item.href}>{onNavigate ? <SheetClose asChild>{link}</SheetClose> : link}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ user, mobile }: { user: ShellUser; mobile?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-6">
        <Logo inverted />
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        <NavLinks role={user.role} onNavigate={mobile} />
      </div>
      <div className="mt-4 border-t border-white/10 px-3 pt-4 text-xs text-white/55">
        <p className="truncate font-medium text-white/80">{user.org ?? ROLE_LABEL[user.role]}</p>
        <p>{ROLE_LABEL[user.role]} workspace</p>
      </div>
    </div>
  );
}

export function AppShell({ user, unread, signOut, children }: { user: ShellUser; unread: number; signOut: () => Promise<void>; children: React.ReactNode }) {
  const signOutForm = useRef<HTMLFormElement>(null);
  return (
    <div className="min-h-dvh lg:pl-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-navy py-5 lg:block">
        <SidebarBody user={user} />
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent title="Navigation" side="left" hideTitle className="bg-navy p-4 text-white [&>div>button]:text-white [&>div>button:hover]:bg-white/10">
              <SidebarBody user={user} mobile />
            </SheetContent>
          </Sheet>
          <Link href={homeFor(user.role)} className="lg:hidden" aria-label="Fashinza home">
            <span className="grid size-8 place-items-center rounded-md bg-navy text-sm font-bold text-white">F</span>
          </Link>

          <form action="/search" role="search" className="ml-1 flex min-w-0 flex-1 items-center sm:ml-0 sm:max-w-md">
            <label htmlFor="global-search" className="sr-only">Search projects and orders</label>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="global-search"
                name="q"
                type="search"
                placeholder="Search projects and orders"
                className="h-9 w-full rounded-md border border-line bg-canvas pl-9 pr-3 text-sm placeholder:text-muted focus:border-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="relative" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
              <Link href="/notifications">
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="tabular absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-2xs font-semibold leading-4 text-white" aria-hidden>
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 rounded-md p-1 pr-1.5 hover:bg-navy-50 sm:pr-2" aria-label="Account menu">
                  <span className="grid size-8 place-items-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">{initials(user.name)}</span>
                  <span className="hidden max-w-36 truncate text-sm font-medium text-navy sm:block">{user.name}</span>
                  <ChevronDown className="hidden size-4 text-muted sm:block" aria-hidden />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-60 rounded-md border border-line bg-white p-1 shadow-pop">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-navy">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item asChild>
                    <Link href="/settings" className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-navy-50">
                      <Settings className="size-4" aria-hidden /> Settings
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => signOutForm.current?.requestSubmit()}
                    className="flex w-full cursor-default items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-ink outline-none data-[highlighted]:bg-navy-50"
                  >
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <form ref={signOutForm} action={signOut} className="hidden" aria-hidden />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
