/**
 * Outgoing email (src/lib/mail.js). Without SMTP credentials nothing is sent: the message goes to the console.
 * With MAIL_OUTBOX_DIR every message is also written there as JSON (the e2e suite reads reset codes from it).
 * With credentials, nodemailer is used with the configured SMTP settings.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const sendMailSpy = vi.fn();
const createTransport = vi.fn(() => ({ sendMail: sendMailSpy }));
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "MAIL_OUTBOX_DIR"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

/** Loads lib/mail.js (and config.js) fresh with the given mail settings. */
async function loadMail(env) {
  for (const k of KEYS) process.env[k] = "";
  Object.assign(process.env, env);
  vi.resetModules();
  return import("../../src/lib/mail.js");
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
  sendMailSpy.mockReset();
  createTransport.mockClear();
});

const message = { to: "ayesha@example.test", subject: "Your Fashinza password reset code", text: "Your code: 123456", html: "<p>123456</p>" };

describe("sendMail", () => {
  it("logs the message to the console instead of sending when SMTP is not configured", async () => {
    const { sendMail, mailConfigured } = await loadMail({});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(mailConfigured()).toBe(false);
    await expect(sendMail(message)).resolves.toEqual({ sent: false });
    const logged = info.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("[mail] SMTP not configured — not sent");
    expect(logged).toContain("ayesha@example.test");
    expect(logged).toContain("Your Fashinza password reset code");
    expect(logged).toContain("Your code: 123456");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("also writes every message to MAIL_OUTBOX_DIR as JSON", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fz-mail-"));
    const { sendMail } = await loadMail({ MAIL_OUTBOX_DIR: dir });
    vi.spyOn(console, "info").mockImplementation(() => {});
    await sendMail(message);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files).toHaveLength(1);
    const written = JSON.parse(fs.readFileSync(path.join(dir, files[0]), "utf8"));
    expect(written).toEqual({ ...message, sentAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(written.sentAt))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("sends over SMTP with Gmail defaults when credentials are set, and never throws on failure", async () => {
    const { sendMail, mailConfigured } = await loadMail({ SMTP_USER: "sender@example.test", SMTP_PASS: "app-password" });
    expect(mailConfigured()).toBe(true);
    sendMailSpy.mockResolvedValueOnce({ messageId: "1" });
    await expect(sendMail(message)).resolves.toEqual({ sent: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "sender@example.test", pass: "app-password" } }),
    );
    expect(sendMailSpy).toHaveBeenCalledWith(expect.objectContaining({ from: "Fashinza <sender@example.test>", to: message.to, subject: message.subject, text: message.text }));

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMailSpy.mockRejectedValueOnce(new Error("Invalid login"));
    await expect(sendMail(message)).resolves.toEqual({ sent: false });
    expect(error.mock.calls.flat().join(" ")).toContain("Invalid login");
    expect(error.mock.calls.flat().join(" ")).not.toContain("app-password");
  });

  it("honours SMTP_HOST, SMTP_PORT, SMTP_SECURE and MAIL_FROM", async () => {
    const { sendMail } = await loadMail({
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "u@example.test",
      SMTP_PASS: "p",
      MAIL_FROM: "Fashinza Support <support@example.test>",
    });
    sendMailSpy.mockResolvedValueOnce({});
    await sendMail(message);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.example.test", port: 587, secure: false }));
    expect(sendMailSpy).toHaveBeenCalledWith(expect.objectContaining({ from: "Fashinza Support <support@example.test>" }));
  });
});

describe("composeEmail", () => {
  it("builds matching text and escaped HTML with the code and the link", async () => {
    const { composeEmail } = await loadMail({});
    const { text, html } = composeEmail({
      greeting: "Hello Ayesha,",
      paragraphs: ["Loom & Line <registered>."],
      code: "042917",
      action: { label: "Review the brand", href: "http://localhost:5173/admin/brands/1" },
    });
    expect(text).toContain("Your code: 042917");
    expect(text).toContain("Review the brand: http://localhost:5173/admin/brands/1");
    expect(html).toContain("Loom &amp; Line &lt;registered&gt;.");
    expect(html).not.toContain("<registered>");
    expect(html).toContain("042917");
  });
});
