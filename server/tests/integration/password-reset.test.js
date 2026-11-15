/**
 * Forgot password with an emailed 6-digit code (services/accounts.js createPasswordResetCode →
 * verifyPasswordResetCode → resetPassword, routes/auth.js): wrong, expired and too many attempts, one active code
 * per account, single use, no account enumeration, rate limits, sessions revoked on reset.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Emails are captured instead of being sent or logged.
const mail = vi.hoisted(() => ({ sent: /** @type {{ to: string | string[], subject: string, text: string, html?: string }[]} */ ([]) }));
vi.mock("../../src/lib/mail.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sendMailInBackground: (m) => void mail.sent.push(m),
    sendMail: async (m) => {
      mail.sent.push(m);
      return { sent: false };
    },
  };
});

const { createApp } = await import("../../src/app.js");
const { authenticate, createPasswordResetCode, MAX_RESET_CODE_ATTEMPTS, resetPassword, verifyPasswordResetCode } = await import("../../src/services/accounts.js");
const { resetRateLimits } = await import("../../src/lib/rate-limit.js");
const { sha256 } = await import("../../src/auth/password.js");
const { Session, User, Verification } = await import("../../src/models/index.js");
const { makeUser, PASSWORD, resetDb } = await import("../support/fixtures.js");
const { sameOrigin, sessionCookie } = await import("../support/http.js");

const MESSAGES = {
  sent: "If an account exists for that email, we've sent a 6-digit code. It expires in 10 minutes.",
  incorrect: "You have entered the incorrect code.",
  expired: "This code has expired. Request a new one.",
  tooMany: "Too many incorrect attempts. Request a new code.",
  session: "Your reset session has expired. Request a new code.",
};
const NEW_PASSWORD = "Changed#Pass2026";

/** A six-digit code that is not `code`. */
const otherCode = (code) => `${code.slice(0, 5)}${(Number(code[5]) + 1) % 10}`;

beforeEach(async () => {
  await resetDb();
  resetRateLimits();
  mail.sent.length = 0;
});

const app = createApp({ clientDistDir: "/nonexistent-client-dist", publicDir: "/nonexistent-public" });
let ipSeq = 0;
const post = (path, ip = `10.9.0.${++ipSeq}`) => sameOrigin(request(app).post(path)).set("X-Forwarded-For", ip);

describe("reset codes (service)", () => {
  it("stores only a salted hash of a 6-digit code that expires in 10 minutes", async () => {
    const user = await makeUser("BRAND");
    const before = Date.now();
    const issued = await createPasswordResetCode(user.email);
    expect(issued).toMatchObject({ code: expect.stringMatching(/^\d{6}$/), user: { id: user.id, email: user.email } });
    const row = await Verification.findOne().orFail().lean();
    expect(row.identifier).toBe(`password-reset-code:${user.id}`);
    expect(row.value).not.toContain(issued.code);
    expect(row.value).not.toBe(sha256(issued.code));
    expect(row.attempts).toBe(0);
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(9.9 * 60 * 1000);
    expect(row.expiresAt.getTime() - before).toBeLessThanOrEqual(10.1 * 60 * 1000);
  });

  it("keeps one active code per account: a new code replaces the old one", async () => {
    const user = await makeUser("BRAND");
    const first = await createPasswordResetCode(user.email);
    const second = await createPasswordResetCode(user.email);
    expect(await Verification.countDocuments()).toBe(1);
    if (first.code !== second.code) await expect(verifyPasswordResetCode(user.email, first.code)).rejects.toThrow(MESSAGES.incorrect);
    await expect(verifyPasswordResetCode(user.email, second.code)).resolves.toMatchObject({ userId: user.id });
  });

  it("gives no code to unknown or suspended accounts", async () => {
    const user = await makeUser("BRAND");
    await User.updateOne({ _id: user.id }, { $set: { status: "SUSPENDED" } });
    expect(await createPasswordResetCode("nobody@example.test")).toBeNull();
    expect(await createPasswordResetCode(user.email)).toBeNull();
    expect(await Verification.countDocuments()).toBe(0);
  });

  it("answers a wrong code, and any code for an unknown account, with the same message", async () => {
    const user = await makeUser("BRAND");
    const { code } = await createPasswordResetCode(user.email);
    await expect(verifyPasswordResetCode(user.email, otherCode(code))).rejects.toMatchObject({
      code: "INVALID",
      message: MESSAGES.incorrect,
      fieldErrors: { code: MESSAGES.incorrect },
    });
    await expect(verifyPasswordResetCode("nobody@example.test", code)).rejects.toMatchObject({ message: MESSAGES.incorrect });
    expect((await Verification.findOne().lean()).attempts).toBe(1);
  });

  it("stops accepting guesses after 5 wrong ones, even the right code", async () => {
    const user = await makeUser("BRAND");
    const { code } = await createPasswordResetCode(user.email);
    const wrong = otherCode(code);
    for (let i = 1; i < MAX_RESET_CODE_ATTEMPTS; i++) await expect(verifyPasswordResetCode(user.email, wrong)).rejects.toThrow(MESSAGES.incorrect);
    await expect(verifyPasswordResetCode(user.email, wrong)).rejects.toThrow(MESSAGES.tooMany);
    await expect(verifyPasswordResetCode(user.email, code)).rejects.toThrow(MESSAGES.tooMany);
    // A new code starts over.
    const fresh = await createPasswordResetCode(user.email);
    await expect(verifyPasswordResetCode(user.email, fresh.code)).resolves.toMatchObject({ token: expect.any(String) });
  });

  it("refuses an expired code with its own message", async () => {
    const user = await makeUser("BRAND");
    const { code } = await createPasswordResetCode(user.email);
    await Verification.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyPasswordResetCode(user.email, code)).rejects.toThrow(MESSAGES.expired);
  });

  it("uses the right code once, issues a 15-minute token, then resets the password and signs out everywhere", async () => {
    const user = await makeUser("BRAND");
    await Session.create({ userId: user.id, token: "other-device", expiresAt: new Date(Date.now() + 1e6) });
    const { code } = await createPasswordResetCode(user.email);
    const before = Date.now();
    const { token } = await verifyPasswordResetCode(user.email, code);
    await expect(verifyPasswordResetCode(user.email, code)).rejects.toThrow(MESSAGES.incorrect);
    const row = await Verification.findOne().orFail().lean();
    expect(row).toMatchObject({ identifier: `password-reset-token:${user.id}`, value: sha256(token) });
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(14.9 * 60 * 1000);
    expect(row.expiresAt.getTime() - before).toBeLessThanOrEqual(15.1 * 60 * 1000);

    expect(await resetPassword(token, NEW_PASSWORD)).toBe(user.id);
    expect(await authenticate(user.email, NEW_PASSWORD)).toBe(user.id);
    await expect(authenticate(user.email, PASSWORD)).rejects.toThrow(/incorrect/);
    expect(await Session.countDocuments({ userId: user.id })).toBe(0);
    expect(await Verification.countDocuments()).toBe(0);
    await expect(resetPassword(token, "Another#Pass2026")).rejects.toThrow(MESSAGES.session);
  });

  it("refuses an expired reset token and ignores old reset-link rows", async () => {
    const user = await makeUser("BRAND");
    const { code } = await createPasswordResetCode(user.email);
    const { token } = await verifyPasswordResetCode(user.email, code);
    await Verification.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPassword(token, NEW_PASSWORD)).rejects.toThrow(MESSAGES.session);

    const legacy = "a".repeat(64);
    await Verification.create({ identifier: `password-reset:${user.id}`, value: sha256(legacy), expiresAt: new Date(Date.now() + 1e6) });
    await expect(resetPassword(legacy, NEW_PASSWORD)).rejects.toThrow(MESSAGES.session);
  });
});

describe("reset codes (HTTP)", () => {
  it("emails the code to existing accounts only, with the same answer for every email", async () => {
    const user = await makeUser("BRAND");
    const known = await post("/api/auth/forgot-password").send({ email: user.email.toUpperCase() });
    const unknown = await post("/api/auth/forgot-password").send({ email: "nobody@example.test" });
    expect(known.status).toBe(200);
    expect(known.body).toEqual({ ok: true, message: MESSAGES.sent, email: user.email, resendAfter: 60 });
    expect(unknown.body).toEqual({ ok: true, message: MESSAGES.sent, email: "nobody@example.test", resendAfter: 60 });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: user.email, subject: "Your Fashinza password reset code" });
    const code = /Your code: (\d{6})/.exec(mail.sent[0].text)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    expect(mail.sent[0].html).toContain(code);
    expect(mail.sent[0].text).toContain("10 minutes");
  });

  it("walks through wrong code, right code and new password", async () => {
    const user = await makeUser("BRAND");
    const other = await sessionCookie(user.id);
    await post("/api/auth/forgot-password").send({ email: user.email });
    const code = /Your code: (\d{6})/.exec(mail.sent[0].text)[1];

    const wrong = await post("/api/auth/forgot-password/verify").send({ email: user.email, code: otherCode(code) });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toEqual({ code: "INVALID", message: MESSAGES.incorrect, fieldErrors: { code: MESSAGES.incorrect } });
    const unknown = await post("/api/auth/forgot-password/verify").send({ email: "nobody@example.test", code });
    expect(unknown.body.error).toEqual(wrong.body.error);

    // Spaces in a pasted code are ignored.
    const right = await post("/api/auth/forgot-password/verify").send({ email: user.email, code: `${code.slice(0, 3)} ${code.slice(3)}` });
    expect(right.body).toEqual({ ok: true, resetToken: expect.any(String) });

    const weak = await post("/api/auth/reset-password").send({ token: right.body.resetToken, password: "password", confirmPassword: "password" });
    expect(weak.body.error.fieldErrors).toEqual({ password: "Use 12 to 16 characters." });
    const done = await post("/api/auth/reset-password").send({ token: right.body.resetToken, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(done.body).toEqual({ ok: true, redirectTo: "/login?reset=1" });
    expect((await request(app).get("/api/auth/me").set("Cookie", other)).body).toEqual({ user: null });
    const login = await post("/api/auth/login").send({ email: user.email, password: NEW_PASSWORD });
    expect(login.body).toEqual({ ok: true, redirectTo: "/dashboard" });
  });

  it("reports expired codes and too many attempts over HTTP", async () => {
    const user = await makeUser("BRAND");
    await post("/api/auth/forgot-password").send({ email: user.email });
    const code = /Your code: (\d{6})/.exec(mail.sent[0].text)[1];
    for (let i = 0; i < MAX_RESET_CODE_ATTEMPTS - 1; i++) await post("/api/auth/forgot-password/verify").send({ email: user.email, code: otherCode(code) });
    const fifth = await post("/api/auth/forgot-password/verify").send({ email: user.email, code: otherCode(code) });
    expect(fifth.body.error).toEqual({ code: "INVALID", message: MESSAGES.tooMany, fieldErrors: { code: MESSAGES.tooMany } });

    resetRateLimits();
    await post("/api/auth/forgot-password").send({ email: user.email });
    const fresh = /Your code: (\d{6})/.exec(mail.sent[1].text)[1];
    await Verification.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await post("/api/auth/forgot-password/verify").send({ email: user.email, code: fresh });
    expect(expired.body.error).toEqual({ code: "INVALID", message: MESSAGES.expired, fieldErrors: { code: MESSAGES.expired } });
  });

  it("limits codes per email (one a minute, five an hour) whether or not the account exists", async () => {
    const user = await makeUser("BRAND");
    expect((await post("/api/auth/forgot-password").send({ email: user.email })).status).toBe(200);
    const again = await post("/api/auth/forgot-password").send({ email: user.email });
    expect(again.status).toBe(429);
    expect(again.body.error).toEqual({ code: "RATE_LIMITED", message: "Please wait a minute before requesting another code." });
    expect(mail.sent).toHaveLength(1);
    expect((await post("/api/auth/forgot-password").send({ email: "nobody@example.test" })).status).toBe(200);
    expect((await post("/api/auth/forgot-password").send({ email: "nobody@example.test" })).status).toBe(429);
  });

  it("limits code guesses per connection", async () => {
    const ip = "10.9.9.9";
    let last;
    for (let i = 0; i < 31; i++) last = await post("/api/auth/forgot-password/verify", ip).send({ email: "nobody@example.test", code: "123456" });
    expect(last.status).toBe(429);
  });
});
