import { expect, test } from "@playwright/test";
import { ACCOUNTS } from "./env";
import { login } from "./helpers";

/**
 * Regression guard: with Next.js 15.5 (bundled React 19.2 canary) roughly one in four client-side navigations
 * made shortly after a page load never committed — React lost the ping for an already-resolved promise and the
 * page stayed on the old screen. Twenty quick clicks make a recurrence almost certain to fail this test.
 */
test("client-side navigations right after a page load always complete", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  for (let i = 0; i < 20; i++) {
    await page.goto("/admin/factories?status=ALL");
    await page.getByRole("table").getByRole("link").first().click();
    await expect(page.getByRole("button", { name: /Suspend|Reinstate/ }), `navigation ${i + 1} did not complete`).toBeVisible({ timeout: 8000 });
  }
});
