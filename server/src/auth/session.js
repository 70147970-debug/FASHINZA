/**
 * Login sessions (port of src/server/auth/session.ts).
 * Cookie `fz_session` holds an opaque random token; only its SHA-256 is stored in the `session` collection.
 */
import { config } from "../config.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { newToken, sha256 } from "./password.js";

export const SESSION_COOKIE = "fz_session";
export const SESSION_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/** Cookie attributes (HttpOnly, SameSite=Lax, Path=/, Secure in production). */
export function sessionCookieOptions(expires) {
  return { httpOnly: true, sameSite: "lax", secure: config.isProduction, path: "/", ...(expires ? { expires } : {}) };
}

/**
 * Creates a session for `userId` and sets the cookie on `res`.
 * @param {import("express").Response} res
 * @param {string} userId
 * @param {{ ip?: string, userAgent?: string }} [meta]
 */
export async function createSession(res, userId, meta = {}) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await Session.create({ userId, token: sha256(token), expiresAt, ipAddress: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 300) ?? null });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return { expiresAt };
}

/** Deletes the session row (by token hash) and clears the cookie. */
export async function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await Session.deleteMany({ token: sha256(token) });
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  delete req[CURRENT];
}

const CURRENT = Symbol("fz.currentUser");

/**
 * The signed-in, active user for this request, or null (missing/expired session, suspended user).
 * Memoised on the request. Actor shape: { id, role, name, email, profileCompleted }.
 * @param {import("express").Request} req
 * @returns {Promise<{ id: string, role: string, name: string, email: string, profileCompleted: boolean } | null>}
 */
export function getCurrentUser(req) {
  req[CURRENT] ??= loadUser(req.cookies?.[SESSION_COOKIE]);
  return req[CURRENT];
}

async function loadUser(token) {
  if (!token || typeof token !== "string") return null;
  const session = await Session.findOne({ token: sha256(token) }, { expiresAt: 1, userId: 1 }).lean();
  if (!session || session.expiresAt < new Date()) return null;
  const user = await User.findById(session.userId, { role: 1, name: 1, email: 1, status: 1, profileCompleted: 1 }).lean();
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user._id.toHexString(), role: user.role, name: user.name, email: user.email, profileCompleted: user.profileCompleted };
}

/** Signs a user out everywhere (password reset, suspension). */
export async function revokeAllSessions(userId, session) {
  await Session.deleteMany({ userId }, { session });
}
