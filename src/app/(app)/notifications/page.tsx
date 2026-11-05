import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { BellOff, CheckCheck, ChevronRight } from "lucide-react";
import type { Notification } from "@/generated/prisma/client";
import { requireUser } from "@/server/auth/session";
import { listNotifications, markRead, unreadCount } from "@/server/services/notifications";
import { EmptyState, PageHeader, Pagination } from "@/components/app/primitives";
import { NotificationTypeIcon, asksForDecision } from "@/components/app/notification-type";
import { StatusTabs } from "@/components/orders/order-parts";
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

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Updates on your projects, quotations, orders, payments and disputes. Rows with an arrow open the related page. Email notifications are not switched on yet."
        actions={
          hasUnread && (
            <form action={markAllRead}>
              <Button type="submit" variant="outline" className="max-sm:w-full"><CheckCheck aria-hidden /> Mark all as read</Button>
            </form>
          )
        }
      />

      <StatusTabs
        basePath="/notifications"
        param="unread"
        label="Filter notifications"
        value={unread ? "1" : undefined}
        options={[{ value: "1", label: "Unread", count: unreadTotal || undefined, countLabel: "unread" }]}
      />

      {data.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unread ? "You are all caught up" : "No notifications yet"}
          description="New matches, quotations, production updates and payment changes will appear here."
          action={unread && <Button asChild variant="outline"><Link href="/notifications">Show all notifications</Link></Button>}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            {groupByDay(data.items).map((g, gi) => (
              <section key={g.key} aria-labelledby={`day-${g.key}`}>
                <h2
                  id={`day-${g.key}`}
                  className={cn("label-caps bg-surface-muted px-4 py-2 text-ink-muted sm:px-5", gi > 0 && "border-t border-line")}
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
  // Decision-type rows (a sample, a QC report, a quotation to review) keep an accent icon while unread.
  const decide = !n.readAt && asksForDecision(n.type);
  const body = (
    <>
      <span className="flex w-2 shrink-0 justify-center pt-[7px]">
        {!n.readAt && <span className="size-2 rounded-full bg-accent" aria-hidden />}
      </span>
      <NotificationTypeIcon type={n.type} className={cn("mt-0.5 size-4 shrink-0", decide ? "text-accent" : "text-ink-subtle")} />
      <span className="min-w-0 flex-1">
        <span className={cn("block break-words text-sm leading-5", n.readAt ? "text-ink" : "font-semibold text-ink")}>
          {!n.readAt && <span className="sr-only">Unread: </span>}
          {n.title}
        </span>
        <span className="mt-0.5 block break-words text-[13px] leading-5 text-ink-muted">{n.message}</span>
      </span>
      <time dateTime={new Date(n.createdAt).toISOString()} className="tabular shrink-0 pt-px text-xs leading-5 text-ink-muted">
        {timeFmt.format(new Date(n.createdAt))}
        <span className="sr-only"> UTC</span>
      </time>
      {n.link && <ChevronRight className="size-4 shrink-0 self-center text-ink-subtle transition-colors duration-150 group-hover:text-ink-muted" aria-hidden />}
    </>
  );
  const row = "flex gap-3 px-4 py-3.5 sm:px-5";
  return n.link ? (
    <Link href={`/notifications/${n.id}`} prefetch={false} className={cn(row, "group transition-colors duration-150 hover:bg-surface-hover")}>
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  );
}
