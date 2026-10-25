/**
 * Captures screenshots of the main screens for design review (and for the project report).
 *
 *   SCREENSHOT_URL=http://localhost:3200 SCREENSHOT_DB=postgresql://…/fashinza_design \
 *     npx tsx tests/support/ui-screenshots.ts [outDir] [filter]
 *
 * Signs in by creating short-lived sessions directly in the database, so no passwords are needed. It refuses
 * to run against a database whose name does not contain "design", "e2e" or "test". `filter` limits the run to
 * screens whose name contains that text (e.g. "brand-" or "admin").
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { Client } from "pg";

const BASE = process.env.SCREENSHOT_URL ?? "http://localhost:3200";
const DB = process.env.SCREENSHOT_DB ?? "";
const OUT = path.resolve(process.argv[2] ?? "screenshots");
const FILTER = process.argv[3] ?? "";

if (!/design|e2e|test/i.test(new URL(DB.replace(/^postgresql:/, "http:")).pathname)) {
  throw new Error("SCREENSHOT_DB must point at a disposable database whose name contains design, e2e or test.");
}

type Role = "BRAND" | "MANUFACTURER" | "ADMIN" | null;
type Screen = { name: string; role: Role; path: string; mobile?: boolean };

async function main() {
  const db = new Client({ connectionString: DB });
  await db.connect();
  const one = async (sql: string) => (await db.query(sql)).rows[0] ?? {};

  // Prefer the accounts that own an order, so order, QC and payment screens have data.
  const order = await one(`select id, "brandId", "manufacturerId", "projectId" from "order" order by "createdAt" desc limit 1`);
  const brandId = order.brandId ?? (await one(`select id from "user" where role='BRAND' and status='ACTIVE' limit 1`)).id;
  const factoryId = order.manufacturerId ?? (await one(`select id from "user" where role='MANUFACTURER' and status='ACTIVE' limit 1`)).id;
  const adminId = (await one(`select id from "user" where role='ADMIN' and status='ACTIVE' limit 1`)).id;
  const projectId = order.projectId ?? (await one(`select id from project where "brandId"='${brandId}' limit 1`)).id;
  const factoryProfile = (await one(`select id from manufacturer_profile order by "createdAt" desc limit 1`)).id;
  const draft = (await one(`select id from project where status='DRAFT' limit 1`)).id;

  const tokens: Record<string, string> = {};
  for (const [role, userId] of [["BRAND", brandId], ["MANUFACTURER", factoryId], ["ADMIN", adminId]] as const) {
    if (!userId) continue;
    const token = randomBytes(32).toString("hex");
    await db.query(
      `insert into session (id, "expiresAt", token, "updatedAt", "userId", "userAgent") values ($1, now() + interval '1 hour', $2, now(), $3, 'ui-screenshots')`,
      [randomUUID(), createHash("sha256").update(token).digest("hex"), userId],
    );
    tokens[role] = token;
  }

  const screens: Screen[] = [
    { name: "public-home", role: null, path: "/", mobile: true },
    { name: "public-how-it-works", role: null, path: "/how-it-works" },
    { name: "public-for-brands", role: null, path: "/for-brands" },
    { name: "public-for-manufacturers", role: null, path: "/for-manufacturers" },
    { name: "public-sustainability", role: null, path: "/sustainability" },
    { name: "public-about", role: null, path: "/about" },
    { name: "public-faq", role: null, path: "/faq" },
    { name: "public-contact", role: null, path: "/contact" },
    { name: "auth-login", role: null, path: "/login", mobile: true },
    { name: "auth-register", role: null, path: "/register" },
    { name: "auth-forgot-password", role: null, path: "/forgot-password" },
    { name: "brand-dashboard", role: "BRAND", path: "/dashboard", mobile: true },
    { name: "brand-projects", role: "BRAND", path: "/projects", mobile: true },
    { name: "brand-project-new", role: "BRAND", path: "/projects/new" },
    ...(draft ? [{ name: "brand-project-wizard", role: "BRAND" as const, path: `/projects/${draft}/edit?step=2` }] : []),
    { name: "brand-project-detail", role: "BRAND", path: `/projects/${projectId}` },
    { name: "brand-orders", role: "BRAND", path: "/orders" },
    ...(order.id ? [{ name: "brand-order-detail", role: "BRAND" as const, path: `/orders/${order.id}`, mobile: true }] : []),
    { name: "brand-payments", role: "BRAND", path: "/payments" },
    { name: "brand-disputes", role: "BRAND", path: "/disputes" },
    { name: "brand-notifications", role: "BRAND", path: "/notifications" },
    { name: "brand-profile", role: "BRAND", path: "/profile" },
    { name: "brand-settings", role: "BRAND", path: "/settings" },
    { name: "factory-dashboard", role: "MANUFACTURER", path: "/dashboard" },
    { name: "factory-opportunities", role: "MANUFACTURER", path: "/opportunities" },
    { name: "factory-opportunity-detail", role: "MANUFACTURER", path: `/opportunities/${projectId}` },
    { name: "factory-quotations", role: "MANUFACTURER", path: "/quotations" },
    { name: "factory-profile", role: "MANUFACTURER", path: "/factory", mobile: true },
    ...(order.id ? [{ name: "factory-order-detail", role: "MANUFACTURER" as const, path: `/orders/${order.id}` }] : []),
    { name: "admin-overview", role: "ADMIN", path: "/admin", mobile: true },
    { name: "admin-factories", role: "ADMIN", path: "/admin/factories?status=ALL" },
    { name: "admin-factory-detail", role: "ADMIN", path: `/admin/factories/${factoryProfile}` },
    { name: "admin-users", role: "ADMIN", path: "/admin/users" },
    { name: "admin-orders", role: "ADMIN", path: "/admin/orders" },
    { name: "admin-qc", role: "ADMIN", path: "/admin/qc" },
    { name: "admin-payments", role: "ADMIN", path: "/admin/payments" },
    { name: "admin-audit", role: "ADMIN", path: "/admin/audit" },
  ];

  mkdirSync(OUT, { recursive: true });
  const browser: Browser = await chromium.launch();
  const failures: string[] = [];
  for (const s of screens.filter((x) => x.name.includes(FILTER))) {
    for (const viewport of s.mobile ? ["desktop", "mobile"] : ["desktop"]) {
      const ctx = await browser.newContext(
        viewport === "mobile" ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
      );
      if (s.role && tokens[s.role]) await ctx.addCookies([{ name: "fz_session", value: tokens[s.role], url: BASE }]);
      const page = await ctx.newPage();
      try {
        const res = await page.goto(BASE + s.path, { waitUntil: "networkidle", timeout: 60_000 });
        const file = path.join(OUT, `${s.name}${viewport === "mobile" ? "-mobile" : ""}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        console.log(`${res?.status()} ${file}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ""}`);
      } catch (e) {
        failures.push(`${s.name} (${viewport}): ${(e as Error).message.split("\n")[0]}`);
      }
      await ctx.close();
    }
  }
  await browser.close();
  await db.query(`delete from session where "userAgent" = 'ui-screenshots'`);
  await db.end();
  if (failures.length) {
    console.error(`Failed:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
