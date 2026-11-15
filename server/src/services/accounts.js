/**
 * Accounts (port of src/server/services/accounts.ts): registration, sign-in, password reset and change.
 * Account suspension (setUserStatus) lives in services/admin.js (SERVER-B), per docs/mern/api.md §5.
 *
 * MERN additions: new brands start PENDING approval (services/brand-approval.js), and a forgotten password is
 * reset with a 6-digit code sent by email (createPasswordResetCode → verifyPasswordResetCode → resetPassword)
 * instead of a reset link.
 */
import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import { RESET_CODE_LENGTH } from "@fashinza/shared/validation/auth.js";
import { isDuplicateKeyError, withTransaction } from "../db.js";
import { burnPasswordCheck, hashPassword, newToken, sha256, verifyPassword } from "../auth/password.js";
import { AppError, invalid } from "../lib/errors.js";
import { notify } from "../lib/events.js";
import { idOf } from "../lib/ids.js";
import { oid, opts } from "../lib/records.js";
import { Account } from "../models/Account.js";
import { BrandProfile } from "../models/BrandProfile.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { Notification } from "../models/Notification.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { Verification } from "../models/Verification.js";
import { approvalOf, emailAdminsAboutNewBrand, notifyAdminsOfNewBrand } from "./brand-approval.js";

/** A reset code works for 10 minutes and for at most 5 guesses; the token it unlocks works for 15 minutes. */
export const RESET_CODE_TTL_MINUTES = 10;
export const RESET_TOKEN_TTL_MINUTES = 15;
export const MAX_RESET_CODE_ATTEMPTS = 5;
const CODE_PREFIX = "password-reset-code:";
const TOKEN_PREFIX = "password-reset-token:";
/** Rows of the old reset-link flow; removed whenever a new code is issued. */
const LEGACY_LINK_PREFIX = "password-reset:";

export const RESET_MESSAGES = Object.freeze({
  incorrect: "You have entered the incorrect code.",
  expired: "This code has expired. Request a new one.",
  tooMany: "Too many incorrect attempts. Request a new code.",
  session: "Your reset session has expired. Request a new code.",
});

/**
 * Creates the user, its password credential and an empty organisation profile in one transaction.
 * A new BRAND starts PENDING approval and every administrator is told (in the app, and by email after the
 * commit). `options.approved` is for trusted callers only (the demo seed): the brand is created APPROVED and the
 * administrators are not asked to review it.
 * @param {{ role: "BRAND" | "MANUFACTURER", name: string, organization: string, email: string, password: string }} input
 * @param {{ approved?: boolean }} [options]
 * @returns {Promise<string>} the new user id
 */
export async function registerAccount(input, options = {}) {
  const existing = await User.exists({ email: input.email });
  if (existing) throw new AppError("An account with this email already exists.", "CONFLICT", { email: "An account with this email already exists. Sign in instead." });
  const passwordHash = await hashPassword(input.password);
  const userId = new mongoose.Types.ObjectId();
  const id = userId.toHexString();
  const isBrand = input.role === "BRAND";
  const preApproved = isBrand && options.approved === true;
  const pending = isBrand && !preApproved;
  /** @type {string[]} */
  let adminEmails = [];
  try {
    await withTransaction(async (session) => {
      // Brands wait for an administrator's approval before they can create projects (services/brand-approval.js).
      const approval = pending ? { approvalStatus: "PENDING" } : preApproved ? { approvalStatus: "APPROVED", approvalReviewedAt: new Date() } : {};
      await User.create([{ _id: userId, name: input.name, email: input.email, role: input.role, ...approval }], opts(session));
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
        pending
          ? "Complete your company profile. Fashinza checks every new brand within 24–48 hours; you can create production projects once your brand is approved."
          : isBrand
            ? "Complete your company profile to create your first production project."
            : "Complete your factory profile and upload documents to request verification.",
        "/onboarding",
      );
      if (pending) adminEmails = await notifyAdminsOfNewBrand(session, { id, name: input.name, email: input.email, organization: input.organization });
    });
  } catch (e) {
    // Unique violation from a concurrent registration with the same email.
    if (isDuplicateKeyError(e)) throw new AppError("An account with this email already exists.", "CONFLICT", { email: "An account with this email already exists." });
    throw e;
  }
  if (pending) emailAdminsAboutNewBrand(adminEmails, { id, name: input.name, email: input.email, organization: input.organization });
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

/** A random code of RESET_CODE_LENGTH digits ("042917"). */
function newResetCode() {
  return String(randomInt(0, 10 ** RESET_CODE_LENGTH)).padStart(RESET_CODE_LENGTH, "0");
}

const codeError = (key) => invalid(RESET_MESSAGES[key], { code: RESET_MESSAGES[key] });

/**
 * Forgot password, step 1: issues a new 6-digit code for an active account, replacing any earlier code and reset
 * token (one active code per account). Only a salted scrypt hash of the code is stored. The code is hashed before
 * the account is looked up, so the time taken does not reveal whether the account exists.
 * @param {string} email normalised (lower-case) email
 * @returns {Promise<{ code: string, user: { id: string, name: string, email: string } } | null>} null for unknown or suspended accounts
 */
export async function createPasswordResetCode(email) {
  const code = newResetCode();
  const hash = await hashPassword(code);
  const user = await User.findOne({ email }, { status: 1, name: 1, email: 1 }).lean();
  if (!user || user.status !== "ACTIVE") return null;
  const uid = idOf(user._id);
  await withTransaction(async (session) => {
    await Verification.deleteMany({ identifier: { $in: [`${CODE_PREFIX}${uid}`, `${TOKEN_PREFIX}${uid}`, `${LEGACY_LINK_PREFIX}${uid}`] } }, opts(session));
    await Verification.create(
      [{ identifier: `${CODE_PREFIX}${uid}`, value: hash, attempts: 0, expiresAt: new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000) }],
      opts(session),
    );
  });
  return { code, user: { id: uid, name: user.name, email: user.email } };
}

/**
 * Forgot password, step 2: checks the code for `email`. Wrong code → "You have entered the incorrect code."
 * (also for unknown accounts, so accounts cannot be discovered); after 10 minutes → "This code has expired.
 * Request a new one."; the 5th wrong guess and any later one → "Too many incorrect attempts. Request a new code."
 * The right code is used up and exchanged for a reset token (only its SHA-256 is stored) valid for 15 minutes.
 * @returns {Promise<{ token: string, userId: string }>}
 */
export async function verifyPasswordResetCode(email, code) {
  const user = await User.findOne({ email }, { status: 1 }).lean();
  const record = user && user.status === "ACTIVE" ? await Verification.findOne({ identifier: `${CODE_PREFIX}${idOf(user._id)}` }).lean() : null;
  if (!record) {
    await burnPasswordCheck(code); // same work as a real check
    throw codeError("incorrect");
  }
  if (record.attempts >= MAX_RESET_CODE_ATTEMPTS) throw codeError("tooMany");
  if (record.expiresAt < new Date()) throw codeError("expired");
  // Count the guess before checking it, so parallel guesses cannot go past the limit.
  const counted = await Verification.findOneAndUpdate({ _id: record._id, attempts: { $lt: MAX_RESET_CODE_ATTEMPTS } }, { $inc: { attempts: 1 } }, { new: true }).lean();
  if (!counted) throw codeError("tooMany");
  if (!(await verifyPassword(code, record.value))) throw codeError(counted.attempts >= MAX_RESET_CODE_ATTEMPTS ? "tooMany" : "incorrect");
  const uid = idOf(user._id);
  const token = newToken();
  await withTransaction(async (session) => {
    // Single use: only the request that removes the code receives a token.
    const used = await Verification.deleteOne({ _id: record._id }, opts(session));
    if (!used.deletedCount) throw codeError("incorrect");
    await Verification.deleteMany({ identifier: `${TOKEN_PREFIX}${uid}` }, opts(session));
    await Verification.create(
      [{ identifier: `${TOKEN_PREFIX}${uid}`, value: sha256(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000) }],
      opts(session),
    );
  });
  return { token, userId: uid };
}

/**
 * Forgot password, step 3: sets the new password with the token from step 2, removes every reset row of the user
 * and signs the user out everywhere.
 * @returns {Promise<string>} the user id
 */
export async function resetPassword(token, newPassword) {
  const record = await Verification.findOne({ value: sha256(String(token)), identifier: { $regex: `^${TOKEN_PREFIX}` } }).lean();
  if (!record || record.expiresAt < new Date()) throw invalid(RESET_MESSAGES.session);
  const userId = record.identifier.slice(TOKEN_PREFIX.length);
  const hash = await hashPassword(newPassword);
  await withTransaction(async (session) => {
    await Account.updateMany({ userId: oid(userId), providerId: "credential" }, { $set: { password: hash } }, opts(session));
    await Verification.deleteMany({ identifier: { $in: [`${CODE_PREFIX}${userId}`, `${TOKEN_PREFIX}${userId}`, `${LEGACY_LINK_PREFIX}${userId}`] } }, opts(session));
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
  const [unread, org, approval] = await Promise.all([
    Notification.countDocuments({ userId, readAt: null }),
    actor.role === "BRAND"
      ? BrandProfile.findOne({ userId }, { companyName: 1 }).lean().then((p) => p?.companyName ?? null)
      : actor.role === "MANUFACTURER"
        ? ManufacturerProfile.findOne({ userId }, { businessName: 1 }).lean().then((p) => p?.businessName ?? null)
        : Promise.resolve("Fashinza administration"),
    User.findById(userId, { approvalStatus: 1, approvalNote: 1 }).lean(),
  ]);
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
    profileCompleted: actor.profileCompleted,
    org,
    unread,
    // Brand approval (services/brand-approval.js); manufacturers and administrators are always APPROVED.
    approvalStatus: approvalOf(approval),
    approvalNote: approval?.approvalNote ?? null,
  };
}
