/**
 * In-app notifications (port of src/server/services/notifications.ts and the opening logic of
 * src/app/(app)/notifications/[id]/route.ts). Only ever touches the caller's own notifications.
 */
import { toObjectId } from "../lib/ids.js";
import { serialize } from "../lib/serialize.js";
import { Notification } from "../models/index.js";

const own = (actor) => ({ userId: toObjectId(actor.id) });

export async function unreadCount(actor) {
  return Notification.countDocuments({ ...own(actor), readAt: null });
}

/** @param {{ unread?: boolean, page?: number, pageSize?: number }} [f] */
export async function listNotifications(actor, f = {}) {
  const pageSize = Math.min(f.pageSize ?? 20, 50);
  const page = Math.max(1, f.page ?? 1);
  const where = { ...own(actor), ...(f.unread ? { readAt: null } : {}) };
  const [items, total] = await Promise.all([
    Notification.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments(where),
  ]);
  return { items: serialize(Notification, items), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Marks the caller's unread notifications read (`ids` = list of ids or "all").
 * @param {string[] | "all"} ids
 */
export async function markRead(actor, ids) {
  const filter = { ...own(actor), readAt: null };
  if (ids !== "all") filter._id = { $in: ids.map(toObjectId).filter(Boolean) };
  await Notification.updateMany(filter, { $set: { readAt: new Date() } });
}

/**
 * Opening a notification: marks it read (only if it belongs to the caller) and returns where to go.
 * Only same-site relative links are followed; unknown or foreign ids go to the notifications page.
 * @returns {Promise<string>}
 */
export async function openNotification(actor, id) {
  const oid = toObjectId(id);
  const n = oid ? await Notification.findOne({ _id: oid, ...own(actor) }).lean() : null;
  if (!n) return "/notifications";
  if (!n.readAt) await Notification.updateOne({ _id: oid }, { $set: { readAt: new Date() } });
  return n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications";
}
