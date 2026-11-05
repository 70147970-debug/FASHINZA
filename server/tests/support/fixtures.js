/**
 * Test fixtures (port of tests/support/fixtures.ts). They drive the real services, so every fixture goes
 * through the same rules as the app. Services are imported lazily so this module also loads while the
 * domain services are still being written.
 */
import { randomUUID } from "node:crypto";
import { User } from "../../src/models/User.js";
import { ManufacturerProfile } from "../../src/models/ManufacturerProfile.js";
import { idOf } from "../../src/lib/ids.js";

export { resetDb } from "./db.js";

const services = {
  accounts: () => import("../../src/services/accounts.js"),
  profiles: () => import("../../src/services/profiles.js"),
  admin: () => import("../../src/services/admin.js"),
  projects: () => import("../../src/services/projects.js"),
  quotations: () => import("../../src/services/quotations.js"),
};

let seq = 0;
export const PASSWORD = "Password123";

/** @typedef {{ id: string, role: "BRAND" | "MANUFACTURER" | "ADMIN", name: string, email: string, profileCompleted: boolean }} Actor */

/** @param {"BRAND" | "MANUFACTURER"} role @returns {Promise<Actor>} */
export async function makeUser(role, org = `${role} ${++seq}`) {
  const { registerAccount } = await services.accounts();
  const email = `${role.toLowerCase()}${++seq}-${randomUUID().slice(0, 6)}@example.test`;
  const id = idOf(await registerAccount({ role, name: `${role} user ${seq}`, organization: org, email, password: PASSWORD, confirmPassword: PASSWORD }));
  return { id, role, name: `${role} user ${seq}`, email, profileCompleted: false };
}

/** @returns {Promise<Actor>} */
export async function makeAdmin() {
  const email = `admin${++seq}@example.test`;
  const user = await User.create({ email, name: "Admin", role: "ADMIN", profileCompleted: true });
  return { id: user._id.toHexString(), role: "ADMIN", name: "Admin", email, profileCompleted: true };
}

/** @returns {Promise<Actor>} */
export async function makeBrand() {
  const { saveBrandProfile } = await services.profiles();
  const brand = await makeUser("BRAND");
  await saveBrandProfile(brand, { companyName: `Brand ${seq}`, country: "United Kingdom" });
  return { ...brand, profileCompleted: true };
}

/** Multer-like file object, same bytes as the original fixture. */
function upload(fieldname, originalname, mimetype, buffer) {
  return { fieldname, originalname, encoding: "7bit", mimetype, size: buffer.length, buffer };
}

export function pdfFile(name = "techpack.pdf") {
  return upload("file", name, "application/pdf", Buffer.from("%PDF-1.4\n% test document\n%%EOF\n"));
}

export function pngFile(name = "photo.png") {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return upload("file", name, "image/png", Buffer.concat([header, Buffer.from("test-image-bytes")]));
}

/**
 * @param {Actor} admin
 * @param {{ categories?: string[], moq?: number, capacity?: number, leadTime?: number, country?: string,
 *           certification?: string, verify?: boolean, machinery?: { type: string, quantity: number }[] }} [o]
 * @returns {Promise<Actor>}
 */
export async function makeFactory(admin, o = {}) {
  const { saveManufacturerProfile, addManufacturerDocument, requestVerification } = await services.profiles();
  const { reviewDocument, decideVerification } = await services.admin();
  const m = await makeUser("MANUFACTURER");
  const actor = { ...m, profileCompleted: true };
  await saveManufacturerProfile(m, {
    businessName: `Factory ${seq}`,
    description: "Vertically integrated knit and woven garment factory with in-house printing.",
    country: o.country ?? "Pakistan",
    city: "Lahore",
    categories: o.categories ?? ["T_SHIRTS"],
    production: ["Cut and sew", "Screen printing"],
    fabrics: ["Organic cotton", "Cotton"],
    finishing: ["Labelling"],
    minOrderQuantity: o.moq ?? 100,
    maxMonthlyCapacity: o.capacity ?? 10000,
    typicalLeadTimeDays: o.leadTime ?? 30,
    contactName: "Factory contact",
    contactEmail: m.email,
    machinery: o.machinery ?? [
      { type: "Single-needle lockstitch", quantity: 40 },
      { type: "Overlock 4-thread", quantity: 12 },
    ],
  });
  if (o.verify !== false) {
    const reg = await addManufacturerDocument(actor, pdfFile("registration.pdf"), "BUSINESS_REGISTRATION");
    if (o.certification) {
      const cert = await addManufacturerDocument(actor, pdfFile("cert.pdf"), "CERTIFICATION", o.certification);
      await reviewDocument(admin, idOf(cert), "VERIFIED");
    }
    await requestVerification(actor);
    await reviewDocument(admin, idOf(reg), "VERIFIED");
    const profile = await ManufacturerProfile.findOne({ userId: m.id }).orFail().lean();
    await decideVerification(admin, profile._id.toHexString(), "VERIFIED", "Documents checked.");
  }
  return actor;
}

export const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/** @param {Actor} brand @param {Record<string, unknown>} [overrides] */
export async function makeSubmittedProject(brand, overrides = {}) {
  const { saveProject, addAttachment, submitProject } = await services.projects();
  const id = idOf(
    await saveProject(
      brand,
      null,
      {
        name: "Organic tee",
        category: "T_SHIRTS",
        description: "Heavyweight organic cotton crew-neck tee with a front screen print.",
        fabricRequirements: "100% organic cotton jersey, 220 gsm",
        fabrics: ["Organic cotton"],
        colors: "Black, Off-white",
        sizes: ["S", "M", "L"],
        requiredCapabilities: ["Cut and sew"],
        quantity: 500,
        currency: "USD",
        deadline: inDays(90),
        requiredCertifications: [],
        ...overrides,
      },
      1,
    ),
  );
  await addAttachment(brand, id, pdfFile(), "TECH_PACK");
  const summary = await submitProject(brand, id);
  return { projectId: id, summary };
}

export const QUOTE = {
  quantity: 500,
  unitPrice: "3.10",
  fabricCostPerUnit: "2.05",
  finishingCostPerUnit: "0.40",
  packagingCostPerUnit: "0.15",
  samplingCost: "120",
  logisticsCost: "350.50",
  taxPercent: "0",
  minQuantity: 300,
  productionDays: 40,
  validUntil: inDays(30),
  notes: "FOB Karachi",
  sampleLeadTimeDays: 12,
  sampleNotes: "One fit sample in production fabric; one round of comments included.",
};

/** Brand + verified factory + accepted quotation → order at FABRIC_SOURCING. */
export async function makeOrder() {
  const { saveQuotation, acceptQuotation } = await services.quotations();
  const admin = await makeAdmin();
  const brand = await makeBrand();
  const factory = await makeFactory(admin);
  const { projectId } = await makeSubmittedProject(brand);
  const q = await saveQuotation(factory, projectId, QUOTE, true);
  const order = await acceptQuotation(brand, idOf(q));
  return { admin, brand, factory, projectId, quotationId: idOf(q), order };
}
