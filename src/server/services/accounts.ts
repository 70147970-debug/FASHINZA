import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { RegisterInput } from "@/lib/validation/auth";
import { burnPasswordCheck, hashPassword, newToken, sha256, verifyPassword } from "@/server/auth/password";
import { AppError, conflict, invalid } from "@/server/errors";
import { audit, notify } from "@/server/events";
import type { Actor } from "@/server/actor";
import { assertRole } from "@/server/access";

const RESET_TTL_MS = 60 * 60 * 1000;

/** Creates the user, its password credential and an empty organisation profile in one transaction. */
export async function registerAccount(input: RegisterInput) {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new AppError("An account with this email already exists.", "CONFLICT", { email: "An account with this email already exists. Sign in instead." });
  const passwordHash = await hashPassword(input.password);
  const id = randomUUID();
  try {
    await db.$transaction(async (tx) => {
      await tx.user.create({ data: { id, name: input.name, email: input.email, role: input.role } });
      await tx.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: passwordHash } });
      if (input.role === "BRAND") {
        await tx.brandProfile.create({ data: { userId: id, companyName: input.organization, country: "" } });
      } else {
        await tx.manufacturerProfile.create({
          data: {
            userId: id,
            businessName: input.organization,
            description: "",
            country: "",
            city: "",
            minOrderQuantity: 0,
            maxMonthlyCapacity: 0,
            contactName: input.name,
            contactEmail: input.email,
          },
        });
      }
      await notify(tx, id, "SYSTEM", "Welcome to Fashinza", input.role === "BRAND" ? "Complete your company profile to create your first production project." : "Complete your factory profile and upload documents to request verification.", "/onboarding");
    });
  } catch (e) {
    // Unique violation from a concurrent registration with the same email.
    if ((e as { code?: string }).code === "P2002") throw new AppError("An account with this email already exists.", "CONFLICT", { email: "An account with this email already exists." });
    throw e;
  }
  return id;
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, statusReason: true, accounts: { where: { providerId: "credential" }, select: { password: true } } },
  });
  const hash = user?.accounts[0]?.password;
  if (!user || !hash) {
    await burnPasswordCheck(password);
    throw invalid("The email or password is incorrect.");
  }
  if (!(await verifyPassword(password, hash))) throw invalid("The email or password is incorrect.");
  if (user.status !== "ACTIVE") throw new AppError("This account has been suspended. Contact the Fashinza team for help.", "FORBIDDEN");
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user.id;
}

/** Returns the raw reset token (to be sent by email) or null for unknown emails. */
export async function createPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true } });
  if (!user || user.status !== "ACTIVE") return null;
  const token = newToken();
  const identifier = `password-reset:${user.id}`;
  await db.$transaction([
    db.verification.deleteMany({ where: { identifier } }),
    db.verification.create({ data: { id: randomUUID(), identifier, value: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
  ]);
  return token;
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await db.verification.findFirst({ where: { value: sha256(token), identifier: { startsWith: "password-reset:" } } });
  if (!record || record.expiresAt < new Date()) throw invalid("This reset link is invalid or has expired. Request a new one.");
  const userId = record.identifier.slice("password-reset:".length);
  const hash = await hashPassword(newPassword);
  await db.$transaction([
    db.account.updateMany({ where: { userId, providerId: "credential" }, data: { password: hash } }),
    db.verification.deleteMany({ where: { identifier: record.identifier } }),
    // Signing out everywhere protects an account whose password was compromised.
    db.session.deleteMany({ where: { userId } }),
  ]);
  return userId;
}

export async function changePassword(actor: Actor, currentPassword: string, newPassword: string) {
  const account = await db.account.findFirst({ where: { userId: actor.id, providerId: "credential" } });
  if (!account?.password || !(await verifyPassword(currentPassword, account.password))) {
    throw new AppError("Your current password is incorrect.", "INVALID", { currentPassword: "Your current password is incorrect." });
  }
  await db.account.update({ where: { id: account.id }, data: { password: await hashPassword(newPassword) } });
}

/** Admin: suspend or reactivate an account. Suspension signs the user out immediately. */
export async function setUserStatus(actor: Actor, userId: string, status: "ACTIVE" | "SUSPENDED", reason: string) {
  assertRole(actor, "ADMIN");
  if (userId === actor.id) throw conflict("You cannot change the status of your own account.");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
    if (!user) throw invalid("User not found.");
    if (user.status === status) throw conflict(`The account is already ${status.toLowerCase()}.`);
    await tx.user.update({ where: { id: userId }, data: { status, statusReason: status === "SUSPENDED" ? reason : null } });
    if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId } });
    await audit(tx, { actorId: actor.id, action: status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED", targetType: "User", targetId: userId, reason });
    await notify(tx, userId, "ACCOUNT_STATUS", status === "SUSPENDED" ? "Account suspended" : "Account reactivated", reason);
  });
}
