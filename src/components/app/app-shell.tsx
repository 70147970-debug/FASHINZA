"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/labels";
import { NAV, homeFor } from "./nav";

type ShellUser = { name: string; email: string; role: Role; org: string | null };

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Serif wordmark with a small terracotta full stop. */
function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-baseline rounded-sm" aria-label="Fashinza home">
      <span className="font-display text-[1.375rem] font-medium leading-none tracking-[-0.025em] text-ink" aria-hidden>
        Fashinza
      </span>
      <span className="ml-0.5 size-[5px] translate-y-[-1px] rounded-full bg-accent" aria-hidden />
    </Link>
  );
}

function NavLinks({ role, unread, onNavigate }: { role: Role; unread: number; onNavigate?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Application" className="flex flex-col gap-5">
      {NAV[role].map((group, gi) => (
        <div key={gi}>
          {group.label && <p className="label-caps mb-1.5 px-3 text-ink-muted">{group.label}</p>}
          <ul className="space-y-px">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const count = item.href === "/notifications" && unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150 max-lg:h-10",
                    active
                      ? "bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-line)] before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-xs before:bg-accent"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  <item.icon
                    className={cn("size-4 shrink-0", active ? "text-accent" : "text-ink-subtle group-hover:text-ink")}
                    strokeWidth={active ? 2 : 1.75}
                    aria-hidden
                  />
                  <span className="truncate">{item.label}</span>
                  {count && (
                    <span
                      className={cn(
                        "tabular ml-auto rounded-sm px-1.5 text-2xs font-semibold leading-[1.125rem]",
                        active ? "bg-accent-soft text-accent-strong" : "bg-surface-muted text-ink-muted",
                      )}
                      aria-hidden
                    >
                      {count}
                    </span>
                  )}
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

function SidebarBody({ user, unread, onSignOut, mobile }: { user: ShellUser; unread: number; onSignOut: () => void; mobile?: boolean }) {
  const org = user.org ?? ROLE_LABEL[user.role];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Brand href={homeFor(user.role)} />
      </div>

      <div className="mx-6 mb-5 border-y border-line py-3">
        <p className="eyebrow text-ink-muted">{ROLE_LABEL[user.role]} workspace</p>
        <p className="mt-1 truncate font-display text-[15px] font-medium leading-5 text-ink">{org}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks role={user.role} unread={unread} onNavigate={mobile} />
      </div>

      <div className="mx-3 flex shrink-0 items-center gap-2.5 border-t border-line px-3 py-3">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-5 text-ink">{user.name}</p>
          <p className="truncate text-xs leading-4 text-ink-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="grid size-8 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink max-lg:size-10"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

const menuItem =
  "flex w-full cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-ink outline-none transition-colors data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink max-sm:min-h-10 [&_svg]:size-4 [&_svg]:text-ink-muted";

export function AppShell({ user, unread, signOut, children }: { user: ShellUser; unread: number; signOut: () => Promise<void>; children: React.ReactNode }) {
  const signOutForm = useRef<HTMLFormElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const requestSignOut = () => signOutForm.current?.requestSubmit();

  // "/" focuses the global search unless the user is typing somewhere already.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      searchInput.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh lg:pl-sidebar">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r border-line bg-canvas lg:block">
        <SidebarBody user={user} unread={unread} onSignOut={requestSignOut} />
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-md text-ink transition-colors hover:bg-surface-hover lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent title="Navigation" side="left" hideTitle className="w-[17.5rem] max-w-[85vw] bg-canvas p-0">
              <SidebarBody user={user} unread={unread} onSignOut={requestSignOut} mobile />
            </SheetContent>
          </Sheet>
          <Link href={homeFor(user.role)} className="hidden shrink-0 items-baseline rounded-sm pr-2 sm:inline-flex lg:hidden" aria-label="Fashinza home">
            <span className="font-display text-xl font-medium leading-none tracking-[-0.025em] text-ink" aria-hidden>Fashinza</span>
            <span className="ml-0.5 size-[5px] rounded-full bg-accent" aria-hidden />
          </Link>

          <form action="/search" role="search" className="flex min-w-0 flex-1 items-center sm:max-w-md">
            <label htmlFor="global-search" className="sr-only">Search projects and orders</label>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} aria-hidden />
              <input
                ref={searchInput}
                id="global-search"
                name="q"
                type="search"
                placeholder="Search"
                className="h-9 w-full min-w-0 rounded-md border border-line-control bg-surface pl-9 pr-3 text-sm text-ink transition-colors duration-150 placeholder:text-ink-placeholder hover:border-ink-muted focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/20 max-sm:h-10 lg:pr-9"
              />
              <kbd
                className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 place-items-center rounded-sm border border-line bg-surface-muted px-1.5 font-sans text-2xs font-medium text-ink-muted lg:grid"
                aria-hidden
              >
                /
              </kbd>
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <ThemeToggle />
            <Link
              href="/notifications"
              className="relative grid size-9 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink max-sm:size-10"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
              {unread > 0 && (
                <span
                  className="tabular absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-fg ring-2 ring-canvas"
                  aria-hidden
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover max-sm:p-1.5 sm:pr-2"
                  aria-label="Account menu"
                >
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden max-w-40 truncate text-sm font-medium text-ink md:block">{user.name}</span>
                  <ChevronDown className="hidden size-4 text-ink-muted sm:block" aria-hidden />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-lg border border-line bg-surface-raised p-1.5 text-ink shadow-pop">
                  <div className="flex items-center gap-2.5 px-2.5 py-2">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-muted">{user.email}</p>
                    </div>
                  </div>
                  <div className="px-2.5 pb-2">
                    <Badge tone="neutral">{ROLE_LABEL[user.role]} workspace</Badge>
                  </div>
                  <DropdownMenu.Separator className="-mx-1.5 my-1 h-px bg-line" />
                  <DropdownMenu.Item asChild>
                    <Link href="/settings" className={menuItem}>
                      <Settings aria-hidden /> Settings
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={requestSignOut} className={menuItem}>
                    <LogOut aria-hidden /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <form ref={signOutForm} action={signOut} className="hidden" aria-hidden />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full min-w-0 max-w-app px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        {children}
      </main>
    </div>
  );
}
