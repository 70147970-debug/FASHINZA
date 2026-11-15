/**
 * Outgoing email over SMTP (nodemailer). Configuration (src/config.js `config.mail`, documented in
 * server/.env.example): SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), SMTP_SECURE (true), SMTP_USER, SMTP_PASS (for
 * Gmail an app password, never the account password), MAIL_FROM ("Fashinza <SMTP_USER>").
 *
 * - Without SMTP_USER/SMTP_PASS nothing is sent: the recipient, subject and text body are written to the server
 *   console ("[mail] SMTP not configured — not sent"), so codes can be read in the terminal during development.
 * - With MAIL_OUTBOX_DIR set, every message is ALSO written there as `<time>-<id>.json`
 *   `{ to, subject, text, html, sentAt }` (the e2e suite reads password-reset codes from it).
 * - sendMail never throws: a failed delivery is logged and reported as `{ sent: false }`. Callers must not send
 *   from inside a database transaction (transactions can be retried); send after the commit instead.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { config } from "../config.js";

/** @typedef {{ to: string | string[], subject: string, text: string, html?: string }} MailMessage */

/** @type {import("nodemailer").Transporter | null} */
let transporter = null;

/** Whether SMTP credentials are configured (otherwise messages only go to the console). */
export function mailConfigured() {
  return Boolean(config.mail.user && config.mail.pass);
}

function transport() {
  transporter ??= nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: config.mail.user, pass: config.mail.pass },
    // Fail fast instead of holding a request (or a background task) for minutes.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

const recipients = (to) => (Array.isArray(to) ? to.join(", ") : to);

async function writeOutbox(dir, message, sentAt) {
  try {
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${sentAt.getTime()}-${randomUUID()}.json`);
    const body = { to: message.to, subject: message.subject, text: message.text, html: message.html ?? null, sentAt: sentAt.toISOString() };
    await fs.writeFile(file, JSON.stringify(body, null, 2));
  } catch (e) {
    console.error(`[mail] could not write to MAIL_OUTBOX_DIR: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * Sends one message. Resolves `{ sent: true }` when the SMTP server accepted it, `{ sent: false }` otherwise
 * (not configured, or delivery failed; the reason is logged without credentials).
 * @param {MailMessage} message
 * @returns {Promise<{ sent: boolean }>}
 */
export async function sendMail({ to, subject, text, html }) {
  const message = { to, subject, text, html };
  const sentAt = new Date();
  if (config.mail.outboxDir) await writeOutbox(config.mail.outboxDir, message, sentAt);
  if (!mailConfigured()) {
    console.info(`[mail] SMTP not configured — not sent\n  to: ${recipients(to)}\n  subject: ${subject}\n${text.replace(/^/gm, "  | ")}`);
    return { sent: false };
  }
  try {
    await transport().sendMail({ from: config.mail.from, to, subject, text, ...(html ? { html } : {}) });
    return { sent: true };
  } catch (e) {
    console.error(`[mail] sending "${subject}" to ${recipients(to)} failed: ${e instanceof Error ? e.message : e}`);
    return { sent: false };
  }
}

/** Starts sending without waiting (responses must not wait for, or reveal, SMTP delivery). */
export function sendMailInBackground(message) {
  void sendMail(message).catch((e) => console.error("[mail] unexpected failure", e));
}

/** Absolute link into the web app for emails (APP_URL, else the Vite dev server). */
export function appLink(pathname) {
  const base = (config.appUrl ?? "http://localhost:5173").replace(/\/+$/, "");
  return `${base}${pathname}`;
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * A plain, accessible email in both formats: greeting, paragraphs, an optional highlighted code and an optional
 * button link, then a sign-off. Every value is escaped.
 * @param {{ greeting?: string, paragraphs: string[], code?: string, action?: { label: string, href: string }, footer?: string }} o
 * @returns {{ text: string, html: string }}
 */
export function composeEmail({ greeting, paragraphs, code, action, footer }) {
  const textParts = [
    greeting,
    ...paragraphs,
    code ? `Your code: ${code}` : null,
    action ? `${action.label}: ${action.href}` : null,
    footer ?? "— The Fashinza team",
  ].filter(Boolean);
  const p = (s) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f1d1a">${escapeHtml(s)}</p>`;
  const html = [
    '<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f6f4f0;font-family:Arial,Helvetica,sans-serif">',
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e0d8;border-radius:8px;padding:28px">',
    '<p style="margin:0 0 20px;font-size:18px;font-weight:bold;letter-spacing:.02em;color:#1f1d1a">Fashinza</p>',
    greeting ? p(greeting) : "",
    ...paragraphs.map(p),
    code
      ? `<p style="margin:8px 0 24px;font-size:30px;font-weight:bold;letter-spacing:.3em;font-family:'Courier New',monospace;color:#1f1d1a" aria-label="Your code: ${escapeHtml(code.split("").join(" "))}">${escapeHtml(code)}</p>`
      : "",
    action
      ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(action.href)}" style="display:inline-block;background:#1f3d33;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:6px">${escapeHtml(action.label)}</a></p>`
      : "",
    `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5c5750">${escapeHtml(footer ?? "— The Fashinza team")}</p>`,
    "</div></body></html>",
  ].join("");
  return { text: textParts.join("\n\n"), html };
}
