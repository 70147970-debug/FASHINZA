/**
 * Accounts (port of src/server/services/accounts.ts): registration, sign-in, password reset and change.
 * Account suspension (setUserStatus) lives in services/admin.js (SERVER-B), per docs/mern/api.md §5.
 */
import mongoose from "mongoose";
import { isDuplicateKeyError, withTransaction } from "../db.js";
import { burnPasswordCheck, hashPassword, newToken, sha256, verifyPassword } from "../auth/password.js";
import { AppError, invalid } from "../lib/errors.js";
import { notify } from "../lib/events.js";
import { oid, opts } from "../lib/records.js";
import { Account } from "../models/Account.js";
import { BrandProfile } from "../models/BrandProfile.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { Notification } from "../models/Notification.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { Verification } from "../models/Verification.js";

const RESET_TTL_MS = 60 * 60 * 1000;
const RESET_PREFIX = "password-reset:";

/**
 * Creates the user, its password credential and an empty organisation profile in one transaction.
 * @param {{ role: "BRAND" | "MANUFACTURER", name: string, organization: string, email: string, password: string }} input
 * @returns {Promise<string>} the new user id
 */
export async function registerAccount(input) {
  const existing = await User.exists({ email: input.email });
  if (existing) throw new AppError("An account with this email already exists.", "CONFLICT", { email: "An account with this email already exists. Sign in instead." });
  const passwordHash = await hashPassword(input.password);
  const userId = new mongoose.Types.ObjectId();
  const id = userId.toHexString();
  try {
    await withTransaction(async (session) => {
      await User.create([{ _id: userId, name: input.name, email: input.email, role: input.role }], opts(session));
      await Account.create([{ accountId: id, providerId: "credential", userId, password: passwordHash }], opts(session));
      if (input.role === "BRAND") {
        await BrandProfile.create([{ userId, companyName: input.organization, country: "" }], opts(session));
      } else {
        await ManufacturerProfile.create(
          [
            {
              userId,
              businessName: input.organization,
              description: "",
              country: "",
              city: "",
              minOrderQuantity: 0,
              maxMonthlyCapacity: 0,
              contactName: input.name,
              contactEmail: input.email,
            },
          ],
          opts(session),
        );
      }
      await notify(
        session,
        id,
        "SYSTEM",
        "Welcome to Fashinza",
        input.role === "BRAND" ? "Complete your company profile to create your first production project." : "Complete your factory profile and upload documents to request verification.",
        "/onboarding",
      );
    });
  } catch (e) {
    // Unique violation from a concurrent registration with the same email.
    if (isDuplicateKeyError(e)) throw new AppError("An account with this email already exists.", "CONFLICT", { email: "An account with this email already exists." });
    throw e;
  }
  return id;
}

/** @returns {Promise<string>} the user id */
export async function authenticate(email, password) {
  const user = await User.findOne({ email }, { status: 1, statusReason: 1 }).lean();
  const account = user ? await Account.findOne({ userId: user._id, providerId: "credential" }, { password: 1 }).lean() : null;
  const hash = account?.password;
  if (!user || !hash) {
    await burnPasswordCheck(password);
    throw invalid("The email or password is incorrect.");
  }
  if (!(await verifyPassword(password, hash))) throw invalid("The email or password is incorrect.");
  if (user.status !== "ACTIVE") throw new AppError("This account has been suspended. Contact the Fashinza team for help.", "FORBIDDEN");
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  return user._id.toHexString();
}

/** Returns the raw reset token (to be sent by email) or null for unknown emails. */
export async function createPasswordReset(email) {
  const user = await User.findOne({ email }, { status: 1 }).lean();
  if (!user || user.status !== "ACTIVE") return null;
  const token = newToken();
  const identifier = `${RESET_PREFIX}${user._id.toHexString()}`;
  await withTransaction(async (session) => {
    await Verification.deleteMany({ identifier }, opts(session));
    await Verification.create([{ identifier, value: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) }], opts(session));
  });
  return token;
}

/** @returns {Promise<string>} the user id */
export async function resetPassword(token, newPassword) {
  const record = await Verification.findOne({ value: sha256(token), identifier: { $regex: `^${RESET_PREFIX}` } }).lean();
  if (!record || record.expiresAt < new Date()) throw invalid("This reset link is invalid or has expired. Request a new one.");
  const userId = record.identifier.slice(RESET_PREFIX.length);
  const hash = await hashPassword(newPassword);
  await withTransaction(async (session) => {
    await Account.updateMany({ userId: oid(userId), providerId: "credential" }, { $set: { password: hash } }, opts(session));
    await Verification.deleteMany({ identifier: record.identifier }, opts(session));
    // Signing out everywhere protects an account whose password was compromised.
    await Session.deleteMany({ userId: oid(userId) }, opts(session));
  });
  return userId;
}

export async function changePassword(actor, currentPassword, newPassword) {
  const account = await Account.findOne({ userId: oid(actor.id), providerId: "credential" }).lean();
  if (!account?.password || !(await verifyPassword(currentPassword, account.password))) {
    throw new AppError("Your current password is incorrect.", "INVALID", { currentPassword: "Your current password is incorrect." });
  }
  await Account.updateOne({ _id: account._id }, { $set: { password: await hashPassword(newPassword) } });
}

/** The ADMIN, BRAND or MANUFACTURER home (src/components/app/nav.ts homeFor). */
export function homeFor(role) {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

/**
 * GET /api/auth/me payload: the actor plus what today's (app)/layout.tsx loaded for the app shell.
 * @param {{ id: string, role: string, name: string, email: string, profileCompleted: boolean } | null} actor
 */
export async function currentUserSummary(actor) {
  if (!actor) return null;
  const userId = oid(actor.id);
  const [unread, org] = await Promise.all([
    Notification.countDocuments({ userId, readAt: null }),
    actor.role === "BRAND"
      ? BrandProfile.findOne({ userId }, { companyName: 1 }).lean().then((p) => p?.companyName ?? null)
      : actor.role === "MANUFACTURER"
        ? ManufacturerProfile.findOne({ userId }, { businessName: 1 }).lean().then((p) => p?.businessName ?? null)
        : Promise.resolve("Fashinza administration"),
  ]);
  return { id: actor.id, name: actor.name, email: actor.email, role: actor.role, profileCompleted: actor.profileCompleted, org, unread };
}
