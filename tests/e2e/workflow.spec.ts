import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS } from "./env";
import { chip, confirmDialog, inDays, login, logout, pdf, png } from "./helpers";

/**
 * The main business journey across all three roles, in order. Each step depends on the
 * previous one, so the file runs serially against one shared, freshly seeded database.
 */
test.describe.configure({ mode: "serial" });

const brand = { name: "Ayesha Khan", org: "E2E Threads Ltd", email: `brand-${Date.now()}@e2e.test`, password: "BrandPassword1" };
let projectUrl = "";
let orderUrl = "";

async function asBrand(page: Page) {
  await logout(page);
  await login(page, brand.email, brand.password);
}
async function asFactory(page: Page) {
  await logout(page);
  await login(page, ACCOUNTS.knitFactory.email, ACCOUNTS.knitFactory.password);
}

async function completeEvidenceStage(page: Page, stage: string) {
  const current = page.locator('li[aria-current="step"]');
  await expect(current).toContainText(stage);
  await current.locator('input[type="file"]').setInputFiles(png(`${stage}.png`));
  await current.getByRole("button", { name: "Add evidence" }).click();
  await expect(current.getByRole("link", { name: `Evidence for ${stage}` })).toBeVisible();
  await current.getByRole("button", { name: new RegExp(`Mark ${stage} complete`, "i") }).click();
  await confirmDialog(page, "Complete stage");
  // The completed stage is no longer the current one.
  await expect(page.locator('li[aria-current="step"]')).not.toContainText(stage);
}

test("a new brand registers and completes onboarding", async ({ page }) => {
  await page.goto("/register?role=brand");
  await page.getByLabel("Full name").fill(brand.name);
  await page.getByLabel("Brand or company name").fill(brand.org);
  await page.getByLabel("Work email").fill(brand.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(brand.password);
  await page.getByLabel("Confirm password").fill(brand.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByLabel("Company name")).toHaveValue(brand.org);
  await page.getByLabel("Country").fill("United Kingdom");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard\?welcome=1/);
  await expect(page.getByText("Start your first production run")).toBeVisible();
});

test("the brand briefs a project through the wizard and submits it for matching", async ({ page }) => {
  await asBrand(page);
  await page.getByRole("link", { name: "Create production project" }).first().click();

  // Step 1 — validation then save.
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Enter a project name (at least 3 characters).")).toBeVisible();
  await page.getByLabel("Project name").fill("E2E organic tee");
  await page.getByLabel("Product category").selectOption("T_SHIRTS");
  await page.getByLabel("Product description").fill("Heavyweight organic cotton crew-neck tee with a front screen print.");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=2/);
  projectUrl = page.url().replace(/\/edit.*$/, "");

  // Step 2
  await page.getByLabel("Fabric type and composition").fill("100% organic cotton jersey, 220 gsm");
  await chip(page, "Fabrics the factory must handle", "Organic cotton");
  await page.getByLabel("Colours").fill("Black, Off-white");
  await chip(page, "Sizes", "S");
  await chip(page, "Sizes", "M");
  await chip(page, "Sizes", "L");
  await chip(page, "Manufacturing requirements", "Screen printing");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=3/);

  // Step 3
  await page.getByLabel("Estimated quantity (units)").fill("500");
  await page.getByLabel("Target price per unit").fill("6.50");
  await page.getByLabel("Desired delivery date").fill(inDays(90));
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=4/);

  // Step 4 — require GOTS (the seeded knitwear factory holds a verified GOTS certificate).
  await chip(page, "Required certifications", "GOTS");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=5/);

  // Draft persists across a reload.
  await page.reload();
  await expect(page.getByRole("heading", { name: "E2E organic tee" })).toBeVisible();

  // Step 5 — tech pack upload with progress.
  await page.locator('input[type="file"]').setInputFiles(pdf("e2e-techpack.pdf"));
  await expect(page.getByText("e2e-techpack.pdf").first()).toBeVisible();
  await page.getByRole("link", { name: "Continue to review" }).click();

  // Step 6 — review and submit.
  await expect(page.getByText("Everything factories need is in place.")).toBeVisible();
  await page.getByRole("button", { name: "Submit project for matching" }).click();
  await expect(page).toHaveURL(/submitted=1/);
  await expect(page.getByText(/1 verified factory was invited to quote/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Demo Knitwear Mills/ })).toBeVisible();
  // Factories without verified GOTS (and any created by other specs) are listed as excluded.
  await expect(page.getByText(/Missing a required certification: \d+/)).toBeVisible();
});

test("the matched factory sends a quotation with a server-calculated total", async ({ page }) => {
  await asFactory(page);
  await page.goto("/opportunities");
  await page.getByRole("link", { name: /E2E organic tee/ }).click();
  await expect(page.getByRole("heading", { name: "Why you were matched" })).toBeVisible();
  await page.getByLabel("Making cost per unit (CMT)").fill("3.10");
  await page.getByLabel("Fabric cost per unit").fill("2.05");
  await page.getByLabel("Sampling charge (total)").fill("120");
  await page.getByLabel("Logistics estimate (total)").fill("350.50");
  await page.getByLabel("Minimum quantity").fill("300");
  await page.getByLabel("Production duration (days)").fill("40");
  // The live preview matches what the server will store.
  // (3.10 + 2.05) × 500 + 120 sampling + 350.50 logistics = 3,045.50
  await expect(page.getByRole("definition").filter({ hasText: "3,045.50" }).last()).toBeVisible();
  await page.getByRole("button", { name: "Send quotation" }).click();
  await expect(page.getByRole("heading", { name: "Revise quotation (currently v1)" })).toBeVisible();
});

test("the brand compares, requests a revision, then accepts and an order is created", async ({ page }) => {
  await asBrand(page);
  await page.goto(projectUrl);
  await expect(page.getByRole("table", { name: "Quotation comparison" })).toBeVisible();
  await page.getByRole("button", { name: "Request revision" }).click();
  await confirmDialog(page, "Send request", { "What should change?": "Please reduce the sampling charge to 60." });

  await asFactory(page);
  await page.goto("/opportunities");
  await page.getByRole("link", { name: /E2E organic tee/ }).click();
  await expect(page.getByText("Please reduce the sampling charge to 60.")).toBeVisible();
  await page.getByLabel("Sampling charge (total)").fill("60");
  await page.getByRole("button", { name: "Send revised quotation" }).click();
  await expect(page.getByRole("heading", { name: "Revise quotation (currently v2)" })).toBeVisible();

  await asBrand(page);
  await page.goto(projectUrl);
  await expect(page.getByText(/History \(1 earlier version\)/)).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await confirmDialog(page, "Accept and create order");
  await expect(page).toHaveURL(/\/orders\/.+created=1/);
  orderUrl = page.url().split("?")[0];
  await expect(page.locator('li[aria-current="step"]')).toContainText("Fabric sourcing");
  await expect(page.getByText("30%").first()).toBeVisible();
});

test("production runs through evidence, sampling and QC with stage gates enforced", async ({ page }) => {
  await asFactory(page);
  await page.goto(orderUrl);
  // Completion is disabled until evidence exists.
  await expect(page.getByRole("button", { name: /Mark fabric sourcing complete/i })).toBeDisabled();
  await completeEvidenceStage(page, "Fabric sourcing");

  // Sampling: the factory submits, the brand asks for changes, then approves round 2.
  await page.getByLabel("Sample round 1 description").fill("Size M sample in black, final fabric lot.");
  await page.locator("#sample-photos").setInputFiles(png("sample1.png"));
  await page.getByRole("button", { name: "Submit sample" }).click();
  await expect(page.getByText(/is with the brand for review/)).toBeVisible();

  await asBrand(page);
  await page.goto(orderUrl);
  await page.locator("label", { hasText: "Request revision" }).click();
  await page.getByLabel("Feedback for the factory").fill("Neck rib is too loose.");
  await page.getByRole("button", { name: "Send decision" }).click();
  await expect(page.locator("#sampling")).toContainText("Revision requested");

  await asFactory(page);
  await page.goto(orderUrl);
  await page.getByLabel("Sample round 2 description").fill("Round 2 with a tighter 2x2 rib.");
  await page.locator("#sample-photos").setInputFiles(png("sample2.png"));
  await page.getByRole("button", { name: "Submit sample" }).click();
  await expect(page.getByText(/is with the brand for review/)).toBeVisible();

  await asBrand(page);
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Send decision" }).click(); // "Approve" is preselected
  await expect(page.locator('li[aria-current="step"]')).toContainText("Cutting");
  await expect(page.locator("#payments")).toContainText("Due");

  await asFactory(page);
  await page.goto(orderUrl);
  for (const stage of ["Cutting", "Stitching", "Finishing"]) await completeEvidenceStage(page, stage);

  // QC: the sampling plan is enforced; a passing inspection waits for the brand.
  await expect(page.getByText(/Inspect at least 50 units/)).toBeVisible();
  await page.getByLabel("Units actually inspected").fill("50");
  await page.getByRole("button", { name: "Add defect line" }).click();
  await expect(page.getByText("Expected result: PASS")).toBeVisible();
  await page.getByRole("button", { name: "Record inspection" }).click();
  await expect(page.getByText("The passed inspection is waiting for the brand's decision.")).toBeVisible();

  await asBrand(page);
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Accept report" }).click();
  await confirmDialog(page, "Accept report");
  await expect(page.locator('li[aria-current="step"]')).toContainText("Logistics");
});

test("the brand pays a due milestone through the sandbox and the webhook marks it paid", async ({ page }) => {
  await asBrand(page);
  await page.goto(orderUrl);
  await page.locator("#payments").getByRole("button", { name: /^Pay / }).first().click();
  await expect(page).toHaveURL(/\/sandbox-checkout\//);
  await expect(page.getByText("Sandbox payment provider — no real money is charged")).toBeVisible();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page).toHaveURL(/payment=returned/);
  await expect(page.locator("#payments")).toContainText("Paid");
  await expect(page.locator("#payments")).toContainText("Charge succeeded");
});

test("the brand raises a dispute on the active order and an administrator resolves it", async ({ page }) => {
  await asBrand(page);
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Raise a dispute" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category").selectOption("DELIVERY");
  await dialog.getByLabel("Subject").fill("Shipment date unclear");
  await dialog.getByLabel("What happened?").fill("The factory has not confirmed when the goods will leave the warehouse.");
  await dialog.getByRole("button", { name: "Submit dispute" }).click();
  await expect(page).toHaveURL(/\/disputes\/.+created=1/);
  const disputeUrl = page.url().split("?")[0];

  await logout(page);
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/disputes");
  await page.getByRole("link", { name: "Shipment date unclear" }).click();
  await expect(page).toHaveURL(disputeUrl);
  // Resolving without a resolution is rejected.
  await page.getByLabel("Status").selectOption("RESOLVED");
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByText("Record the resolution before resolving or closing.")).toBeVisible();
  await page.getByLabel("Resolution").fill("Factory confirmed dispatch within 3 days.");
  await page.getByRole("button", { name: "Save update" }).click();
  await expect(page.getByRole("heading", { name: "Shipment date unclear" }).locator("..")).toContainText("Resolved");
  await page.goto("/admin/audit");
  await expect(page.getByText("DISPUTE_UPDATED").first()).toBeVisible();
});

test("shipment and delivery confirmation close the order", async ({ page }) => {
  await asFactory(page);
  await page.goto(orderUrl);
  await page.getByLabel("Carrier or forwarder").fill("DHL Express");
  await page.getByLabel("Tracking / B/L number").fill("JD0123456789");
  await page.getByRole("button", { name: "Record shipment" }).click();
  await expect(page.locator('li[aria-current="step"]')).toContainText("Delivery confirmation");

  await asBrand(page);
  await page.goto(orderUrl);
  await expect(page.getByText("DHL Express · JD0123456789")).toBeVisible();
  await page.getByRole("button", { name: "Confirm delivery" }).click();
  await confirmDialog(page, "Confirm delivery");
  await expect(page.getByText("Delivered").first()).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByText("Payment received").first()).toBeVisible();
});

test("the administrator sees the delivered order in monitoring", async ({ page }) => {
  await logout(page);
  await login(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.goto("/admin/orders?status=DELIVERED");
  await expect(page.getByRole("link", { name: "E2E organic tee" }).first()).toBeVisible();
  await page.goto("/admin/payments");
  await expect(page.getByText("payment.succeeded").first()).toBeVisible();
});
