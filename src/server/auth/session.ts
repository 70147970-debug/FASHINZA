import "server-only";
import { cache } from "react";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import type { Actor } from "@/server/actor";
import { newToken, sha256 } from "./password";

export type { Actor };

export const SESSION_COOKIE = "fz_session";
const SESSION_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.session.create({
    data: { id: randomUUID(), userId, token: sha256(token), expiresAt, ipAddress: meta.ip, userAgent: meta.userAgent?.slice(0, 300) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { token: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in, active user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token: sha256(token) },
    select: { expiresAt: true, user: { select: { id: true, role: true, name: true, email: true, status: true, profileCompleted: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const { id, role, name, email, profileCompleted } = session.user;
  return { id, role, name, email, profileCompleted };
});

/**
 * Server-side gate for pages and actions. Redirects to login when signed out and to the
 * user's dashboard when the role is not allowed. Never rely on hidden UI alone.
 */
export async function requireUser(roles?: Role[]): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

/** Like requireUser but also requires a completed organisation profile (non-admins). */
export async function requireOnboardedUser(roles?: Role[]): Promise<Actor> {
  const user = await requireUser(roles);
  if (!user.profileCompleted && user.role !== "ADMIN") redirect("/onboarding");
  return user;
}

export async function revokeAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
