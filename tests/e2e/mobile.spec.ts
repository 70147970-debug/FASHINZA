import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS } from "./env";
import { login } from "./helpers";

/** Mobile layout checks (Pixel 7 profile, plus 320 px and 375 px widths). */

async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll, `page is ${scroll}px wide in a ${width}px viewport`).toBeLessThanOrEqual(width);
}

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
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "How It Works" }).click();
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
