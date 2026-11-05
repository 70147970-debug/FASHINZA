import { expect, test } from "@playwright/test";
import { ACCOUNTS } from "./env";
import { expectNoHorizontalOverflow, login } from "./helpers";

/** Mobile layout checks (Pixel 7 profile, plus 320 px and 375 px widths). */

const PUBLIC = ["/", "/how-it-works", "/for-brands", "/for-manufacturers", "/sustainability", "/about", "/faq", "/contact", "/login", "/register", "/privacy", "/terms"];

for (const width of [320, 375]) {
  test(`public pages fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    for (const path of PUBLIC) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });
}

test("the public menu opens as a drawer on phones", async ({ page }) => {
  await page.goto("/");
  // Returning users can sign in without opening the menu.
  await expect(page.getByRole("banner").getByRole("link", { name: "Login" })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  // Both audiences have a way in from the drawer.
  await expect(menu.locator('a[href="/register?role=brand"]').first()).toBeVisible();
  await expect(menu.locator('a[href="/register?role=manufacturer"]').first()).toBeVisible();
  await expect(menu.getByRole("link", { name: "FAQ" })).toBeVisible();
  await menu.getByRole("link", { name: "How It Works" }).click();
  await expect(page).toHaveURL(/how-it-works/);
});

test("the app shell uses a navigation drawer and pages fit the screen", async ({ page }) => {
  await login(page, ACCOUNTS.knitFactory.email, ACCOUNTS.knitFactory.password);
  for (const path of ["/dashboard", "/opportunities", "/quotations", "/orders", "/payments", "/factory", "/notifications", "/settings"]) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL(/\/orders$/);
});

test("admin pages fit a phone screen", async ({ page }) => {
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  for (const path of ["/admin", "/admin/factories?status=ALL", "/admin/users", "/admin/orders", "/admin/audit"]) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
});
