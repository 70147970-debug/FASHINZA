// Forgot password with an emailed 6-digit code (MERN addition). The server writes every email to
// MAIL_OUTBOX_DIR in the e2e environment (tests-mern/e2e/env.js); readMail reads the code from there.
import { expect, test } from "@playwright/test";
import { login, logout, readMail } from "./helpers.js";

test.describe.configure({ mode: "serial" });

// A fresh account, so no other spec's sign-in is affected. New passwords follow the policy.
const factory = { email: `recovery-${Date.now()}@e2e.test`, password: "Factory#Pass26", name: "E2E Recovery Knits" };
const NEW_PASSWORD = "Reset#Pass2026";

test("a user resets a forgotten password with the emailed code", async ({ page }) => {
  await page.goto("/register?role=manufacturer");
  await page.getByLabel("Full name").fill("Sana Iqbal");
  await page.getByLabel("Factory or business name").fill(factory.name);
  await page.getByLabel("Work email").fill(factory.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(factory.password);
  await page.getByLabel("Confirm password").fill(factory.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await logout(page);

  // Step 1: the email. The answer is the same whether or not an account exists.
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  const since = Date.now();
  await page.getByLabel("Email").fill(factory.email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("If an account exists for that email, we've sent a 6-digit code. It expires in 10 minutes.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend code in \d+ s/ })).toBeDisabled();

  const mail = await readMail({ to: factory.email, subject: "password reset code", since });
  const code = /Your code: (\d{6})/.exec(mail.text)?.[1];
  expect(code, mail.text).toMatch(/^\d{6}$/);
  const wrong = `${code.slice(0, 5)}${(Number(code[5]) + 1) % 10}`;

  // Step 2: a wrong code first, then the right one.
  const codeField = page.getByLabel("6-digit code");
  await codeField.fill(wrong);
  await page.getByRole("button", { name: "Verify code" }).click();
  await expect(page.getByText("You have entered the incorrect code.")).toBeVisible();
  await codeField.fill(code);
  await page.getByRole("button", { name: "Verify code" }).click();

  // Step 3: the new password, with the policy checklist under the field.
  const newPassword = page.getByRole("textbox", { name: "New password", exact: true });
  await expect(newPassword).toBeVisible();
  await newPassword.fill(NEW_PASSWORD);
  await expect(page.locator("#password-requirements li[data-met='false']")).toHaveCount(0);
  await page.getByLabel("Confirm new password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await expect(page.getByText("Your password was changed. Sign in with your new password.")).toBeVisible();

  // The old password no longer works; the new one does.
  await page.getByLabel("Email").fill(factory.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(factory.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("The email or password is incorrect.")).toBeVisible();
  await login(page, factory.email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/onboarding/);
});

test("old reset links explain that codes are used now", async ({ page }) => {
  await logout(page);
  await page.goto("/reset-password?token=0123456789abcdef");
  await expect(page).toHaveURL(/\/forgot-password\?link=old$/);
  await expect(page.getByText("Reset links are no longer used")).toBeVisible();
});
