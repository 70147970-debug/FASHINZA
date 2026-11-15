/**
 * Auth & account (mounted at /api/auth) — owner: SERVER-A (docs/api.md §3.1, §6.1).
 * Port of src/app/(auth)/actions.ts, changePasswordAction in (app)/profile-actions.ts and the app layout's user data.
 *   GET  /me                 public
 *   POST /register           public
 *   POST /login              public
 *   POST /logout             public
 *   POST /forgot-password         public  step 1: email a 6-digit code
 *   POST /forgot-password/verify  public  step 2: check the code, receive a reset token
 *   POST /reset-password          public  step 3: new password with the reset token
 *   POST /change-password         user
 */
import { Router } from "express";
import { forgotPasswordSchema, loginSchema, registerSchema, resetCodeSchema, resetPasswordSchema } from "@fashinza/shared/validation/auth.js";
import { changePasswordSchema } from "@fashinza/shared/validation/profile.js";
import { createSession, destroySession, getCurrentUser } from "../auth/session.js";
import { ok, readForm, validateForm } from "../lib/form.js";
import { composeEmail, sendMailInBackground } from "../lib/mail.js";
import { enforceRateLimit, RATE_LIMIT_MESSAGES } from "../lib/rate-limit.js";
import { clientIp, userAgent } from "../lib/request.js";
import { requireUser } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { invalid } from "../lib/errors.js";
import {
  authenticate,
  changePassword,
  createPasswordResetCode,
  currentUserSummary,
  homeFor,
  registerAccount,
  resetPassword,
  RESET_CODE_TTL_MINUTES,
  verifyPasswordResetCode,
} from "../services/accounts.js";

const router = Router();
const HOUR = 60 * 60 * 1000;
const TOO_MANY = RATE_LIMIT_MESSAGES.attempts;

const sessionMeta = (req) => ({ ip: clientIp(req), userAgent: userAgent(req) });

/** Kept under their old names for callers of the previous reset-link flow. */
export const forgotSchema = forgotPasswordSchema;
export const resetSchema = resetPasswordSchema;

/** Same answer whether or not the account exists, so emails cannot be enumerated. */
export const FORGOT_PASSWORD_MESSAGE = `If an account exists for that email, we've sent a 6-digit code. It expires in ${RESET_CODE_TTL_MINUTES} minutes.`;
/** Seconds before the client offers "Resend code" (the server enforces the same per email). */
export const RESEND_AFTER_SECONDS = 60;

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
  enforceRateLimit(`forgot:${clientIp(req)}`, 10, HOUR, TOO_MANY);
  const { email } = validateForm(forgotPasswordSchema, readForm(req));
  // Per email (whether or not an account exists): one code a minute, five an hour.
  enforceRateLimit(`forgot-wait:${email}`, 1, RESEND_AFTER_SECONDS * 1000, "Please wait a minute before requesting another code.");
  enforceRateLimit(`forgot-email:${email}`, 5, HOUR, "Too many codes were requested for this email. Please try again in an hour.");
  const issued = await createPasswordResetCode(email);
  if (issued) {
    const { text, html } = composeEmail({
      greeting: `Hello ${issued.user.name.split(" ")[0] || issued.user.name},`,
      paragraphs: [
        "Use this code to reset your Fashinza password. Enter it on the page where you asked for it.",
        `The code expires in ${RESET_CODE_TTL_MINUTES} minutes and works once. If you didn't ask to reset your password, you can ignore this email; your password stays the same.`,
      ],
      code: issued.code,
    });
    // Not awaited: the answer must not wait for (or reveal) the delivery.
    sendMailInBackground({ to: issued.user.email, subject: "Your Fashinza password reset code", text, html });
  }
  ok(res, { message: FORGOT_PASSWORD_MESSAGE, email, resendAfter: RESEND_AFTER_SECONDS });
});

router.post("/forgot-password/verify", async (req, res) => {
  enforceRateLimit(`reset-code:${clientIp(req)}`, 30, 15 * 60 * 1000, TOO_MANY);
  const form = readForm(req);
  const parsed = resetCodeSchema.safeParse({ email: form.email, code: form.code });
  if (!parsed.success) {
    // Show the code's own message (e.g. "You have entered the incorrect code.") rather than the generic one.
    const issue = parsed.error.issues.find((i) => i.path[0] === "code") ?? parsed.error.issues[0];
    const field = String(issue.path[0] ?? "code");
    throw invalid(issue.message, { [field]: issue.message });
  }
  const { token } = await verifyPasswordResetCode(parsed.data.email, parsed.data.code);
  ok(res, { resetToken: token });
});

router.post("/reset-password", async (req, res) => {
  enforceRateLimit(`reset:${clientIp(req)}`, 10, HOUR, TOO_MANY);
  const data = validateForm(resetPasswordSchema, readForm(req));
  await resetPassword(data.token, data.password);
  ok(res, { redirectTo: "/login?reset=1" });
});

router.post("/change-password", requireUser(), async (req, res) => {
  const data = validateForm(changePasswordSchema, readForm(req));
  await changePassword(req.actor, data.currentPassword, data.newPassword);
  ok(res, { message: "Password changed." });
});

export default router;
