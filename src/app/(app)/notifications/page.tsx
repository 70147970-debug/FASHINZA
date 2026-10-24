import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { BellOff } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listNotifications, markRead } from "@/server/services/notifications";
import { EmptyState, PageHeader, Pagination, Panel } from "@/components/app/primitives";
import { NotificationList } from "@/components/app/notification-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "Notifications" };

async function markAllRead() {
  "use server";
  const actor = await requireUser();
  await markRead(actor, "all");
  revalidatePath("/", "layout");
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string; page?: string }> }) {
  const actor = await requireUser();
  const sp = await searchParams;
  const unread = sp.unread === "1";
  const data = await listNotifications(actor, { unread, page: Number(sp.page) || 1 });
  const hasUnread = data.items.some((n) => !n.readAt);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description="Updates on your projects, quotations, orders, payments and disputes. Email delivery is not configured in this build."
        actions={
          hasUnread && (
            <form action={markAllRead}>
              <Button type="submit" variant="outline">Mark all as read</Button>
            </form>
          )
        }
      />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Filter notifications">
        <Button asChild variant={unread ? "ghost" : "outline"} size="sm"><Link href="/notifications" role="tab" aria-selected={!unread}>All</Link></Button>
        <Button asChild variant={unread ? "outline" : "ghost"} size="sm"><Link href="/notifications?unread=1" role="tab" aria-selected={unread}>Unread</Link></Button>
      </div>
      {data.items.length === 0 ? (
        <EmptyState icon={BellOff} title={unread ? "You are all caught up" : "No notifications yet"} description="New matches, quotations, production updates and payment changes will appear here." />
      ) : (
        <>
          <Panel><NotificationList items={data.items} /></Panel>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/notifications" params={{ unread: unread ? "1" : undefined }} />
        </>
      )}
    </div>
  );
}
