/**
 * Auth & account (mounted at /api/auth) — owner: SERVER-A (docs/mern/api.md §3.1, §6.1).
 * Port of src/app/(auth)/actions.ts, changePasswordAction in (app)/profile-actions.ts and the app layout's user data.
 *   GET  /me                 public
 *   POST /register           public
 *   POST /login              public
 *   POST /logout             public
 *   POST /forgot-password    public
 *   POST /reset-password     public
 *   POST /change-password    user
 */
import { Router } from "express";
import { z } from "zod";
import { loginSchema, passwordSchema, registerSchema } from "@fashinza/shared/validation/auth.js";
import { changePasswordSchema } from "@fashinza/shared/validation/profile.js";
import { config } from "../config.js";
import { createSession, destroySession, getCurrentUser } from "../auth/session.js";
import { ok, readForm, validateForm } from "../lib/form.js";
import { enforceRateLimit, RATE_LIMIT_MESSAGES } from "../lib/rate-limit.js";
import { clientIp, userAgent } from "../lib/request.js";
import { requireUser } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { authenticate, changePassword, createPasswordReset, currentUserSummary, homeFor, registerAccount, resetPassword } from "../services/accounts.js";

const router = Router();
const HOUR = 60 * 60 * 1000;
const TOO_MANY = RATE_LIMIT_MESSAGES.attempts;

const sessionMeta = (req) => ({ ip: clientIp(req), userAgent: userAgent(req) });

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });

export const resetSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

/** Only same-site relative paths are allowed as a post-login destination. */
export function loginDestination(next, role) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : role ? homeFor(role) : "/dashboard";
}

router.get("/me", async (req, res) => {
  const actor = await getCurrentUser(req);
  res.json({ user: await currentUserSummary(actor) });
});

router.post("/register", async (req, res) => {
  enforceRateLimit(`register:${clientIp(req)}`, 10, HOUR, TOO_MANY);
  const data = validateForm(registerSchema, readForm(req));
  const id = await registerAccount(data);
  await createSession(res, id, sessionMeta(req));
  ok(res, { redirectTo: "/onboarding" });
});

router.post("/login", async (req, res) => {
  const form = readForm(req);
  const data = validateForm(loginSchema, form);
  // Limit by connection and by account to slow down password guessing (the account bucket is only
  // touched when the connection bucket allowed the attempt).
  const ip = clientIp(req);
  enforceRateLimit(`login:${ip}`, 20, 15 * 60 * 1000, TOO_MANY);
  enforceRateLimit(`login:${data.email}`, 10, 15 * 60 * 1000, TOO_MANY);
  const id = await authenticate(data.email, data.password);
  await createSession(res, id, sessionMeta(req));
  const user = await User.findById(id, { role: 1 }).lean();
  ok(res, { redirectTo: loginDestination(form.next, user?.role) });
});

router.post("/logout", async (req, res) => {
  await destroySession(req, res);
  ok(res, { redirectTo: "/login?signedOut=1" });
});

router.post("/forgot-password", async (req, res) => {
  enforceRateLimit(`forgot:${clientIp(req)}`, 5, HOUR, TOO_MANY);
  const { email } = validateForm(forgotSchema, readForm(req));
  const token = await createPasswordReset(email);
  if (token) {
    const link = `${config.appUrl ?? "http://localhost:3000"}/reset-password?token=${token}`;
    // No email service is configured in this build. In development the link is written to the
    // server log so the flow can be tested; in production it is never logged.
    if (!config.isProduction) console.info(`[password-reset] ${email}: ${link}`);
  }
  // Same response whether or not the account exists, so emails cannot be enumerated.
  ok(res, { message: "If an account exists for that email, a reset link has been issued. It expires in one hour." });
});

router.post("/reset-password", async (req, res) => {
  enforceRateLimit(`reset:${clientIp(req)}`, 10, HOUR, TOO_MANY);
  const data = validateForm(resetSchema, readForm(req));
  await resetPassword(data.token, data.password);
  ok(res, { redirectTo: "/login?reset=1" });
});

router.post("/change-password", requireUser(), async (req, res) => {
  const data = validateForm(changePasswordSchema, readForm(req));
  await changePassword(req.actor, data.currentPassword, data.newPassword);
  ok(res, { message: "Password changed." });
});

export default router;
