import { db } from "@/lib/db";
import type { Actor } from "@/server/actor";
import type { Role } from "@/generated/prisma/enums";
import { registerAccount } from "@/server/services/accounts";
import { saveBrandProfile, saveManufacturerProfile, addManufacturerDocument, requestVerification, reviewDocument, decideVerification } from "@/server/services/profiles";
import { addAttachment, saveProject, submitProject } from "@/server/services/projects";
import { acceptQuotation, saveQuotation } from "@/server/services/quotations";
import { randomUUID } from "node:crypto";

const TABLES = [
  "webhook_event", "payment_transaction", "payment_milestone", "message", "rework_task", "qc_defect", "qc_report_photo", "qc_report",
  "sample_photo", "sample", "milestone_evidence", "production_milestone", "activity_log", "issue_report", "order", "quotation_revision",
  "quotation", "match_result", "project_revision", "project_attachment", "project", "manufacturer_document", "manufacturer_capability",
  "manufacturer_profile", "brand_profile", "notification", "audit_log", "contact_inquiry", "verification", "session", "account", "user",
];

export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

let seq = 0;
const PASSWORD = "Password123";

export async function makeUser(role: Exclude<Role, "ADMIN">, org = `${role} ${++seq}`): Promise<Actor> {
  const email = `${role.toLowerCase()}${++seq}-${randomUUID().slice(0, 6)}@example.test`;
  const id = await registerAccount({ role, name: `${role} user ${seq}`, organization: org, email, password: PASSWORD, confirmPassword: PASSWORD });
  return { id, role, name: `${role} user ${seq}`, email, profileCompleted: false };
}

export async function makeAdmin(): Promise<Actor> {
  const id = randomUUID();
  const email = `admin${++seq}@example.test`;
  await db.user.create({ data: { id, email, name: "Admin", role: "ADMIN", profileCompleted: true } });
  return { id, role: "ADMIN", name: "Admin", email, profileCompleted: true };
}

export async function makeBrand(): Promise<Actor> {
  const brand = await makeUser("BRAND");
  await saveBrandProfile(brand, { companyName: `Brand ${seq}`, country: "United Kingdom" });
  return { ...brand, profileCompleted: true };
}

export function pdfFile(name = "techpack.pdf") {
  return new File([Buffer.from("%PDF-1.4\n% test document\n%%EOF\n")], name, { type: "application/pdf" });
}

export function pngFile(name = "photo.png") {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([Buffer.concat([header, Buffer.from("test-image-bytes")])], name, { type: "image/png" });
}

type FactoryOptions = { categories?: string[]; moq?: number; capacity?: number; leadTime?: number; country?: string; certification?: string; verify?: boolean };

export async function makeFactory(admin: Actor, o: FactoryOptions = {}): Promise<Actor> {
  const m = await makeUser("MANUFACTURER");
  const actor = { ...m, profileCompleted: true };
  await saveManufacturerProfile(m, {
    businessName: `Factory ${seq}`,
    description: "Vertically integrated knit and woven garment factory with in-house printing.",
    country: o.country ?? "Pakistan",
    city: "Lahore",
    categories: (o.categories ?? ["T_SHIRTS"]) as never,
    production: ["Cut and sew", "Screen printing"],
    fabrics: ["Organic cotton", "Cotton"],
    finishing: ["Labelling"],
    minOrderQuantity: o.moq ?? 100,
    maxMonthlyCapacity: o.capacity ?? 10000,
    typicalLeadTimeDays: o.leadTime ?? 30,
    contactName: "Factory contact",
    contactEmail: m.email,
  });
  if (o.verify !== false) {
    const reg = await addManufacturerDocument(actor, pdfFile("registration.pdf"), "BUSINESS_REGISTRATION");
    if (o.certification) {
      const cert = await addManufacturerDocument(actor, pdfFile("cert.pdf"), "CERTIFICATION", o.certification);
      await reviewDocument(admin, cert.id, "VERIFIED");
    }
    await requestVerification(actor);
    await reviewDocument(admin, reg.id, "VERIFIED");
    const profile = await db.manufacturerProfile.findUniqueOrThrow({ where: { userId: m.id } });
    await decideVerification(admin, profile.id, "VERIFIED", "Documents checked.");
  }
  return actor;
}

export const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

export async function makeSubmittedProject(brand: Actor, overrides: Record<string, unknown> = {}) {
  const id = await saveProject(
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
};

/** Brand + verified factory + accepted quotation → order at FABRIC_SOURCING. */
export async function makeOrder() {
  const admin = await makeAdmin();
  const brand = await makeBrand();
  const factory = await makeFactory(admin);
  const { projectId } = await makeSubmittedProject(brand);
  const q = await saveQuotation(factory, projectId, QUOTE, true);
  const order = await acceptQuotation(brand, q.id);
  return { admin, brand, factory, projectId, quotationId: q.id, order };
}
