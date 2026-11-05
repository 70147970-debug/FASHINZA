import { Link } from "react-router";
import { Bell } from "lucide-react";
import { NotificationTypeIcon } from "@/components/app/notification-type";
import { formatDate } from "@fashinza/shared/format.js";
import { cn } from "@fashinza/shared/utils.js";

/** Dashboard side card list: one tight row per notification (title, one-line message, date). */
export function RecentNotifications({ items }) {
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
            <span className="flex w-2 shrink-0 justify-center pt-[7px]">{!n.readAt && <span className="size-2 rounded-full bg-accent" aria-hidden />}</span>
            <NotificationTypeIcon type={n.type} className="mt-0.5 size-4 shrink-0 text-ink-subtle" />
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
              <Link to={`/notifications/${n.id}`} className={cn(row, "transition-colors duration-150 hover:bg-surface-hover")}>
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
