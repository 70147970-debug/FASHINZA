/**
 * Records the User Guide's video demo from the real MERN app: `npm run mern:record-guide` (build the client first
 * with `npm run mern:build`).
 *
 * It drops and re-seeds the disposable e2e database (name must contain "e2e"), starts the production server on
 * port 4400 against it, and walks through the main journey in ONE browser page so the recording is continuous:
 * a brand signs up and briefs a garment, the matched demo factory quotes, the brand accepts, and the order runs
 * through sampling, production, inspection, a sandbox payment and delivery. The steps are the ones the e2e suite
 * verifies (tests-mern/e2e/workflow.spec.js), slowed down and captioned for people.
 *
 * Writes to public/videos/:
 *   user-guide-demo.webm         the recording (1280×720)
 *   user-guide-demo-poster.jpg   a still of the homepage hero
 *   user-guide-demo.vtt          the captions, timed to the recording
 *   user-guide-demo.json         the chapter list shown beside the video
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { ACCOUNTS, E2E_ENV } from "../e2e/env.js";
import { chip, confirmDialog, inDays, login, logout, pdf, png } from "../e2e/helpers.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "public", "videos");
const NAME = "user-guide-demo";
const PORT = 4400;
const BASE = `http://localhost:${PORT}`;
const SIZE = { width: 1280, height: 720 };

// The e2e database is dropped and re-seeded before every recording, so a fixed address never collides.
const brand = { name: "Maya Clarke", org: "Juniper Studio", email: "maya@juniper-studio.test", password: "DemoBrandPassword1" };

/** The site's own photographs stand in for the factory's evidence and sample photos, so the uploads look real. */
const photo = (file) => path.join(ROOT, "public", "images", file);
const STAGE_PHOTOS = {
  "Fabric sourcing": "fabric-rolls.jpg",
  Cutting: "fabric-cutting.jpg",
  Stitching: "factory-sewing-lines.jpg",
  Finishing: "finished-garments.jpg",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------------------
// Server

function prepareDatabase() {
  execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(ROOT, "tests-mern/e2e/prepare.js")], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

async function startServer() {
  const server = spawn(process.execPath, [path.join(ROOT, "server/src/index.js")], {
    cwd: ROOT,
    env: { ...process.env, ...E2E_ENV, PORT: String(PORT), APP_URL: BASE, SERVER_URL: BASE },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return server;
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  server.kill();
  throw new Error(`The MERN server did not become healthy on ${BASE}.`);
}

// ---------------------------------------------------------------------------------------------------------------
// On-screen captions and a visible cursor (the recording has no system cursor). Captions live in sessionStorage so
// they survive full page loads; the overlay sits on <html>, outside the React root.

function overlay() {
  const css = `
    #__demo_caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;
      max-width:min(980px,86vw);padding:14px 22px;border-radius:12px;background:rgba(22,22,22,.9);color:#F8F6F1;
      font:500 19px/1.45 "Inter Variable",Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);text-align:center}
    #__demo_caption small{display:block;margin-bottom:4px;color:#B7A895;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
    #__demo_cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:22px;height:22px;margin:-11px 0 0 -11px;
      border-radius:50%;border:2px solid #fff;background:rgba(83,107,85,.55);box-shadow:0 0 0 1px rgba(0,0,0,.35);transition:transform .12s}
    #__demo_cursor.down{transform:scale(.7);background:rgba(83,107,85,.9)}`;
  const render = () => {
    if (!document.body) return;
    if (!document.getElementById("__demo_style")) {
      const style = document.createElement("style");
      style.id = "__demo_style";
      style.textContent = css;
      document.documentElement.appendChild(style);
    }
    let bar = document.getElementById("__demo_caption");
    const data = JSON.parse(sessionStorage.getItem("__demo_caption") || "null");
    if (!data) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "__demo_caption";
      document.documentElement.appendChild(bar);
    }
    bar.innerHTML = "";
    if (data.label) {
      const small = document.createElement("small");
      small.textContent = data.label;
      bar.appendChild(small);
    }
    bar.appendChild(document.createTextNode(data.text));
  };
  window.__setCaption = (label, text) => {
    sessionStorage.setItem("__demo_caption", JSON.stringify(text ? { label, text } : null));
    render();
  };
  const cursor = () => {
    let c = document.getElementById("__demo_cursor");
    if (!c && document.body) {
      c = document.createElement("div");
      c.id = "__demo_cursor";
      document.documentElement.appendChild(c);
    }
    return c;
  };
  addEventListener("mousemove", (e) => {
    const c = cursor();
    if (c) c.style.translate = `${e.clientX}px ${e.clientY}px`;
  });
  addEventListener("mousedown", () => cursor()?.classList.add("down"));
  addEventListener("mouseup", () => cursor()?.classList.remove("down"));
  document.addEventListener("DOMContentLoaded", render);
  new MutationObserver(() => {
    if (!document.getElementById("__demo_caption") && sessionStorage.getItem("__demo_caption") !== "null") render();
  }).observe(document, { childList: true, subtree: false });
}

// ---------------------------------------------------------------------------------------------------------------
// Recording

const cues = [];
const chapters = [];
let t0 = 0;
let chapterLabel = "";

const now = () => (Date.now() - t0) / 1000;

async function chapter(page, title) {
  chapterLabel = `${chapters.length + 1} · ${title}`;
  chapters.push({ title, start: Math.max(0, Math.floor(now())) });
}

/** Shows a caption, records it as a subtitle cue and holds it long enough to read. */
async function say(page, text, holdMs = 2600) {
  const start = now();
  if (cues.length) cues[cues.length - 1].end = start;
  cues.push({ start, end: start + holdMs / 1000, text, label: chapterLabel });
  await page.evaluate(([label, t]) => window.__setCaption?.(label, t), [chapterLabel, text]);
  await sleep(holdMs);
}

/** Types like a person (visible on the recording), replacing any value the field already has. */
async function type(locator, text) {
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(text, { delay: 28 });
}

async function smoothScroll(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await sleep(900);
}

const nextStep = (page) => page.locator("#next-step");

async function completeStage(page, stage, narrate) {
  const current = page.locator('li[aria-current="step"]');
  await expect(current).toContainText(stage);
  const card = nextStep(page);
  await card.scrollIntoViewIfNeeded();
  if (narrate) await say(page, narrate, 2400);
  await card.locator('input[type="file"]').setInputFiles(STAGE_PHOTOS[stage] ? photo(STAGE_PHOTOS[stage]) : png(`${stage}.png`));
  await card.getByRole("button", { name: "Add evidence" }).click();
  await expect(card.getByRole("link", { name: `Evidence for ${stage}` })).toBeVisible();
  await sleep(500);
  await card.getByRole("button", { name: new RegExp(`Mark ${stage} complete`, "i") }).click();
  await confirmDialog(page, "Complete stage");
  await expect(page.locator('li[aria-current="step"]')).not.toContainText(stage);
  await sleep(700);
}

async function switchTo(page, who, account) {
  await page.evaluate(() => window.__setCaption?.("", ""));
  await logout(page);
  await login(page, account.email, account.password);
  await sleep(600);
  void who;
}

async function walkthrough(page) {
  // 1 — Welcome
  await chapter(page, "Welcome");
  await page.goto("/");
  await page.waitForLoadState("load");
  await sleep(800);
  // The poster: the homepage hero before any caption or cursor appears.
  await page.screenshot({ path: path.join(OUT_DIR, `${NAME}-poster.jpg`), type: "jpeg", quality: 82 });
  await say(page, "Fashinza connects fashion brands with verified garment factories. Here is the whole process, start to finish.", 3600);
  await smoothScroll(page, 700);
  await say(page, "Brands and manufacturers each have their own way in. We'll start as a fashion brand.", 2800);
  await smoothScroll(page, 0);

  // 2 — Brand signs up
  await chapter(page, "A brand signs up");
  await page.locator("section", { has: page.locator("#hero-title") }).getByRole("link", { name: "Start Your Manufacturing Project" }).click();
  await expect(page).toHaveURL(/\/register\?role=brand$/);
  await say(page, "Registration is free. The brand enters its name, company and work email.", 2200);
  await type(page.getByLabel("Full name"), brand.name);
  await type(page.getByLabel("Brand or company name"), brand.org);
  await type(page.getByLabel("Work email"), brand.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(brand.password);
  await page.getByLabel("Confirm password").fill(brand.password);
  await sleep(500);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await say(page, "A short company profile comes next.", 1800);
  await type(page.getByLabel("Country"), "United Kingdom");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard\?welcome=1/);
  await say(page, "The dashboard shows what to do next: create a production project.", 2600);

  // 3 — Brief
  await chapter(page, "Brief the garment");
  await page.getByRole("link", { name: "Create production project" }).first().click();
  await say(page, "The project wizard collects everything a factory needs, one step at a time. Drafts are saved at every step.", 3000);
  await type(page.getByLabel("Project name"), "Organic cotton crew-neck tee");
  await page.getByLabel("Product category").selectOption("T_SHIRTS");
  await type(page.getByLabel("Product description"), "Heavyweight organic cotton tee with a front screen print.");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=2/);
  await say(page, "Specifications: fabric, colours, sizes and the processes the garment needs.", 2200);
  await type(page.getByLabel("Fabric type and composition"), "100% organic cotton jersey, 220 gsm");
  await chip(page, "Fabrics the factory must handle", "Organic cotton");
  await type(page.getByLabel("Colours"), "Black, Off-white");
  for (const s of ["S", "M", "L"]) await chip(page, "Sizes", s);
  await chip(page, "Manufacturing requirements", "Screen printing");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=3/);
  await say(page, "Quantity, target price and delivery date.", 1800);
  await type(page.getByLabel("Estimated quantity (units)"), "500");
  await type(page.getByLabel("Target price per unit"), "6.50");
  await page.getByLabel("Desired delivery date").fill(inDays(90));
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=4/);
  await say(page, "Certifications can be made mandatory. Here the brand requires GOTS.", 2200);
  await chip(page, "Required certifications", "GOTS");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=5/);
  await say(page, "Samples are requested by default. The brand asks for a size M fit sample.", 2200);
  await chip(page, "Sample sizes", "M");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/step=6/);
  await say(page, "The tech pack is required. Measurement charts and reference images can be added too.", 2400);
  await page.locator('input[type="file"]').setInputFiles(pdf("tee-tech-pack.pdf"));
  await expect(page.getByText("tee-tech-pack.pdf").first()).toBeVisible();
  await page.getByLabel("File type").selectOption("MEASUREMENT_CHART");
  await page.locator('input[type="file"]').setInputFiles(pdf("tee-measurement-chart.pdf"));
  await expect(page.getByText("tee-measurement-chart.pdf").first()).toBeVisible();
  await sleep(800);
  await page.getByRole("link", { name: "Continue to review" }).click();
  await expect(page).toHaveURL(/step=7/);
  await say(page, "A final check, then the brief is submitted for matching.", 2200);
  await page.getByRole("button", { name: "Submit project for matching" }).click();
  await expect(page).toHaveURL(/submitted=1/);
  await expect(page.getByText(/verified factor(y|ies) (was|were) invited to quote/)).toBeVisible();
  await say(page, "Matching follows published rules. Only verified factories that fit the order are invited, and the reasons are shown.", 3600);
  await smoothScroll(page, 500);
  await sleep(1200);

  // 4 — Factory quotes
  await chapter(page, "The factory sends a quotation");
  await switchTo(page, "factory", ACCOUNTS.knitFactory);
  await say(page, "Now we're the matched factory. The new project appears under Opportunities.", 2600);
  await page.goto("/opportunities");
  await sleep(700);
  await page.getByRole("link", { name: /Organic cotton crew-neck tee/ }).click();
  const sections = page.getByRole("navigation", { name: "Opportunity sections" });
  await sections.getByRole("link", { name: "Why you were matched" }).click();
  await expect(page.getByRole("heading", { name: "Why you were matched" })).toBeVisible();
  await say(page, "The factory can see exactly why it was matched.", 2400);
  await sections.getByRole("link", { name: "Your quotation" }).click();
  await expect(page.getByRole("heading", { name: "Send your quotation" })).toBeVisible();
  await say(page, "The quotation is itemised. Fashinza calculates the total on the server.", 2400);
  await type(page.getByLabel("Making cost per unit (CMT)"), "3.10");
  await type(page.getByLabel("Fabric cost per unit"), "2.05");
  await type(page.getByLabel("Sampling charge (total)"), "120");
  await type(page.getByLabel("Logistics estimate (total)"), "350.50");
  await type(page.getByLabel("Minimum quantity"), "300");
  await type(page.getByLabel("Production duration (days)"), "40");
  await type(page.getByLabel("Sample lead time (days)"), "14");
  await sleep(800);
  await page.getByRole("button", { name: "Send quotation" }).click();
  await expect(page.getByRole("heading", { name: /Waiting for the brand to decide/ })).toBeVisible();
  await say(page, "The quotation is sent. The brand is notified.", 2200);

  // 5 — Brand accepts
  await chapter(page, "The brand accepts a quotation");
  await switchTo(page, "brand", brand);
  await page.goto("/projects");
  await sleep(600);
  await page.getByRole("link", { name: /Organic cotton crew-neck tee/ }).first().click();
  await expect(page.getByRole("table", { name: "Quotation comparison" })).toBeVisible();
  await page.getByRole("table", { name: "Quotation comparison" }).scrollIntoViewIfNeeded();
  await say(page, "Quotations are compared side by side: price, minimum order, production time and sampling.", 3200);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await sleep(600);
  await confirmDialog(page, "Accept and create order");
  await expect(page).toHaveURL(/\/orders\/.+created=1/);
  const orderUrl = page.url().split("?")[0];
  await say(page, "Accepting creates the order. Production follows eight milestones, from fabric sourcing to delivery.", 3400);

  // 6 — Fabric and sampling
  await chapter(page, "Fabric sourcing and sampling");
  await switchTo(page, "factory", ACCOUNTS.knitFactory);
  await page.goto(orderUrl);
  await sleep(600);
  await completeStage(page, "Fabric sourcing", "Each stage is completed with evidence, such as a fabric invoice or swatch photo.");
  await page.getByLabel("Sample round 1 description").scrollIntoViewIfNeeded();
  await say(page, "Then the factory submits a sample with photos.", 2000);
  await type(page.getByLabel("Sample round 1 description"), "Size M sample in black, final fabric lot.");
  await page.locator("#sample-photos").setInputFiles(photo("designers-sample-fitting.jpg"));
  await page.getByRole("button", { name: "Submit sample" }).click();
  await expect(page.getByText(/is with the brand for review/)).toBeVisible();
  await sleep(1000);

  // 7 — Sample approval
  await chapter(page, "The brand approves the sample");
  await switchTo(page, "brand", brand);
  await page.goto(orderUrl);
  await nextStep(page).scrollIntoViewIfNeeded();
  await say(page, "The brand reviews the sample. It can ask for changes, or approve it.", 2800);
  await page.getByRole("button", { name: "Send decision" }).click(); // "Approve" is preselected
  await expect(page.locator('li[aria-current="step"]')).toContainText("Cutting");
  await say(page, "Approval starts bulk production, and the first milestone payment falls due.", 3000);

  // 8 — Production and inspection
  await chapter(page, "Production and quality inspection");
  await switchTo(page, "factory", ACCOUNTS.knitFactory);
  await page.goto(orderUrl);
  await sleep(600);
  await completeStage(page, "Cutting", "Cutting, stitching and finishing are each completed with photos. Both sides see the same progress.");
  await completeStage(page, "Stitching");
  await completeStage(page, "Finishing");
  await page.getByLabel("Units actually inspected").scrollIntoViewIfNeeded();
  await say(page, "Quality inspection follows ISO 2859-1 AQL sampling. The plan says how many garments to inspect.", 3200);
  await type(page.getByLabel("Units actually inspected"), "50");
  await page.getByRole("button", { name: "Add defect line" }).click();
  await expect(page.getByText("Expected result: PASS")).toBeVisible();
  await sleep(800);
  await page.getByRole("button", { name: "Record inspection" }).click();
  await expect(page.getByText("The passed inspection is waiting for the brand's decision.")).toBeVisible();
  await say(page, "A passed inspection waits for the brand. A failed one would send the batch back for rework.", 3000);

  // 9 — Acceptance and payment
  await chapter(page, "Inspection approval and payment");
  await switchTo(page, "brand", brand);
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Accept report" }).scrollIntoViewIfNeeded();
  await say(page, "The brand accepts the inspection report.", 2000);
  await page.getByRole("button", { name: "Accept report" }).click();
  await confirmDialog(page, "Accept report");
  await expect(page.locator('li[aria-current="step"]')).toContainText("Logistics");
  await page.goto(orderUrl);
  await nextStep(page).scrollIntoViewIfNeeded();
  await say(page, "Payments fall due as milestones are approved. This demo uses the sandbox, so no real money moves.", 3200);
  await nextStep(page).getByRole("button", { name: /^Pay / }).first().click();
  await expect(page).toHaveURL(/\/sandbox-checkout\//);
  await sleep(1200);
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page).toHaveURL(/tab=payments/);
  await expect(page.locator("#payments li").filter({ hasText: "Sample approval" }).getByText("Paid", { exact: true })).toBeVisible();
  await say(page, "The payment provider confirms the charge, and the milestone is marked paid.", 2800);

  // 10 — Shipping and delivery
  await chapter(page, "Shipping and delivery");
  await switchTo(page, "factory", ACCOUNTS.knitFactory);
  await page.goto(orderUrl);
  await page.getByLabel("Carrier or forwarder").scrollIntoViewIfNeeded();
  await say(page, "The factory records the carrier and tracking number when the goods ship.", 2400);
  await type(page.getByLabel("Carrier or forwarder"), "DHL Express");
  await type(page.getByLabel("Tracking / B/L number"), "JD0123456789");
  await page.getByRole("button", { name: "Record shipment" }).click();
  await expect(page.locator('li[aria-current="step"]')).toContainText("Delivery confirmation");
  await sleep(800);
  await switchTo(page, "brand", brand);
  await page.goto(orderUrl);
  await nextStep(page).scrollIntoViewIfNeeded();
  await say(page, "The brand confirms the goods arrived, which completes the order.", 2400);
  await nextStep(page).getByRole("button", { name: "Confirm delivery" }).click();
  await confirmDialog(page, "Confirm delivery");
  await expect(page.getByText("Delivered").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await say(page, "Delivered. Every step, file and decision stays in the order's history.", 3200);
  await say(page, "Ready to start? Register free as a fashion brand or as a manufacturer.", 3400);
}

function vtt() {
  const ts = (s) => {
    const ms = Math.round(s * 1000);
    const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
    const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0");
    const sec = String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0");
    return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, "0")}`;
  };
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n")}`;
}

/**
 * Playwright records VP8 at a high bitrate (~30 MB for this walkthrough). Re-encode it to VP9 with the ffmpeg
 * Playwright installs (or a system ffmpeg) for a ~5 MB file; without either, the raw recording is kept.
 */
function compress(input, output) {
  const cache = path.join(os.homedir(), ".cache", "ms-playwright");
  const bundled = fs.existsSync(cache)
    ? fs
        .readdirSync(cache)
        .filter((d) => d.startsWith("ffmpeg-"))
        .map((d) => path.join(cache, d, process.platform === "darwin" ? "ffmpeg-mac" : "ffmpeg-linux"))
        .find((f) => fs.existsSync(f))
    : undefined;
  for (const ffmpeg of [bundled, "ffmpeg"].filter(Boolean)) {
    try {
      execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-c:v", "libvpx-vp9", "-crf", "38", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-an", output], {
        stdio: "inherit",
      });
      return;
    } catch {
      // try the next encoder
    }
  }
  console.warn("No ffmpeg with VP9 found; keeping the uncompressed recording.");
  fs.copyFileSync(input, output);
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, "client/dist/index.html"))) throw new Error("Build the client first: npm run mern:build");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  prepareDatabase();
  const server = await startServer();
  const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), "fashinza-guide-video-"));
  const browser = await chromium.launch({ slowMo: 90 });
  try {
    const context = await browser.newContext({
      baseURL: BASE,
      viewport: SIZE,
      deviceScaleFactor: 1,
      colorScheme: "light",
      recordVideo: { dir: videoDir, size: SIZE },
    });
    context.setDefaultTimeout(20_000);
    await context.addInitScript(overlay);
    const page = await context.newPage();
    t0 = Date.now();
    try {
      await walkthrough(page);
    } catch (e) {
      const shot = path.join(os.tmpdir(), "fashinza-guide-failure.png");
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.error(`Recording failed at ${page.url()} (screenshot: ${shot})`);
      throw e;
    }
    const video = page.video();
    await context.close();
    const end = now();
    const raw = path.join(videoDir, "raw.webm");
    await video.saveAs(raw);
    compress(raw, path.join(OUT_DIR, `${NAME}.webm`));
    if (cues.length) cues[cues.length - 1].end = Math.min(cues[cues.length - 1].end, end);
    fs.writeFileSync(path.join(OUT_DIR, `${NAME}.vtt`), vtt());
    fs.writeFileSync(path.join(OUT_DIR, `${NAME}.json`), `${JSON.stringify({ duration: Math.round(end), chapters }, null, 2)}\n`);
    console.log(`Recorded ${Math.round(end)} s, ${chapters.length} chapters, ${cues.length} captions → public/videos/${NAME}.*`);
  } finally {
    await browser.close();
    server.kill();
    fs.rmSync(videoDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
