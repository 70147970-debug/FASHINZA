import { expect, test } from "@playwright/test";
import { ACCOUNTS } from "./env";
import { chip, confirmDialog, login, logout, pdf } from "./helpers";

test.describe.configure({ mode: "serial" });

const factory = { email: `factory-${Date.now()}@e2e.test`, password: "FactoryPassword1", name: "E2E Stitch Works" };

test("a new manufacturer onboards, uploads documents and requests verification", async ({ page }) => {
  await page.goto("/register?role=manufacturer");
  await page.getByLabel("Full name").fill("Bilal Ahmed");
  await page.getByLabel("Factory or business name").fill(factory.name);
  await page.getByLabel("Work email").fill(factory.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(factory.password);
  await page.getByLabel("Confirm password").fill(factory.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("About the factory").fill("Woven shirt specialist with 120 machines and an in-house sampling room.");
  await page.getByRole("textbox", { name: "Country", exact: true }).fill("Pakistan");
  await page.getByRole("textbox", { name: "City", exact: true }).fill("Faisalabad");
  await chip(page, "Product categories", "Shirts");
  await chip(page, "Production processes", "Cut and sew");
  await page.getByLabel("Minimum order (units)").fill("150");
  await page.getByLabel("Monthly capacity (units)").fill("6000");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/factory\?welcome=1/);

  // Verification cannot be requested before the business registration is uploaded.
  await expect(page.getByRole("button", { name: "Request verification" })).toBeDisabled();
  await page.locator("#doc-file").setInputFiles(pdf("registration.pdf"));
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("link", { name: "Business registration" })).toBeVisible();
  await page.getByRole("button", { name: "Request verification" }).click();
  await confirmDialog(page, "Send request");
  await expect(page.getByText(/is being reviewed/)).toBeVisible();
});

test("an administrator verifies the document and approves the factory", async ({ page }) => {
  await logout(page);
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto("/admin/factories");
  await page.getByRole("link", { name: factory.name }).click();
  // Approving before the registration document is verified is refused.
  await page.getByRole("button", { name: "Approve factory" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Verification note").fill("Checked.");
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(dialog.getByText("Verify the business registration document before approving the factory.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Verify" }).first().click();
  await confirmDialog(page, "Verify document");
  await page.getByRole("button", { name: "Approve factory" }).click();
  await confirmDialog(page, "Approve", { "Verification note": "Registration certificate checked against the registry." });
  await expect(page.getByText("Verified").first()).toBeVisible();

  await logout(page);
  await login(page, factory.email, factory.password);
  await page.goto("/notifications");
  await expect(page.getByText("Your factory is verified")).toBeVisible();
});

test("an administrator suspends an account and it can no longer sign in", async ({ page }) => {
  await logout(page);
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto(`/admin/users?q=${encodeURIComponent(factory.email)}`);
  await page.getByRole("button", { name: "Suspend" }).click();
  await confirmDialog(page, "Suspend account", { "Reason (recorded in the audit log)": "E2E suspension test" });
  await expect(page.getByRole("cell", { name: /Suspended/ })).toBeVisible();

  await logout(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(factory.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(factory.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/This account has been suspended/)).toBeVisible();
});

test.describe("access control and validation", () => {
  test("signed-out visitors are sent to login with a return path", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
  });

  test("non-admins cannot open admin pages", async ({ page }) => {
    await login(page, ACCOUNTS.knitFactory.email, ACCOUNTS.knitFactory.password);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/dashboard\?denied=1/);
    await expect(page.getByText("That page is not available for your account type.")).toBeVisible();
  });

  test("files cannot be downloaded without a session", async ({ request }) => {
    const res = await request.get("/api/files/projects/00000000000000000000000000000000.pdf");
    expect(res.status()).toBe(401);
  });

  test("webhooks with a bad signature are rejected", async ({ request }) => {
    const res = await request.post("/api/webhooks/payments/sandbox", { data: { id: "evt_fake", type: "payment.succeeded", data: { providerRef: "x" } }, headers: { "x-fashinza-signature": "t=1,v1=00" } });
    expect(res.status()).toBe(400);
  });

  test("login and registration show field-level validation", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await page.getByLabel("Email").fill("nobody@e2e.test");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("WrongPassword1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("The email or password is incorrect.")).toBeVisible();

    await page.goto("/register");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
    await expect(page.getByText("Enter your full name.")).toBeVisible();
  });

  test("the health check reports the database", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    expect(await res.json()).toMatchObject({ status: "ok", database: "ok" });
  });
});
