import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

/** Persistent in-app notification. Written in the same transaction as the change it reports. */
export function notify(tx: Tx, userId: string | string[], type: NotificationType, title: string, message: string, link?: string) {
  const ids = [...new Set(Array.isArray(userId) ? userId : [userId])];
  return tx.notification.createMany({ data: ids.map((id) => ({ userId: id, type, title, message, link })) });
}

export async function notifyAdmins(tx: Tx, type: NotificationType, title: string, message: string, link?: string) {
  const admins = await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  if (admins.length) await notify(tx, admins.map((a) => a.id), type, title, message, link);
}

/** Append-only project/order history shown on timelines. */
export function logActivity(
  tx: Tx,
  entry: { actorId: string | null; type: string; message: string; projectId?: string; orderId?: string; metadata?: Prisma.InputJsonValue },
) {
  return tx.activityLog.create({ data: entry });
}

/** Append-only record of administrative and other sensitive actions. */
export function audit(
  tx: Tx,
  entry: { actorId: string; action: string; targetType: string; targetId: string; reason?: string | null; metadata?: Prisma.InputJsonValue },
) {
  return tx.auditLog.create({ data: { ...entry, reason: entry.reason ?? undefined } });
}
