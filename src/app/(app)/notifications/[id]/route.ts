import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth/session";

/**
 * Opening a notification: marks it read (only if it belongs to the caller) and redirects to the
 * linked page. Only same-site relative links are followed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  const base = new URL(req.url);
  if (!actor) return NextResponse.redirect(new URL("/login", base));
  const { id } = await params;
  const n = await db.notification.findFirst({ where: { id, userId: actor.id } });
  if (!n) return NextResponse.redirect(new URL("/notifications", base));
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  const target = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications";
  return NextResponse.redirect(new URL(target, base));
}
