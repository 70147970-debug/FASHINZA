/**
 * Seed script (port of prisma/seed.ts). Run with `npm run mern:seed` from the repository root (or
 * `npm run seed` in server/). Reads the root .env, then server/.env (see src/config.js).
 *
 * Always: creates or updates the administrator account from ADMIN_EMAIL / ADMIN_PASSWORD.
 *         Administrators cannot self-register, so this is the only way to create the first one.
 * With SEED_DEMO=1: adds a clearly labelled demo workspace. Every organisation is named "(Demo)" and
 *         every file is a generated placeholder named "demo-…". Records are created through the real
 *         services (projects, matching, quotations, orders, sampling, QC, sandbox payments), so they pass
 *         the same validation and permission checks as real data:
 *           - four verified demo factories with capabilities and machinery;
 *           - three demo brands with projects in different states: a draft, a brief waiting for quotes,
 *             a brief with two quotations (with sample proposals), an order mid-production (fabric
 *             sourced, sample approved, cutting in progress) and a delivered order with a QC report.
 *         Payments on the delivered order go through the sandbox provider (no money moves). No
 *         certifications beyond the demo factories' own demo documents, and no reviews or testimonials.
 *         Demo accounts use the password in SEED_DEMO_PASSWORD.
 *
 * Idempotent: accounts are matched by email and projects by brand + name, so running it again does not
 * duplicate anything. Demo profiles are re-saved each run so they stay in step with this file.
 *
 * Differences from the original that come from the stack only: ids are MongoDB ObjectIds, uploaded files are
 * passed to the services as multer-style objects ({ originalname, mimetype, size, buffer }) instead of File,
 * and the collections and their indexes are created before anything is written.
 */
import { pathToFileURL } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import mongoose from "mongoose";
import { inspectionPlan } from "@fashinza/shared/aql.js";
import { quotationSchema } from "@fashinza/shared/validation/quotation.js";
import { qcReportSchema } from "@fashinza/shared/validation/operations.js";
import { config } from "../src/config.js";
import { connectDb, disconnectDb, ensureCollections, withTransaction } from "../src/db.js";
import { hashPassword } from "../src/auth/password.js";
import { toObjectId } from "../src/lib/ids.js";
import { money } from "../src/lib/serialize.js";
import { Account, ManufacturerProfile, PaymentMilestone, PaymentTransaction, Project, User } from "../src/models/index.js";
import { buildSandboxEvent } from "../src/payments/provider.js";
import { registerAccount } from "../src/services/accounts.js";
import { decideVerification, reviewDocument } from "../src/services/admin.js";
import { addEvidence, completeEvidenceStage, confirmDelivery, postMessage, recordShipment } from "../src/services/orders.js";
import { processPaymentWebhook, startPayment } from "../src/services/payments.js";
import { addManufacturerDocument, requestVerification, saveBrandProfile, saveManufacturerProfile } from "../src/services/profiles.js";
import { addAttachment, saveProject, submitProject } from "../src/services/projects.js";
import { decideQcReport, reviewSample, submitQcReport, submitSample } from "../src/services/quality.js";
import { acceptQuotation, requestRevision, saveQuotation } from "../src/services/quotations.js";

/** @typedef {{ id: string, role: "BRAND" | "MANUFACTURER" | "ADMIN", name: string, email: string, profileCompleted: boolean }} Actor */

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set in .env to run the seed.`);
  return v;
}

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY);

/** @returns {Promise<Actor>} */
async function seedAdmin() {
  const email = required("ADMIN_EMAIL").toLowerCase();
  const password = required("ADMIN_PASSWORD");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  const hash = await hashPassword(password);
  const existing = await User.findOne({ email }).lean();
  const userId = existing?._id ?? new mongoose.Types.ObjectId();
  const id = userId.toHexString();
  if (!existing) {
    await withTransaction(async (session) => {
      await User.create(
        [{ _id: userId, email, name: process.env.ADMIN_NAME ?? "Platform Administrator", role: "ADMIN", profileCompleted: true, emailVerified: true }],
        { session },
      );
      await Account.create([{ accountId: id, providerId: "credential", userId, password: hash }], { session });
    });
    console.log(`Created administrator ${email}`);
  } else {
    if (existing.role !== "ADMIN") throw new Error(`${email} exists but is not an administrator; refusing to change its role.`);
    await Account.updateMany({ userId, providerId: "credential" }, { $set: { password: hash } });
    console.log(`Administrator ${email} already exists; password updated from ADMIN_PASSWORD.`);
  }
  return { id, role: "ADMIN", name: "Platform Administrator", email, profileCompleted: true };
}

// ───────────────────────────── Placeholder files ─────────────────────────────

/** The upload object the services expect (what multer produces for a form upload). */
function upload(originalname, mimetype, buffer) {
  return { fieldname: "file", originalname, encoding: "7bit", mimetype, size: buffer.length, buffer };
}

/** Keeps PDF text to plain ASCII and escapes the characters PDF strings treat specially. */
const pdfText = (s) => s.replace(/[^\x20-\x7e]/g, "-").replace(/([\\()])/g, "\\$1");

/**
 * A small but valid one-page PDF that says what it is: a placeholder for a demo record. It opens in
 * any PDF viewer, so the download links in the demo workspace work.
 */
function demoPdf(fileName, title = fileName, lines = []) {
  const body = [
    "DEMO PLACEHOLDER - generated by the Fashinza seed script",
    "",
    ...lines,
    "",
    "This file stands in for a real document so the demo workspace can be explored.",
    "It is not a real tech pack, invoice or certificate.",
  ];
  const text = ["BT /F1 18 Tf 56 780 Td (" + pdfText(title) + ") Tj ET", ...body.map((l, i) => `BT /F1 11 Tf 56 ${748 - i * 16} Td (${pdfText(l)}) Tj ET`)].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(text, "latin1")} >>\nstream\n${text}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return upload(fileName, "application/pdf", Buffer.from(out, "latin1"));
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

/**
 * A valid PNG "swatch" in the garment colour with a faint diagonal weave, used for demo reference
 * images, sample photos and production evidence. Clearly a placeholder, not a photo of real goods.
 */
function demoPng(fileName, hex, width = 320, height = 240) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const shade = (x + y) % 12 < 2 ? 0.88 : 1;
      row[1 + x * 3] = Math.round(r * shade);
      row[2 + x * 3] = Math.round(g * shade);
      row[3 + x * 3] = Math.round(b * shade);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return upload(fileName, "image/png", png);
}

// ───────────────────────────── Demo organisations ─────────────────────────────

const NOT_REAL = "This is a demo profile for exploring Fashinza. It is not a real business.";

/** Certifications are limited to the demo documents these factories have always had; the new factory has none. */
const FACTORIES = [
  {
    key: "knits", email: "demo-factory-knits@fashinza.test", name: "Demo Knitwear Mills (Demo)", city: "Lahore", country: "Pakistan",
    description: `Knit garment unit for jersey T-shirts, fleece hoodies and activewear, with in-house screen printing and embroidery. ${NOT_REAL}`,
    categories: ["T_SHIRTS", "HOODIES_SWEATSHIRTS", "ACTIVEWEAR"], production: ["Cut and sew", "Knitting", "Screen printing", "Embroidery", "Sampling"],
    fabrics: ["Cotton", "Organic cotton", "Jersey knit", "Fleece", "Recycled polyester"], finishing: ["Garment dyeing", "Labelling", "Custom packaging"],
    moq: 200, capacity: 20000, lead: 35, certs: ["GOTS", "OEKO-TEX Standard 100"],
    machinery: [
      { type: "Circular knitting machine", quantity: 12 }, { type: "Single-needle lockstitch", quantity: 60 }, { type: "Overlock 4-thread", quantity: 28 },
      { type: "Flatlock / coverstitch", quantity: 18 }, { type: "Cutting table / straight knife", quantity: 4 }, { type: "Screen printing carousel", quantity: 3 },
      { type: "Embroidery machine", quantity: 2 }, { type: "Steam press", quantity: 6 }, { type: "Needle detector", quantity: 1 },
    ],
  },
  {
    key: "denim", email: "demo-factory-denim@fashinza.test", name: "Demo Denim Works (Demo)", city: "Karachi", country: "Pakistan",
    description: `Woven bottoms and jackets in denim and twill, with an in-house laundry for rinse, enzyme and stone washes. ${NOT_REAL}`,
    categories: ["DENIM", "TROUSERS", "OUTERWEAR"], production: ["Cut and sew", "Woven garments", "Pattern making", "Sampling"],
    fabrics: ["Denim", "Cotton"], finishing: ["Enzyme washing", "Stone washing", "Pressing and folding"],
    moq: 300, capacity: 15000, lead: 45, certs: ["WRAP"],
    machinery: [
      { type: "Single-needle lockstitch", quantity: 80 }, { type: "Double-needle lockstitch", quantity: 24 }, { type: "Feed-off-the-arm", quantity: 10 },
      { type: "Overlock 5-thread", quantity: 16 }, { type: "Bartack", quantity: 8 }, { type: "Buttonhole", quantity: 4 }, { type: "Snap / rivet press", quantity: 6 },
      { type: "Band knife", quantity: 2 }, { type: "Fabric spreading machine", quantity: 2 }, { type: "Needle detector", quantity: 2 },
    ],
  },
  {
    key: "wovens", email: "demo-factory-wovens@fashinza.test", name: "Demo Woven Studio (Demo)", city: "Dhaka", country: "Bangladesh",
    description: `Small-batch woven shirts, dresses and sleepwear in cotton, linen and silk, with a pattern room for fit development. ${NOT_REAL}`,
    categories: ["SHIRTS", "DRESSES", "SLEEPWEAR", "KIDSWEAR"], production: ["Cut and sew", "Woven garments", "Pattern making", "Digital printing", "Sampling"],
    fabrics: ["Cotton", "Linen", "Silk", "Recycled polyester"], finishing: ["Labelling", "Pressing and folding", "Custom packaging"],
    moq: 100, capacity: 8000, lead: 30, certs: ["BCI"],
    machinery: [
      { type: "Single-needle lockstitch", quantity: 45 }, { type: "Overlock 3-thread", quantity: 10 }, { type: "Buttonhole", quantity: 3 },
      { type: "Button attach", quantity: 3 }, { type: "Fusing press", quantity: 2 }, { type: "Cutting table / straight knife", quantity: 3 }, { type: "Steam press", quantity: 5 },
    ],
  },
  {
    key: "activewear", email: "demo-factory-activewear@fashinza.test", name: "Demo Sportswear Works (Demo)", city: "Sialkot", country: "Pakistan",
    description: `Performance knit specialist for leggings, sports bras and training tops, with flatlock seaming and sublimation printing. ${NOT_REAL}`,
    categories: ["ACTIVEWEAR", "HOODIES_SWEATSHIRTS"], production: ["Cut and sew", "Pattern making", "Sublimation", "Digital printing", "Sampling"],
    fabrics: ["Polyester", "Recycled polyester", "Jersey knit"], finishing: ["Labelling", "Custom packaging", "Pressing and folding"],
    moq: 300, capacity: 12000, lead: 40, certs: [],
    machinery: [
      { type: "Flatlock / coverstitch", quantity: 30 }, { type: "Overlock 4-thread", quantity: 22 }, { type: "Single-needle lockstitch", quantity: 20 },
      { type: "Heat transfer press", quantity: 6 }, { type: "Cutting table / straight knife", quantity: 3 }, { type: "Thread trimming machine", quantity: 2 },
    ],
  },
];

const BRANDS = {
  northline: {
    email: "demo-brand@fashinza.test", person: "Demo Brand Manager", org: "Northline Apparel (Demo)", country: "United Kingdom", city: "Manchester",
    description: `Menswear and everyday essentials label: jersey basics, denim and outerwear. ${NOT_REAL}`,
  },
  maren: {
    email: "demo-brand-womenswear@fashinza.test", person: "Demo Womenswear Buyer", org: "Maren Studio (Demo)", country: "United Kingdom", city: "London",
    description: `Womenswear label working in linen, silk and other natural fibres, in small seasonal drops. ${NOT_REAL}`,
  },
  stride: {
    email: "demo-brand-activewear@fashinza.test", person: "Demo Activewear Founder", org: "Stride Lab Activewear (Demo)", country: "Netherlands", city: "Amsterdam",
    description: `Early-stage activewear startup preparing its first run of running leggings and training tops. ${NOT_REAL}`,
  },
};

/**
 * Finds a demo account by email or registers it. Returns the actor and whether it was just created.
 * @param {"BRAND" | "MANUFACTURER"} role
 * @returns {Promise<{ actor: Actor, created: boolean }>}
 */
async function demoUser(email, role, name, org, password) {
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    if (existing.role !== role) throw new Error(`${email} exists with role ${existing.role}; expected ${role}.`);
    return { actor: { id: existing._id.toHexString(), role, name: existing.name, email, profileCompleted: true }, created: false };
  }
  const id = await registerAccount({ role, name, organization: org, email, password, confirmPassword: password });
  return { actor: { id, role, name, email, profileCompleted: true }, created: true };
}

async function seedFactory(admin, f, password) {
  const { actor, created } = await demoUser(f.email, "MANUFACTURER", "Demo Factory Manager", f.name, password);
  // Re-saved on every run (an upsert), so factories seeded by older versions gain their machinery list.
  await saveManufacturerProfile(actor, {
    businessName: f.name, description: f.description, country: f.country, city: f.city, categories: f.categories, production: f.production,
    fabrics: f.fabrics, finishing: f.finishing, minOrderQuantity: f.moq, maxMonthlyCapacity: f.capacity, typicalLeadTimeDays: f.lead,
    contactName: "Demo Factory Manager", contactEmail: f.email, machinery: f.machinery,
  });
  if (!created) return actor;
  const reg = await addManufacturerDocument(actor, demoPdf("demo-business-registration.pdf", "Business registration (demo)", [`Organisation: ${f.name}`]), "BUSINESS_REGISTRATION");
  for (const c of f.certs) {
    const cert = await addManufacturerDocument(actor, demoPdf(`demo-${c.replace(/[^\w-]+/g, "-")}.pdf`, `${c} certificate (demo)`, [`Organisation: ${f.name}`]), "CERTIFICATION", c);
    await reviewDocument(admin, cert.id, "VERIFIED", "Demo document accepted by the seed script.");
  }
  await requestVerification(actor);
  await reviewDocument(admin, reg.id, "VERIFIED", "Demo document accepted by the seed script.");
  const profile = await ManufacturerProfile.findOne({ userId: toObjectId(actor.id) }).orFail().lean();
  await decideVerification(admin, profile._id.toHexString(), "VERIFIED", "Demo factory verified by the seed script.");
  console.log(`Created verified demo factory ${f.email}`);
  return actor;
}

async function seedBrand(b, password) {
  const { actor, created } = await demoUser(b.email, "BRAND", b.person, b.org, password);
  await saveBrandProfile(actor, { companyName: b.org, country: b.country, city: b.city, description: b.description });
  if (created) console.log(`Created demo brand ${b.email}`);
  return actor;
}

// ───────────────────────────── Demo projects ─────────────────────────────

/** Projects are keyed by brand + name; an existing one is left exactly as it is. */
async function alreadySeeded(brand, name) {
  const found = await Project.exists({ brandId: toObjectId(brand.id), name });
  if (found) console.log(`Demo project “${name}” already exists; skipped.`);
  return !!found;
}

/** Saves the brief one wizard step at a time, exactly as the wizard does, then uploads its files. */
async function createBrief(brand, steps, files) {
  const id = await saveProject(brand, null, steps[0], 1);
  for (let i = 1; i < steps.length; i++) await saveProject(brand, id, steps[i], i + 1);
  for (const f of files) await addAttachment(brand, id, f.file, f.kind, f.notes);
  return id;
}

function techPackFiles(slug, title, colour, extra = []) {
  return [
    { file: demoPdf(`demo-tech-pack-${slug}.pdf`, `Tech pack v1 - ${title} (demo)`, ["Contents: flat sketches, construction, trims, labels, packing.", ...extra]), kind: "TECH_PACK", notes: "First issue for quoting" },
    { file: demoPdf(`demo-measurement-chart-${slug}.pdf`, `Measurement chart - ${title} (demo)`, ["Points of measure per size with +/- tolerances (placeholder)."]), kind: "MEASUREMENT_CHART" },
    { file: demoPng(`demo-reference-${slug}.png`, colour), kind: "REFERENCE_IMAGE", notes: "Colour and mood reference (placeholder swatch)" },
  ];
}

function quote(input) {
  return quotationSchema.parse({ taxPercent: "0", validUntil: inDays(30), ...input });
}

/** Draft: basics and specifications saved, quantity and budget still to do. */
async function seedDraftLinenShirts(maren) {
  const name = "Linen resort shirts — SS27";
  if (await alreadySeeded(maren, name)) return;
  await createBrief(
    maren,
    [
      { name, category: "SHIRTS", description: "Relaxed women's resort shirt with a camp collar, dropped shoulder and straight hem with side vents. Garment-washed for a soft, lived-in hand." },
      {
        fabricRequirements: "100% linen plain weave, 150–160 gsm, garment washed", fabrics: ["Linen"], colors: "Sand, Ecru, Olive",
        sizes: ["XS", "S", "M", "L", "XL"], requiredCapabilities: ["Woven garments", "Pattern making"],
        additionalInstructions: "Natural shell-effect buttons, self-fabric facing, French seams on the side seams.",
      },
    ],
    [{ file: demoPng("demo-reference-linen-shirt.png", "#C9B99A"), kind: "REFERENCE_IMAGE", notes: "Sand colourway reference (placeholder swatch)" }],
  );
  console.log(`Created demo draft “${name}”`);
}

/** Submitted brief, matched to the woven factory, waiting for its first quotation. */
async function seedSlipDressBrief(maren) {
  const name = "Bias-cut satin slip dresses — AW27";
  if (await alreadySeeded(maren, name)) return;
  const id = await createBrief(
    maren,
    [
      { name, category: "DRESSES", description: "Midi-length slip dress cut on the bias, with adjustable rouleau straps, a cowl neckline and a narrow rolled hem." },
      {
        fabricRequirements: "Silk-feel satin, 90–100 gsm, fluid drape", fabrics: ["Silk"], colors: "Champagne, Midnight navy",
        sizes: ["XS", "S", "M", "L"], requiredCapabilities: ["Woven garments", "Pattern making", "Sampling"],
        additionalInstructions: "Bias cutting must be single-ply. Rolled hem 3 mm. Straps adjustable by 6 cm.",
      },
      { quantity: 300, maxMoq: 200, targetUnitPrice: "18.50", currency: "GBP", deadline: inDays(120), preferredCountry: "" },
      { requiredCertifications: [], sustainabilityNotes: "Deadstock or certified fabric welcome; tell us what you can source." },
      { sampleRequired: true, sampleQuantity: 2, sampleSizes: ["S", "M"], sampleNotes: "One sample per colourway, fitted on a size S." },
    ],
    techPackFiles("slip-dress", "Bias-cut slip dress", "#D9C7A6"),
  );
  await submitProject(maren, id);
  console.log(`Created demo brief “${name}” (waiting for quotations)`);
}

/** Submitted brief with two quotations, one already revised at the brand's request. */
async function seedLeggingsQuotes(stride, factories) {
  const name = "Recycled-poly running leggings";
  if (await alreadySeeded(stride, name)) return;
  const id = await createBrief(
    stride,
    [
      { name, category: "ACTIVEWEAR", description: "High-rise 7/8 running leggings with a wide waistband, a back zip pocket and two side drop-in pockets. Squat-proof, four-way stretch." },
      {
        fabricRequirements: "Recycled polyester / elastane interlock (approx. 78/22), 260 gsm, brushed back", fabrics: ["Recycled polyester", "Jersey knit"],
        colors: "Black, Deep teal", sizes: ["XS", "S", "M", "L", "XL"], requiredCapabilities: ["Cut and sew", "Sampling"],
        additionalInstructions: "Flatlock seams throughout, bonded waistband, reflective heat-transfer logo on the left calf.",
      },
      { quantity: 800, maxMoq: 500, targetUnitPrice: "11.50", currency: "EUR", deadline: inDays(110), preferredCountry: "" },
      { requiredCertifications: [], sustainabilityNotes: "We would like recycled content in the main fabric. Share what documentation the mill provides." },
      { sampleRequired: true, sampleQuantity: 3, sampleSizes: ["S", "M", "L"], sampleNotes: "Fit samples in black for a wear test before bulk." },
    ],
    techPackFiles("leggings", "Running leggings", "#1F4E4F", ["Seams: flatlock 4-needle 6-thread."]),
  );
  await submitProject(stride, id);

  await saveQuotation(factories.knits, id, quote({
    quantity: 800, unitPrice: "3.60", fabricCostPerUnit: "4.80", finishingCostPerUnit: "0.30", packagingCostPerUnit: "0.25", samplingCost: "110", logisticsCost: "520",
    minQuantity: 400, productionDays: 50, notes: "FOB Lahore. Price includes the heat-transfer logo and individual recycled polybags.",
    sampleLeadTimeDays: 12, sampleNotes: "Three fit samples (S, M, L) in black production fabric; one round of comments included.",
  }), true);

  const v1 = await saveQuotation(factories.activewear, id, quote({
    quantity: 800, unitPrice: "3.90", fabricCostPerUnit: "5.20", finishingCostPerUnit: "0.35", packagingCostPerUnit: "0.25", samplingCost: "180", logisticsCost: "450",
    minQuantity: 300, productionDays: 45, notes: "FOB Sialkot. Bonded waistband made in-house.",
    sampleLeadTimeDays: 10, sampleNotes: "Three fit samples (S, M, L) in black.",
  }), true);
  await requestRevision(stride, v1.id, "Could you review the sampling charge, and confirm the samples will have flatlock seams on every panel?");
  await saveQuotation(factories.activewear, id, quote({
    quantity: 800, unitPrice: "3.90", fabricCostPerUnit: "5.20", finishingCostPerUnit: "0.35", packagingCostPerUnit: "0.25", samplingCost: "120", logisticsCost: "450",
    minQuantity: 300, productionDays: 45, notes: "FOB Sialkot. Bonded waistband made in-house. Sampling charge reduced as requested.",
    sampleLeadTimeDays: 10, sampleNotes: "Three fit samples (S, M, L) in black with flatlock seams on all panels, matching bulk construction.",
  }), true);
  console.log(`Created demo brief “${name}” with two quotations`);
}

/** Accepts a single quotation from the given factory and returns the new order's id. */
async function orderFrom(brand, factory, projectId, input) {
  const q = await saveQuotation(factory, projectId, quote(input), true);
  const order = await acceptQuotation(brand, q.id);
  return order.id;
}

/** @param {"FABRIC_SOURCING" | "CUTTING" | "STITCHING" | "FINISHING"} stage */
async function evidence(factory, orderId, stage, files, note, complete) {
  for (const f of files) await addEvidence(factory, orderId, stage, f, note);
  if (complete) await completeEvidenceStage(factory, orderId, stage);
}

/** Order mid-production: fabric sourced, sample approved in round 2, cutting under way with evidence. */
async function seedTeesInProduction(northline, knits) {
  const name = "Organic cotton crew-neck tees — SS27";
  if (await alreadySeeded(northline, name)) return;
  const id = await createBrief(
    northline,
    [
      { name, category: "T_SHIRTS", description: "Heavyweight boxy crew-neck tee with a 2x1 rib neckband, dropped shoulder and a small chest embroidery. Core essential for the SS27 range." },
      {
        fabricRequirements: "100% organic cotton single jersey, 220 gsm, garment dyed", fabrics: ["Organic cotton", "Jersey knit"],
        colors: "Washed black, Ecru, Sage", sizes: ["XS", "S", "M", "L", "XL", "XXL"], requiredCapabilities: ["Cut and sew", "Embroidery"],
        additionalInstructions: "Tonal chest embroidery 6 cm wide. Woven neck label and care label. Shrinkage under 5% after garment dye.",
      },
      { quantity: 1200, maxMoq: 500, targetUnitPrice: "6.80", currency: "USD", deadline: inDays(120), preferredCountry: "Pakistan" },
      { requiredCertifications: ["GOTS"], sustainabilityNotes: "Organic cotton must be traceable; please share the fabric's GOTS documentation with the fabric receipt." },
      { sampleRequired: true, sampleQuantity: 2, sampleSizes: ["M", "L"], sampleNotes: "Washed black only, with the chest embroidery." },
    ],
    techPackFiles("crew-neck-tee", "Organic crew-neck tee", "#2B2B2B", ["Neck rib: 2x1, 2.2 cm finished."]),
  );
  await submitProject(northline, id);
  const orderId = await orderFrom(northline, knits, id, {
    quantity: 1200, unitPrice: "2.40", fabricCostPerUnit: "2.90", finishingCostPerUnit: "0.35", packagingCostPerUnit: "0.20", samplingCost: "90", logisticsCost: "420",
    minQuantity: 500, productionDays: 55, notes: "FOB Lahore. Includes garment dye, chest embroidery, woven labels and polybags.",
    sampleLeadTimeDays: 10, sampleNotes: "Two pieces (M, L) in washed black production fabric with embroidery; one round of fit comments included.",
  });

  await evidence(knits, orderId, "FABRIC_SOURCING", [
    demoPdf("demo-fabric-receipt-organic-jersey.pdf", "Fabric receipt (demo)", ["Organic cotton single jersey, 220 gsm", "Received for 1,200 units plus 3% cutting allowance"]),
    demoPng("demo-fabric-swatch-washed-black.png", "#2B2B2B"),
  ], "Fabric lot received and shade-checked against the approved swatch.", true);

  const r1 = await submitSample(knits, orderId, { description: "Round 1: size M and L in washed black, production fabric, chest embroidery applied." }, [demoPng("demo-sample-round-1-tee.png", "#333333")]);
  await reviewSample(northline, r1.id, "REVISION_REQUESTED", "The neck rib stands away from the body after washing. Please tighten the rib and shorten the body by 1 cm on size L.");
  const r2 = await submitSample(knits, orderId, { description: "Round 2: tighter 2x1 neck rib, size L body shortened by 1 cm.", revisionNotes: "Neck rib ratio adjusted; pattern updated for size L." }, [demoPng("demo-sample-round-2-tee.png", "#303030")]);
  await reviewSample(northline, r2.id, "APPROVED");

  await evidence(knits, orderId, "CUTTING", [demoPng("demo-cut-panels-tee.png", "#3A3A3A")], "Washed black and ecru lays cut; sage lay is next.", false);
  await postMessage(knits, orderId, "Cutting has started with the washed black and ecru lays. Sage fabric is relaxing on the table and will be cut tomorrow.");
  await postMessage(northline, orderId, "Thanks. Please send a photo of the first stitched pieces with the new neck rib when the line starts.");
  console.log(`Created demo order “${name}” (cutting in progress)`);
}

/** Pays the order's due milestones through the sandbox provider and its signed webhook, as the checkout page does. */
async function paySandboxMilestones(brand, orderId) {
  if (!process.env.PAYMENT_SANDBOX_SECRET || process.env.PAYMENT_SANDBOX_SECRET.length < 32) {
    console.log("PAYMENT_SANDBOX_SECRET is not set; demo payments were left due.");
    return;
  }
  const due = await PaymentMilestone.find({ orderId: toObjectId(orderId), status: "DUE" }).sort({ sequence: 1 }).lean();
  for (const pm of due) {
    await startPayment(brand, pm._id.toHexString());
    const txn = await PaymentTransaction.findOne({ paymentMilestoneId: pm._id, type: "CHARGE", status: "PENDING" }).orFail().lean();
    const { body, signature } = buildSandboxEvent("payment.succeeded", { providerRef: txn.providerRef, amount: money(txn.amount, 2), currency: txn.currency });
    await processPaymentWebhook("sandbox", body, signature);
  }
}

/** Delivered order: every stage completed with evidence, a passing AQL inspection accepted, sandbox payments made. */
async function seedDenimDelivered(northline, denim) {
  const name = "Selvedge denim trucker jacket";
  if (await alreadySeeded(northline, name)) return;
  const id = await createBrief(
    northline,
    [
      { name, category: "OUTERWEAR", description: "Classic four-pocket trucker jacket in rigid selvedge denim, with pleated front panels, shank buttons and a corduroy-lined collar." },
      {
        fabricRequirements: "100% cotton selvedge denim, 13.5 oz, indigo, rigid", fabrics: ["Denim"], colors: "Rinse indigo",
        sizes: ["S", "M", "L", "XL"], requiredCapabilities: ["Woven garments", "Pattern making"],
        additionalInstructions: "Felled seams, bartacks at pocket corners, rinse wash only. Shank buttons in antique brass.",
      },
      { quantity: 400, maxMoq: 400, targetUnitPrice: "24.00", currency: "USD", deadline: inDays(100), preferredCountry: "" },
      { requiredCertifications: [], sustainabilityNotes: "" },
      { sampleRequired: true, sampleQuantity: 1, sampleSizes: ["M"], sampleNotes: "One size M sample after rinse wash." },
    ],
    techPackFiles("trucker-jacket", "Selvedge trucker jacket", "#22345A", ["Wash: rinse only, target shrinkage 3%."]),
  );
  await submitProject(northline, id);
  const orderId = await orderFrom(northline, denim, id, {
    quantity: 400, unitPrice: "7.80", fabricCostPerUnit: "9.60", finishingCostPerUnit: "2.10", packagingCostPerUnit: "0.40", samplingCost: "150", logisticsCost: "680",
    minQuantity: 300, productionDays: 60, notes: "FOB Karachi. Includes rinse wash, shank buttons, rivets and hang tags.",
    sampleLeadTimeDays: 14, sampleNotes: "One size M jacket in production denim after rinse wash, with final trims.",
  });

  await evidence(denim, orderId, "FABRIC_SOURCING", [demoPdf("demo-fabric-receipt-selvedge-denim.pdf", "Fabric receipt (demo)", ["Selvedge denim 13.5 oz, rinse indigo", "Quantity for 400 jackets plus shrinkage allowance"])], "Denim received; shrinkage test 3% after rinse.", true);
  const s1 = await submitSample(denim, orderId, { description: "Size M jacket in production denim after rinse wash, antique brass shank buttons." }, [demoPng("demo-sample-round-1-jacket.png", "#22345A")]);
  await reviewSample(northline, s1.id, "APPROVED");
  await evidence(denim, orderId, "CUTTING", [demoPng("demo-cut-panels-jacket.png", "#283C64")], "All panels cut and bundled by size.", true);
  await evidence(denim, orderId, "STITCHING", [demoPng("demo-stitching-line-jacket.png", "#2A3F68")], "Line running; felled seams checked every hour.", true);
  await evidence(denim, orderId, "FINISHING", [demoPng("demo-finished-jackets.png", "#1E2F52")], "Rinse washed, pressed, tagged and packed.", true);

  const plan = inspectionPlan(400, 2.5, 4.0);
  const report = await submitQcReport(denim, orderId, qcReportSchema.parse({
    inspectionDate: new Date(), batchSize: 400, sampleSize: plan.sampleSize, aqlMajor: 2.5, aqlMinor: 4.0,
    defects: [{ category: "Stitching", severity: "MINOR", count: 2 }, { category: "Stains / soiling", severity: "MINOR", count: 1 }],
    correctiveActions: "Loose threads trimmed and the marked piece spot-cleaned before packing.",
    notes: "Final random inspection of packed cartons. Measurements within tolerance on all inspected units.",
  }), [demoPng("demo-qc-inspection-jacket.png", "#22345A")]);
  await decideQcReport(northline, report.id, "ACCEPTED", "Report reviewed; minor defects corrected before packing.");
  await recordShipment(denim, orderId, "Demo Freight Forwarder (Demo)", "DEMO-BL-000417");
  await confirmDelivery(northline, orderId, "All 400 jackets received in good condition.");
  await paySandboxMilestones(northline, orderId);
  console.log(`Created demo order “${name}” (delivered, QC report accepted)`);
}

async function seedDemo(admin) {
  const password = required("SEED_DEMO_PASSWORD");
  const factories = {};
  for (const f of FACTORIES) factories[f.key] = await seedFactory(admin, f, password);
  const northline = await seedBrand(BRANDS.northline, password);
  const maren = await seedBrand(BRANDS.maren, password);
  const stride = await seedBrand(BRANDS.stride, password);

  await seedDraftLinenShirts(maren);
  await seedSlipDressBrief(maren);
  await seedLeggingsQuotes(stride, factories);
  await seedTeesInProduction(northline, factories.knits);
  await seedDenimDelivered(northline, factories.denim);
}

async function main() {
  await connectDb(config.mongodbUri);
  await ensureCollections();
  const admin = await seedAdmin();
  if (process.env.SEED_DEMO === "1") await seedDemo(admin);
  else console.log("Set SEED_DEMO=1 to also create demo organisations.");
}

// Exported for the unit test that checks the demo data without a database (tests/unit/seed.test.js).
export { BRANDS, FACTORIES, demoPdf, demoPng, quote };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => disconnectDb())
    .catch(async (e) => {
      console.error(e);
      await disconnectDb().catch(() => {});
      process.exit(1);
    });
}
