import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notification } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationList({ items, compact = false }: { items: Notification[]; compact?: boolean }) {
  if (!items.length) {
    return <p className="flex items-center gap-2 py-2 text-sm text-muted"><Bell className="size-4" aria-hidden /> No notifications yet.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const body = (
          <>
            <span className="flex items-start gap-2">
              {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal" aria-label="Unread" />}
              <span className={cn("text-sm", n.readAt ? "text-ink" : "font-semibold text-navy")}>{n.title}</span>
            </span>
            <span className={cn("mt-0.5 block text-sm text-muted", compact && "line-clamp-2")}>{n.message}</span>
            <span className="mt-1 block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
          </>
        );
        return (
          <li key={n.id} className="py-3 first:pt-0 last:pb-0">
            {n.link ? <Link href={`/notifications/${n.id}`} prefetch={false} className="block rounded-md hover:bg-canvas focus-visible:bg-canvas">{body}</Link> : <div>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
