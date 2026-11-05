import { expect, test } from "@playwright/test";

/** The public website's main promises: the homepage message and the two ways in (brand or manufacturer). */

test("the homepage leads with fashion manufacturing and both calls to action open the right registration", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("From Fashion Ideas to Finished Garments.");
  const hero = page.locator("section", { has: page.locator("#hero-title") });
  // The hero photo is served through the image optimiser and actually loads.
  const heroImage = hero.locator("img").first();
  await expect(heroImage).toBeVisible();
  expect(await heroImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  await hero.getByRole("link", { name: "Start Your Manufacturing Project" }).click();
  await expect(page).toHaveURL(/\/register\?role=brand$/);
  await expect(page.getByLabel("Brand or company name")).toBeVisible();

  await page.goto("/");
  await page.locator("section", { has: page.locator("#hero-title") }).getByRole("link", { name: "Join as a Manufacturer" }).click();
  await expect(page).toHaveURL(/\/register\?role=manufacturer$/);
  await expect(page.getByLabel("Factory or business name")).toBeVisible();
});

test("the header and closing band offer the audience-specific next step", async ({ page }) => {
  await page.goto("/for-manufacturers");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Join as a Manufacturer" })).toHaveAttribute("href", "/register?role=manufacturer");
  await page.goto("/how-it-works");
  await expect(header.getByRole("link", { name: "Start a Project" })).toHaveAttribute("href", /\/register/);
  await expect(header.getByRole("link", { name: "FAQ" })).toBeVisible();
});
