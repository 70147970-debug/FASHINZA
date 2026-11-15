// Social links on the brand profile (decision 5): platform/domain validation, the "Check link" button, saving,
// and the saved link listed for the administrator. Links are never opened live here (LINK_CHECK=off in
// tests-mern/e2e/env.js), so every check answers "Not checked".
import { expect, test } from "@playwright/test";
import { ACCOUNTS, E2E_ENV } from "./env.js";
import { expectPagesFitPhone, login, logout } from "./helpers.js";

test.describe.configure({ mode: "serial" });

/** A seeded, approved demo brand that no other spec signs in as (server/scripts/seed.js). */
const brand = { email: "demo-brand-activewear@fashinza.test", password: E2E_ENV.SEED_DEMO_PASSWORD, org: "Stride Lab Activewear (Demo)" };
const typed = "instagram.com/stridelab.e2e";
const saved = "https://instagram.com/stridelab.e2e";

const platformSelect = (page, n = 1) => page.getByLabel(`Platform for social link ${n}`);
const urlInput = (page, n = 1) => page.getByLabel(new RegExp(`^Link for social link ${n}\\b`));
const socialMedia = (page) => page.getByRole("group", { name: /Social media/ });

test("a brand adds an Instagram link to its profile, after a domain-mismatch error", async ({ page }) => {
  await logout(page);
  await login(page, brand.email, brand.password);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Company profile", level: 1 })).toBeVisible();
  const editor = socialMedia(page);
  await expect(editor.getByText("No website? Add your social media pages instead.")).toBeVisible();

  // A new row: the platform select takes focus.
  await editor.getByRole("button", { name: "Add social link" }).click();
  await expect(platformSelect(page)).toBeFocused();

  // Wrong platform first: an Instagram address under Facebook is refused with a specific message.
  await platformSelect(page).selectOption("FACEBOOK");
  await urlInput(page).fill(typed);
  await urlInput(page).press("Tab");
  const mismatch = editor.getByText("This isn't a Facebook link. Use a URL like https://facebook.com/yourbrand.");
  await expect(mismatch).toBeVisible();
  await expect(urlInput(page)).toHaveAttribute("aria-invalid", "true");
  // "Check link" re-validates in the browser and does not check a link that cannot be right.
  await editor.getByRole("button", { name: /^Check link/ }).click();
  await expect(mismatch).toBeVisible();

  // The right platform clears the error; "Check link" adds https:// and reports the result.
  await platformSelect(page).selectOption("INSTAGRAM");
  await expect(mismatch).toBeHidden();
  await expect(urlInput(page)).not.toHaveAttribute("aria-invalid", "true");
  await editor.getByRole("button", { name: "Check link (Instagram)" }).click();
  await expect(urlInput(page)).toHaveValue(saved);
  await expect(editor.getByText("Not checked")).toBeVisible();

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Company profile saved.")).toBeVisible();

  // Saved: the row comes back from the server with its stored check.
  await page.reload();
  await expect(platformSelect(page)).toHaveValue("INSTAGRAM");
  await expect(urlInput(page)).toHaveValue(saved);
  await expect(socialMedia(page).getByText("Not checked")).toBeVisible();
  // The editor fits a 320px phone screen.
  await expectPagesFitPhone(page, ["/profile"]);
});

test("the administrator sees the saved link listed on the brand review page", async ({ page }) => {
  await logout(page);
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto(`/admin/brands?status=ALL&q=${encodeURIComponent(brand.email)}`);
  await page.getByRole("link", { name: brand.org }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: brand.org, level: 1 })).toBeVisible();

  const link = page.getByRole("link", { name: /instagram\.com\/stridelab\.e2e/ });
  await expect(link).toHaveAttribute("href", saved);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  const item = page.getByRole("listitem").filter({ has: link });
  await expect(item).toContainText("Instagram");
  await expect(item).toContainText("Not checked");
});

test("the brand removes the link again", async ({ page }) => {
  await logout(page);
  await login(page, brand.email, brand.password);
  await page.goto("/profile");
  await socialMedia(page).getByRole("button", { name: "Remove Instagram link" }).click();
  await expect(urlInput(page)).toHaveCount(0);
  await expect(socialMedia(page).getByRole("button", { name: "Add social link" })).toBeFocused();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Company profile saved.")).toBeVisible();
  await page.reload();
  await expect(urlInput(page)).toHaveCount(0);
});
