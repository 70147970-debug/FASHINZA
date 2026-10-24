import { db } from "@/lib/db";
import type { Actor } from "@/server/actor";

export async function unreadCount(actor: Actor) {
  return db.notification.count({ where: { userId: actor.id, readAt: null } });
}

export async function listNotifications(actor: Actor, f: { unread?: boolean; page?: number; pageSize?: number } = {}) {
  const pageSize = Math.min(f.pageSize ?? 20, 50);
  const page = Math.max(1, f.page ?? 1);
  const where = { userId: actor.id, ...(f.unread ? { readAt: null } : {}) };
  const [items, total] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.notification.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Only ever touches the caller's own notifications. */
export async function markRead(actor: Actor, ids: string[] | "all") {
  await db.notification.updateMany({
    where: { userId: actor.id, readAt: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
}
