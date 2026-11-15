import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";
import { E2E_ENV } from "./env.js";

export const pdf = (name = "techpack.pdf") => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% e2e test document\n%%EOF\n") });
export const png = (name = "photo.png") => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("e2e-image-bytes")]),
});

/** @param {import("@playwright/test").Page} page */
export async function login(page, email, password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** @param {import("@playwright/test").Page} page */
export async function logout(page) {
  await page.context().clearCookies();
}

/**
 * The newest email to `to` whose subject contains `subject`, written by the server to MAIL_OUTBOX_DIR
 * (server/src/lib/mail.js: `{ to, subject, text, html, sentAt }`) after `since` (ms). Waits up to 15 s for it.
 * @param {{ to: string, subject: string, since?: number }} query
 * @returns {Promise<{ to: string | string[], subject: string, text: string, html: string | null, sentAt: string }>}
 */
export async function readMail({ to, subject, since = 0 }) {
  const find = () => {
    let files = [];
    try {
      files = fs.readdirSync(E2E_ENV.MAIL_OUTBOX_DIR).filter((f) => f.endsWith(".json"));
    } catch {
      return null; // nothing written yet
    }
    const mails = files
      .map((f) => JSON.parse(fs.readFileSync(path.join(E2E_ENV.MAIL_OUTBOX_DIR, f), "utf8")))
      .filter((m) => [m.to].flat().includes(to) && m.subject.includes(subject) && Date.parse(m.sentAt) >= since)
      .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
    return mails[0] ?? null;
  };
  await expect.poll(find, { message: `an email to ${to} about "${subject}"`, timeout: 15_000 }).not.toBeNull();
  return /** @type {NonNullable<ReturnType<typeof find>>} */ (find());
}

/**
 * Picks a named colour in the brief's colour picker (client/src/components/projects/colour-picker.jsx): searches
 * for it in the "Colours" combobox, chooses the listed option, and checks it was added to the selection.
 * @param {import("@playwright/test").Page} page @param {string} name @param {{ typeSlowly?: boolean }} [options]
 */
export async function pickColour(page, name, { typeSlowly = false } = {}) {
  const search = page.getByRole("combobox", { name: "Colours" });
  if (typeSlowly) {
    await search.click();
    await search.fill("");
    await search.pressSequentially(name, { delay: 28 });
  } else {
    await search.fill(name);
  }
  await page.getByRole("listbox", { name: "Colour suggestions" }).getByRole("option", { name, exact: true }).click();
  await expect(page.getByRole("list", { name: "Your colour selection" }).getByRole("listitem").filter({ hasText: name })).toBeVisible();
}

/** Clicks a toggle chip inside a labelled ChipSelect group. @param {import("@playwright/test").Page} page */
export async function chip(page, group, option) {
  await page.getByRole("group", { name: group }).locator("label", { hasText: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
}

/**
 * Confirms the open dialog by its submit button.
 * @param {import("@playwright/test").Page} page
 * @param {string | RegExp} button
 * @param {Record<string, string>} [fill]
 */
export async function confirmDialog(page, button, fill) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const [label, value] of Object.entries(fill ?? {})) await dialog.getByLabel(label).fill(value);
  await dialog.getByRole("button", { name: button }).click();
  await expect(dialog).toBeHidden();
}

export function inDays(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

/** Fails when the page scrolls sideways (wider content than the viewport). @param {import("@playwright/test").Page} page */
export async function expectNoHorizontalOverflow(page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, `${page.url()} is ${scroll}px wide in a ${width}px viewport`).toBeLessThanOrEqual(width);
}

/**
 * Opens each path on a 320px-wide screen, checks nothing scrolls sideways, then restores the viewport.
 * @param {import("@playwright/test").Page} page
 * @param {string[]} paths
 */
export async function expectPagesFitPhone(page, paths) {
  const original = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 740 });
  try {
    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  } finally {
    if (original) await page.setViewportSize(original);
  }
}
