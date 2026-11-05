/**
 * The seed script's demo data, checked without a database: the generated placeholder files pass the real
 * upload checks (type, size, content sniffing) and the demo organisations and quotations pass the same
 * validation the forms use. Running the seed itself needs MongoDB (npm run mern:seed).
 */
import { describe, expect, it } from "vitest";
import { brandProfileSchema, manufacturerProfileSchema } from "@fashinza/shared/validation/profile.js";
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

describe("seed demo organisations", () => {
  it("has four factories whose profiles pass the factory profile form validation", () => {
    expect(FACTORIES.map((f) => f.key)).toEqual(["knits", "denim", "wovens", "activewear"]);
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
