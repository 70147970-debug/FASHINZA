// Port of tests/e2e/public-site.spec.ts for the MERN app (same steps, same selectors).
import { expect, test } from "@playwright/test";

/** The public website's main promises: the homepage message and the two ways in (brand or manufacturer). */

test("the homepage leads with fashion manufacturing and both calls to action open the right registration", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("From Fashion Ideas to Finished Garments.");
  const hero = page.locator("section", { has: page.locator("#hero-title") });
  // The hero photo (a plain <img> served from public/images) actually loads.
  const heroImage = hero.locator("img").first();
  await expect(heroImage).toBeVisible();
  expect(await heroImage.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

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
  await page.goto("/user-guide");
  await expect(header.getByRole("link", { name: "Start a Project" })).toHaveAttribute("href", /\/register/);
  await expect(header.getByRole("link", { name: "FAQ" })).toBeVisible();
});

test("first-time visitors can jump to a brand or manufacturer path and read common questions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /New here\? See how it works/ }).click();
  await expect(page).toHaveURL(/#start$/);
  const start = page.locator("section#start");
  await expect(start.getByRole("heading", { name: "How will you use Fashinza?" })).toBeInViewport();
  await expect(start.getByRole("link", { name: "Start Your Manufacturing Project" })).toHaveAttribute("href", "/register?role=brand");
  await expect(start.getByRole("link", { name: "Join as a Manufacturer" })).toHaveAttribute("href", "/register?role=manufacturer");

  const questions = page.locator("section", { has: page.locator("#questions-title") });
  await questions.getByText("How do samples work?").click();
  await expect(questions.locator("details[open]")).toHaveCount(1);
  await expect(questions.getByRole("link", { name: "Read all questions" })).toHaveAttribute("href", "/faq");
});

test("the User Guide in the header opens a video demo of the whole process, with chapters and captions", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "User Guide" }).click();
  await expect(page).toHaveURL(/\/user-guide$/);
  await expect(page.getByRole("heading", { name: "Watch the whole process" })).toBeVisible();

  // The recording, its poster and its caption track are served.
  const video = page.locator("#video video");
  await expect(video.locator("source")).toHaveAttribute("src", "/videos/user-guide-demo.webm");
  for (const [file, type] of [["user-guide-demo.webm", "video/webm"], ["user-guide-demo-poster.jpg", "image/jpeg"], ["user-guide-demo.vtt", "text/vtt"]]) {
    const res = await request.get(`/videos/${file}`);
    expect(res.status(), file).toBe(200);
    expect(res.headers()["content-type"], file).toContain(type);
  }
  await expect.poll(() => video.evaluate((v) => v.readyState)).toBeGreaterThanOrEqual(1);

  // Chapters jump to their part of the video.
  const chapters = page.getByRole("navigation", { name: "Video chapters" });
  await expect(chapters.getByRole("button")).toHaveCount(10);
  await chapters.getByRole("button", { name: /The brand accepts a quotation/ }).click();
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(30);
  await expect(chapters.getByRole("button", { name: /The brand accepts a quotation/ })).toHaveAttribute("aria-current", "true");

  // Old "How It Works" links, including step anchors, land on the guide.
  await page.goto("/how-it-works#step-2");
  await expect(page).toHaveURL(/\/user-guide#step-2$/);
  await expect(page.locator("#step-2")).toBeInViewport();
  await expect(page.locator("#step-2")).toContainText("Factory sourcing");
});
