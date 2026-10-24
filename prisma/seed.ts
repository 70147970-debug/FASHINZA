/**
 * Seed script (run with `npm run db:seed`).
 *
 * Always: creates or updates the administrator account from ADMIN_EMAIL / ADMIN_PASSWORD.
 *         Administrators cannot self-register, so this is the only way to create the first one.
 * With SEED_DEMO=1: adds clearly labelled demo organisations — one brand and three verified
 *         factories — created through the real services, so they behave exactly like real data.
 *         Demo accounts use the password in SEED_DEMO_PASSWORD. Nothing is invented beyond
 *         these "(Demo)" records: no orders, payments or reviews are fabricated.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/server/auth/password";
import { registerAccount } from "../src/server/services/accounts";
import { addManufacturerDocument, decideVerification, requestVerification, reviewDocument, saveBrandProfile, saveManufacturerProfile } from "../src/server/services/profiles";
import type { Actor } from "../src/server/actor";
import type { GarmentCategory } from "../src/generated/prisma/enums";

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set in .env to run the seed.`);
  return v;
}

async function seedAdmin(): Promise<Actor> {
  const email = required("ADMIN_EMAIL").toLowerCase();
  const password = required("ADMIN_PASSWORD");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  const hash = await hashPassword(password);
  const existing = await db.user.findUnique({ where: { email } });
  const id = existing?.id ?? randomUUID();
  if (!existing) {
    await db.user.create({ data: { id, email, name: process.env.ADMIN_NAME ?? "Platform Administrator", role: "ADMIN", profileCompleted: true, emailVerified: true } });
    await db.account.create({ data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: hash } });
    console.log(`Created administrator ${email}`);
  } else {
    if (existing.role !== "ADMIN") throw new Error(`${email} exists but is not an administrator; refusing to change its role.`);
    await db.account.updateMany({ where: { userId: id, providerId: "credential" }, data: { password: hash } });
    console.log(`Administrator ${email} already exists; password updated from ADMIN_PASSWORD.`);
  }
  return { id, role: "ADMIN", name: "Platform Administrator", email, profileCompleted: true };
}

function demoPdf(name: string) {
  return new File([Buffer.from(`%PDF-1.4\n% Fashinza demo document: ${name}\n%%EOF\n`)], name, { type: "application/pdf" });
}

const FACTORIES: {
  email: string; name: string; city: string; country: string; categories: GarmentCategory[]; production: string[]; fabrics: string[]; finishing: string[];
  moq: number; capacity: number; lead: number; certs: string[];
}[] = [
  { email: "demo-factory-knits@fashinza.test", name: "Demo Knitwear Mills (Demo)", city: "Lahore", country: "Pakistan", categories: ["T_SHIRTS", "HOODIES_SWEATSHIRTS", "ACTIVEWEAR"], production: ["Cut and sew", "Knitting", "Screen printing", "Embroidery", "Sampling"], fabrics: ["Cotton", "Organic cotton", "Jersey knit", "Fleece"], finishing: ["Garment dyeing", "Labelling", "Custom packaging"], moq: 200, capacity: 20000, lead: 35, certs: ["GOTS", "OEKO-TEX Standard 100"] },
  { email: "demo-factory-denim@fashinza.test", name: "Demo Denim Works (Demo)", city: "Karachi", country: "Pakistan", categories: ["DENIM", "TROUSERS", "OUTERWEAR"], production: ["Cut and sew", "Woven garments", "Pattern making", "Sampling"], fabrics: ["Denim", "Cotton"], finishing: ["Enzyme washing", "Stone washing", "Pressing and folding"], moq: 300, capacity: 15000, lead: 45, certs: ["WRAP"] },
  { email: "demo-factory-wovens@fashinza.test", name: "Demo Woven Studio (Demo)", city: "Dhaka", country: "Bangladesh", categories: ["SHIRTS", "DRESSES", "SLEEPWEAR", "KIDSWEAR"], production: ["Cut and sew", "Woven garments", "Pattern making", "Digital printing", "Sampling"], fabrics: ["Cotton", "Linen", "Silk", "Recycled polyester"], finishing: ["Labelling", "Pressing and folding", "Custom packaging"], moq: 100, capacity: 8000, lead: 30, certs: ["BCI"] },
];

async function demoUser(email: string, role: "BRAND" | "MANUFACTURER", name: string, org: string, password: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return null;
  const id = await registerAccount({ role, name, organization: org, email, password, confirmPassword: password });
  return { id, role, name, email, profileCompleted: true } as Actor;
}

async function seedDemo(admin: Actor) {
  const password = required("SEED_DEMO_PASSWORD");
  const brand = await demoUser("demo-brand@fashinza.test", "BRAND", "Demo Brand Manager", "Northline Apparel (Demo)", password);
  if (brand) {
    await saveBrandProfile(brand, { companyName: "Northline Apparel (Demo)", country: "United Kingdom", city: "Manchester", description: "Demo brand account for trying the Fashinza workflow." });
    console.log("Created demo brand demo-brand@fashinza.test");
  }
  for (const f of FACTORIES) {
    const actor = await demoUser(f.email, "MANUFACTURER", "Demo Factory Manager", f.name, password);
    if (!actor) continue;
    await saveManufacturerProfile(actor, {
      businessName: f.name, description: "Demo factory profile used to try matching, quotations and production tracking. Not a real business.",
      country: f.country, city: f.city, categories: f.categories, production: f.production, fabrics: f.fabrics, finishing: f.finishing,
      minOrderQuantity: f.moq, maxMonthlyCapacity: f.capacity, typicalLeadTimeDays: f.lead, contactName: "Demo Factory Manager", contactEmail: f.email,
    });
    const reg = await addManufacturerDocument(actor, demoPdf("demo-business-registration.pdf"), "BUSINESS_REGISTRATION");
    for (const c of f.certs) {
      const cert = await addManufacturerDocument(actor, demoPdf(`demo-${c}.pdf`), "CERTIFICATION", c);
      await reviewDocument(admin, cert.id, "VERIFIED", "Demo document accepted by the seed script.");
    }
    await requestVerification(actor);
    await reviewDocument(admin, reg.id, "VERIFIED", "Demo document accepted by the seed script.");
    const profile = await db.manufacturerProfile.findUniqueOrThrow({ where: { userId: actor.id } });
    await decideVerification(admin, profile.id, "VERIFIED", "Demo factory verified by the seed script.");
    console.log(`Created verified demo factory ${f.email}`);
  }
}

async function main() {
  const admin = await seedAdmin();
  if (process.env.SEED_DEMO === "1") await seedDemo(admin);
  else console.log("Set SEED_DEMO=1 to also create demo organisations.");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
