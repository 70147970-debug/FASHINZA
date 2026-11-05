/**
 * Notifications, activity log and audit log (port of src/server/events.ts). Pass the transaction's
 * `session` so the record is written atomically with the change it reports; `session` may be undefined
 * outside a transaction.
 */
import { ActivityLog } from "../models/ActivityLog.js";
import { AuditLog } from "../models/AuditLog.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { idOf } from "./ids.js";

/**
 * Persistent in-app notification for one or more users (duplicates removed).
 * @param {import("mongoose").ClientSession | undefined | null} session
 * @param {string | string[]} userIdOrIds
 * @param {string} type NotificationType
 * @param {string} title
 * @param {string} message
 * @param {string} [link]
 */
export async function notify(session, userIdOrIds, type, title, message, link) {
  const ids = [...new Set((Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds]).map(idOf).filter(Boolean))];
  if (!ids.length) return [];
  return Notification.insertMany(
    ids.map((userId) => ({ userId, type, title, message, link: link ?? null })),
    { session: session ?? undefined },
  );
}

/** Notifies every ACTIVE administrator. */
export async function notifyAdmins(session, type, title, message, link) {
  const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }, { _id: 1 })
    .session(session ?? null)
    .lean();
  if (admins.length) await notify(session, admins.map((a) => a._id.toHexString()), type, title, message, link);
}

/**
 * Append-only project/order history shown on timelines.
 * @param {import("mongoose").ClientSession | undefined | null} session
 * @param {{ actorId: string | null, type: string, message: string, projectId?: string, orderId?: string, metadata?: unknown }} entry
 */
export async function logActivity(session, entry) {
  const [doc] = await ActivityLog.create(
    [
      {
        actorId: entry.actorId ?? null,
        type: entry.type,
        message: entry.message,
        projectId: entry.projectId ?? null,
        orderId: entry.orderId ?? null,
        metadata: entry.metadata ?? null,
      },
    ],
    { session: session ?? undefined },
  );
  return doc;
}

/**
 * Append-only record of administrative and other sensitive actions.
 * @param {import("mongoose").ClientSession | undefined | null} session
 * @param {{ actorId: string, action: string, targetType: string, targetId: string, reason?: string | null, metadata?: unknown }} entry
 */
export async function audit(session, entry) {
  const [doc] = await AuditLog.create(
    [
      {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: idOf(entry.targetId),
        reason: entry.reason ?? null,
        metadata: entry.metadata ?? null,
      },
    ],
    { session: session ?? undefined },
  );
  return doc;
}
