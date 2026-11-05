/**
 * Route gates (port of requireUser / requireOnboardedUser in src/server/auth/session.ts).
 * Check order: authentication → role → onboarding. Redirects became error codes the client acts on:
 * 401 UNAUTHENTICATED → /login?next=…, 403 ROLE_DENIED → /dashboard?denied=1, 403 PROFILE_INCOMPLETE → /onboarding.
 * Each sets `req.actor`.
 */
import { getCurrentUser } from "../auth/session.js";
import { profileIncomplete, roleDenied, unauthenticated } from "../lib/errors.js";

/** @param {string[]} [roles] */
export function requireUser(roles) {
  return async function requireUserMiddleware(req, _res, next) {
    const user = await getCurrentUser(req);
    if (!user) throw unauthenticated();
    if (roles && !roles.includes(user.role)) throw roleDenied();
    req.actor = user;
    next();
  };
}

/** Like requireUser, but non-admins must also have completed their organisation profile. */
export function requireOnboardedUser(roles) {
  return async function requireOnboardedUserMiddleware(req, _res, next) {
    const user = await getCurrentUser(req);
    if (!user) throw unauthenticated();
    if (roles && !roles.includes(user.role)) throw roleDenied();
    if (!user.profileCompleted && user.role !== "ADMIN") throw profileIncomplete();
    req.actor = user;
    next();
  };
}

/** Role check for routers that already ran requireUser (e.g. router.use(requireUser(), requireRole("ADMIN"))). */
export function requireRole(...roles) {
  const allowed = roles.flat();
  return function requireRoleMiddleware(req, _res, next) {
    if (!req.actor) throw unauthenticated();
    if (!allowed.includes(req.actor.role)) throw roleDenied();
    next();
  };
}

/** Sets req.actor to the signed-in user or null; never fails. */
export async function optionalUser(req, _res, next) {
  req.actor = await getCurrentUser(req);
  next();
}
