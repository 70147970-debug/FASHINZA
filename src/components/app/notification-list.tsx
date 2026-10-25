import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notification } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationList({ items, compact = false }: { items: Notification[]; compact?: boolean }) {
  if (!items.length) {
    return (
      <p className="flex items-center gap-2 py-2 text-sm text-muted">
        <Bell className="size-4 text-subtle" aria-hidden /> No notifications yet.
      </p>
    );
  }
  return (
    <ul className="-my-1 divide-y divide-line-subtle">
      {items.map((n) => {
        const body = (
          <span className="flex gap-3">
            <span className="flex w-2 shrink-0 justify-center pt-[7px]">
              {!n.readAt && <span className="size-2 rounded-full bg-teal" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block break-words text-sm leading-5", n.readAt ? "text-ink" : "font-semibold text-navy")}>
                {!n.readAt && <span className="sr-only">Unread: </span>}
                {n.title}
              </span>
              <span className={cn("mt-0.5 block break-words text-[13px] leading-5 text-muted", compact && "line-clamp-2")}>{n.message}</span>
              <span className="mt-1 block text-xs leading-4 text-muted">{formatDateTime(n.createdAt)}</span>
            </span>
          </span>
        );
        return (
          <li key={n.id} className="py-1">
            {n.link ? (
              <Link
                href={`/notifications/${n.id}`}
                prefetch={false}
                className="-mx-2 block rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-surface-muted focus-visible:bg-surface-muted"
              >
                {body}
              </Link>
            ) : (
              <div className="py-2.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
