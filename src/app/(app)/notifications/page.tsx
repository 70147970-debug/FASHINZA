import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BellOff, CheckCheck } from "lucide-react";
import type { Notification } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth/session";
import { listNotifications, markRead, unreadCount } from "@/server/services/notifications";
import { EmptyState, PageHeader, Pagination } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

async function markAllRead() {
  "use server";
  const actor = await requireUser();
  await markRead(actor, "all");
  revalidatePath("/", "layout");
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** "Today", "Yesterday" or the date (UTC, like every date in the app). */
function dayLabel(key: string, now = new Date()) {
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(now.getTime() - 86400000))) return "Yesterday";
  return formatDate(key);
}

function groupByDay(items: Notification[]) {
  const groups: { key: string; items: Notification[] }[] = [];
  for (const n of items) {
    const key = dayKey(new Date(n.createdAt));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(n);
    else groups.push({ key, items: [n] });
  }
  return groups;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string; page?: string }> }) {
  const actor = await requireUser();
  const sp = await searchParams;
  const unread = sp.unread === "1";
  const [data, unreadTotal] = await Promise.all([listNotifications(actor, { unread, page: Number(sp.page) || 1 }), unreadCount(actor)]);
  const hasUnread = data.items.some((n) => !n.readAt);
  const views = [
    { href: "/notifications", label: "All", active: !unread, count: undefined },
    { href: "/notifications?unread=1", label: "Unread", active: unread, count: unreadTotal },
  ];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Updates on your projects, quotations, orders, payments and disputes. Email delivery is not configured in this build."
        actions={
          hasUnread && (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" className="max-sm:w-full"><CheckCheck aria-hidden /> Mark all as read</Button>
            </form>
          )
        }
      />

      <nav aria-label="Filter notifications" className="-mx-4 mb-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-5">
          {views.map((v) => (
            <li key={v.label} className="shrink-0">
              <Link
                href={v.href}
                aria-current={v.active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center gap-2 border-b-2 text-sm transition-colors duration-150",
                  v.active ? "border-teal font-medium text-navy" : "border-transparent text-muted hover:border-line-strong hover:text-navy",
                )}
              >
                {v.label}
                {!!v.count && (
                  <span className="tabular rounded-full bg-teal-50 px-1.5 text-xs font-medium leading-5 text-teal-700">
                    {v.count}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {data.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unread ? "You are all caught up" : "No notifications yet"}
          description="New matches, quotations, production updates and payment changes will appear here."
          action={unread && <Button asChild variant="outline"><Link href="/notifications">Show all notifications</Link></Button>}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
            {groupByDay(data.items).map((g, gi) => (
              <section key={g.key} aria-labelledby={`day-${g.key}`}>
                <h2
                  id={`day-${g.key}`}
                  className={cn("label-caps bg-surface-muted px-4 py-2 text-muted sm:px-5", gi > 0 && "border-t border-line")}
                >
                  {dayLabel(g.key)}
                </h2>
                <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                  {g.items.map((n) => (
                    <li key={n.id}>
                      <NotificationRow n={n} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/notifications" params={{ unread: unread ? "1" : undefined }} />
        </>
      )}
    </div>
  );
}

function NotificationRow({ n }: { n: Notification }) {
  const body = (
    <>
      <span className="flex w-2 shrink-0 justify-center pt-[7px]">
        {!n.readAt && <span className="size-2 rounded-full bg-teal" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block break-words text-sm leading-5", n.readAt ? "text-ink" : "font-semibold text-navy")}>
          {!n.readAt && <span className="sr-only">Unread: </span>}
          {n.title}
        </span>
        <span className="mt-0.5 block break-words text-[13px] leading-5 text-muted">{n.message}</span>
      </span>
      <time dateTime={new Date(n.createdAt).toISOString()} className="tabular shrink-0 pt-px text-xs leading-5 text-muted">
        {timeFmt.format(new Date(n.createdAt))}
        <span className="sr-only"> UTC</span>
      </time>
    </>
  );
  const row = "flex gap-3 px-4 py-3.5 sm:px-5";
  return n.link ? (
    <Link href={`/notifications/${n.id}`} prefetch={false} className={cn(row, "transition-colors duration-150 hover:bg-surface-muted")}>
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  );
}
