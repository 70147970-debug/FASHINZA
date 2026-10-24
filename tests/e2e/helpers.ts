import { expect, type Page } from "@playwright/test";

export const pdf = (name = "techpack.pdf") => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% e2e test document\n%%EOF\n") });
export const png = (name = "photo.png") => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("e2e-image-bytes")]),
});

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

/** Clicks a toggle chip inside a labelled ChipSelect group. */
export async function chip(page: Page, group: string, option: string) {
  await page.getByRole("group", { name: group }).locator("label", { hasText: new RegExp(`^${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
}

/** Confirms the open dialog by its submit button. */
export async function confirmDialog(page: Page, button: string | RegExp, fill?: Record<string, string>) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (const [label, value] of Object.entries(fill ?? {})) await dialog.getByLabel(label).fill(value);
  await dialog.getByRole("button", { name: button }).click();
  await expect(dialog).toBeHidden();
}

export function inDays(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}
