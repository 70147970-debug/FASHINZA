/**
 * The seed script's demo data, checked without a database: the generated placeholder files pass the real
 * upload checks (type, size, content sniffing) and the demo organisations and quotations pass the same
 * validation the forms use. Running the seed itself needs MongoDB (npm run mern:seed).
 */
import { describe, expect, it } from "vitest";
import { brandProfileSchema, manufacturerProfileSchema } from "@fashinza/shared/validation/profile.js";
import { CERTIFICATIONS } from "@fashinza/shared/constants.js";
import { GarmentCategory } from "@fashinza/shared/enums.js";
import { DEFAULT_WEIGHTS, matchFactories } from "@fashinza/shared/matching.js";
import { sniff, validateUpload } from "../../src/lib/storage.js";
import { BRANDS, FACTORIES, demoPdf, demoPng, quote } from "../../scripts/seed.js";

describe("seed placeholder files", () => {
  it("are genuine PDFs and PNGs that the upload checks accept", () => {
    const pdf = demoPdf("demo-tech-pack-test.pdf", "Tech pack (demo)", ["Line with (parentheses) and ünïcode"]);
    const png = demoPng("demo-reference-test.png", "#1F4E4F");
    for (const [file, type] of [
      [pdf, "application/pdf"],
      [png, "image/png"],
    ]) {
      expect(() => validateUpload(file)).not.toThrow();
      expect(sniff(file.buffer)).toBe(type);
      expect(file.mimetype).toBe(type);
      expect(file.size).toBe(file.buffer.length);
    }
    expect(() => validateUpload(png, { imagesOnly: true })).not.toThrow();
    expect(pdf.buffer.toString("latin1")).toMatch(/%%EOF\n$/);
  });
});

const NOT_REAL_SENTENCE = "This is a demo profile for exploring Fashinza. It is not a real business.";

describe("seed demo organisations", () => {
  it("has fourteen factories whose profiles pass the factory profile form validation", () => {
    expect(FACTORIES.map((f) => f.key)).toEqual([
      "knits", "denim", "wovens", "activewear", "uniforms", "composite", "ethnic", "intimates", "shirts", "coats", "jersey", "sweaters", "bottoms", "bags",
    ]);
    for (const f of FACTORIES) {
      const parsed = manufacturerProfileSchema.safeParse({
        businessName: f.name, description: f.description, country: f.country, city: f.city, categories: f.categories, production: f.production,
        fabrics: f.fabrics, finishing: f.finishing, minOrderQuantity: f.moq, maxMonthlyCapacity: f.capacity, typicalLeadTimeDays: f.lead,
        contactName: "Demo Factory Manager", contactEmail: f.email, machinery: f.machinery,
      });
      expect(parsed.success, f.key).toBe(true);
      expect(f.name).toContain("(Demo)");
    }
  });

  it("labels every factory as a demo, gives it a demo address and only lists known certificates", () => {
    const keys = new Set();
    for (const f of FACTORIES) {
      expect(f.email, f.key).toBe(`demo-factory-${f.key}@fashinza.test`);
      expect(f.description, f.key).toContain(NOT_REAL_SENTENCE);
      expect(keys.has(f.key), f.key).toBe(false);
      keys.add(f.key);
      for (const c of f.certs) expect(CERTIFICATIONS, `${f.key}: ${c}`).toContain(c);
      expect(f.machinery.length, f.key).toBeGreaterThan(0);
    }
    expect(new Set(FACTORIES.map((f) => f.country))).toEqual(
      new Set(["Pakistan", "Bangladesh", "India", "Sri Lanka", "Vietnam", "China", "Turkey", "Portugal", "Morocco", "Indonesia"]),
    );
  });

  it("covers every garment category with at least one factory", () => {
    const made = new Set(FACTORIES.flatMap((f) => f.categories));
    expect(GarmentCategory.filter((c) => !made.has(c))).toEqual([]);
  });

  it("has three brands whose profiles pass the brand profile form validation", () => {
    for (const b of Object.values(BRANDS)) {
      expect(brandProfileSchema.safeParse({ companyName: b.org, country: b.country, city: b.city, description: b.description }).success, b.org).toBe(true);
      expect(b.org).toContain("(Demo)");
    }
  });

  it("builds quotations through the real quotation schema", () => {
    const q = quote({
      quantity: 400, unitPrice: "7.80", fabricCostPerUnit: "9.60", finishingCostPerUnit: "2.10", packagingCostPerUnit: "0.40", samplingCost: "150", logisticsCost: "680",
      minQuantity: 300, productionDays: 60, notes: "FOB Karachi.", sampleLeadTimeDays: 14, sampleNotes: "One size M jacket.",
    });
    expect(q.quantity).toBe(400);
    expect(q.validUntil).toBeInstanceOf(Date);
  });
});

/**
 * The demo factories run through the real rules-v1 engine (as verified, active factories with their demo
 * certificates and no committed orders). The briefs are the seed's demo projects and the e2e workflow's brief, so
 * a change to the factory list that changes these numbers also needs tests-mern/e2e/workflow.spec.js updated.
 */
describe("seed demo factories in matching", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const inDays = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const candidates = FACTORIES.map((f) => ({
    manufacturerId: f.key, name: f.name, verified: true, active: true, country: f.country, categories: f.categories, minOrderQuantity: f.moq,
    maxMonthlyCapacity: f.capacity, committedMonthlyUnits: 0, typicalLeadTimeDays: f.lead, capabilities: [...f.production, ...f.finishing], fabrics: f.fabrics,
    verifiedCertifications: f.certs, history: { qcReports: 0, qcPassed: 0, deliveredOrders: 0, onTimeDeliveries: 0 },
  }));
  const eligible = (brief) =>
    matchFactories({ maxMoq: null, preferredCountry: null, fabrics: [], requiredCapabilities: [], requiredCertifications: [], ...brief }, candidates, DEFAULT_WEIGHTS, now)
      .eligible.map((e) => e.manufacturerId)
      .sort();

  it("invites three GOTS-certified T-shirt factories to the e2e organic tee brief", () => {
    const brief = { category: "T_SHIRTS", quantity: 500, deadline: inDays(90), fabrics: ["Organic cotton"], requiredCapabilities: ["Screen printing"], requiredCertifications: ["GOTS"] };
    expect(eligible(brief)).toEqual(["jersey", "knits", "sweaters"]);
  });

  it("gives every submitted demo project more than one match", () => {
    expect(eligible({ category: "T_SHIRTS", quantity: 1200, maxMoq: 500, deadline: inDays(120), requiredCertifications: ["GOTS"], preferredCountry: "Pakistan" })).toEqual([
      "jersey", "knits", "sweaters",
    ]);
    expect(eligible({ category: "ACTIVEWEAR", quantity: 800, maxMoq: 500, deadline: inDays(110) })).toEqual(["activewear", "intimates", "knits"]);
    expect(eligible({ category: "DRESSES", quantity: 300, maxMoq: 200, deadline: inDays(120) })).toEqual(["ethnic", "shirts", "wovens"]);
    expect(eligible({ category: "OUTERWEAR", quantity: 400, maxMoq: 400, deadline: inDays(100) })).toEqual(["bottoms", "denim"]);
  });

  it("matches briefs in the newer categories", () => {
    expect(eligible({ category: "SWIMWEAR", quantity: 1000, deadline: inDays(90) })).toEqual(["intimates"]);
    expect(eligible({ category: "ETHNIC_WEAR", quantity: 200, deadline: inDays(90) })).toEqual(["ethnic"]);
    expect(eligible({ category: "UNIFORMS_WORKWEAR", quantity: 2000, deadline: inDays(90) })).toEqual(["uniforms"]);
    expect(eligible({ category: "BABYWEAR", quantity: 3000, deadline: inDays(120), requiredCertifications: ["GOTS"] })).toEqual(["composite", "jersey"]);
    expect(eligible({ category: "BAGS", quantity: 500, deadline: inDays(60) })).toEqual(["bags"]);
  });
});
