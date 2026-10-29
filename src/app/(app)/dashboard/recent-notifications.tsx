import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notification } from "@/generated/prisma/client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Dashboard side card list: one tight row per notification (title, one-line message, date). */
export function RecentNotifications({ items }: { items: Notification[] }) {
  if (!items.length) {
    return (
      <p className="flex items-center gap-2 px-4 py-4 text-sm text-ink-muted sm:px-5">
        <Bell className="size-4 text-ink-subtle" aria-hidden /> No notifications yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line-subtle">
      {items.map((n) => {
        const body = (
          <>
            <span className="flex w-2 shrink-0 justify-center pt-[7px]">
              {!n.readAt && <span className="size-2 rounded-full bg-accent" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className={cn("min-w-0 truncate text-sm leading-5", n.readAt ? "text-ink" : "font-medium text-ink")}>
                  {!n.readAt && <span className="sr-only">Unread: </span>}
                  {n.title}
                </span>
                <span className="tabular shrink-0 text-xs text-ink-muted">{formatDate(n.createdAt)}</span>
              </span>
              <span className="mt-0.5 block truncate text-[13px] leading-5 text-ink-muted">{n.message}</span>
            </span>
          </>
        );
        const row = "flex gap-3 px-4 py-3 sm:px-5";
        return (
          <li key={n.id}>
            {n.link ? (
              <Link href={`/notifications/${n.id}`} prefetch={false} className={cn(row, "transition-colors duration-150 hover:bg-surface-hover")}>
                {body}
              </Link>
            ) : (
              <div className={row}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
