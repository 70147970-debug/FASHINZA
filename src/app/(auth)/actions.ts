"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { loginSchema, passwordSchema, registerSchema } from "@/lib/validation/auth";
import type { FormState } from "@/lib/form-state";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { parseForm, runAction } from "@/server/action";
import { authenticate, createPasswordReset, registerAccount, resetPassword } from "@/server/services/accounts";
import { createSession, destroySession, getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/components/app/nav";

const TOO_MANY: FormState = { status: "error", message: "Too many attempts from your connection. Please wait a few minutes and try again." };

async function sessionMeta() {
  return { ip: await clientIp(), userAgent: (await headers()).get("user-agent") ?? undefined };
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(`register:${await clientIp()}`, 10, 60 * 60 * 1000).ok) return TOO_MANY;
  const parsed = parseForm(registerSchema, Object.fromEntries(formData));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    const id = await registerAccount(parsed.data);
    await createSession(id, await sessionMeta());
  });
  if (result.status === "error") return result;
  redirect("/onboarding");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(loginSchema, Object.fromEntries(formData));
  if (!parsed.ok) return parsed.state;
  // Limit by connection and by account to slow down password guessing.
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60 * 1000).ok || !rateLimit(`login:${parsed.data.email}`, 10, 15 * 60 * 1000).ok) return TOO_MANY;
  const result = await runAction(async () => {
    const id = await authenticate(parsed.data.email, parsed.data.password);
    await createSession(id, await sessionMeta());
  });
  if (result.status === "error") return result;
  const user = await getCurrentUser();
  const next = String(formData.get("next") ?? "");
  // Only same-site relative paths are allowed as a post-login destination.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : user ? homeFor(user.role) : "/dashboard");
}

export async function signOutAction() {
  await destroySession();
  redirect("/login?signedOut=1");
}

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") });

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(`forgot:${await clientIp()}`, 5, 60 * 60 * 1000).ok) return TOO_MANY;
  const parsed = parseForm(forgotSchema, Object.fromEntries(formData));
  if (!parsed.ok) return parsed.state;
  return runAction(async () => {
    const token = await createPasswordReset(parsed.data.email);
    if (token) {
      const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
      // No email service is configured in this build. In development the link is written to the
      // server log so the flow can be tested; in production it is never logged.
      if (process.env.NODE_ENV !== "production") console.info(`[password-reset] ${parsed.data.email}: ${link}`);
    }
    // Same response whether or not the account exists, so emails cannot be enumerated.
    return "If an account exists for that email, a reset link has been issued. It expires in one hour.";
  });
}

const resetSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(`reset:${await clientIp()}`, 10, 60 * 60 * 1000).ok) return TOO_MANY;
  const parsed = parseForm(resetSchema, Object.fromEntries(formData));
  if (!parsed.ok) return parsed.state;
  const result = await runAction(async () => {
    await resetPassword(parsed.data.token, parsed.data.password);
  });
  if (result.status === "error") return result;
  return { status: "success", redirectTo: "/login?reset=1" };
}
