/**
 * SERVER-A pure helpers that reproduce PostgreSQL/Prisma behaviour without a database: revision values,
 * quotation snapshots, the submit checklist, attachment ordering, wizard step parsing, matching summaries,
 * machinery rows and file headers. Database behaviour is in tests/integration/projects-quotations.test.js.
 */
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { matchFactories } from "@fashinza/shared/matching.js";
import { d128, decimalString, sortAttachments, and, defined, oid } from "../../src/lib/records.js";
import { forValidation, normaliseRevisionValue, projectChanges, submitIssuesFor } from "../../src/services/projects.js";
import { snapshot } from "../../src/services/quotations.js";
import { summariseExclusions } from "../../src/services/matching.js";
import { capabilityRows, machineryFromBody } from "../../src/services/profiles.js";
import { searchTerm } from "../../src/services/search.js";
import { projectStatusFilter, saveStepOutcome, stepInput } from "../../src/routes/projects.js";
import { quotationStatusFilter } from "../../src/routes/quotations.js";
import { opportunityFilter } from "../../src/routes/opportunities.js";
import { fileHeaders } from "../../src/routes/files.js";

const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe("records helpers", () => {
  it("treats malformed ids as ids that match nothing", () => {
    expect(oid("0123456789abcdef01234567").toHexString()).toBe("0123456789abcdef01234567");
    expect(oid("not-an-id").toHexString()).toBe("000000000000000000000000");
    expect(oid(undefined).toHexString()).toBe("000000000000000000000000");
  });

  it("formats decimals like Prisma and stores them at the column scale", () => {
    expect(decimalString(mongoose.Types.Decimal128.fromString("120.00"))).toBe("120");
    expect(decimalString("3320.50")).toBe("3320.5");
    expect(decimalString(null)).toBeNull();
    expect(d128("3.1").toString()).toBe("3.10");
    expect(d128(null)).toBeNull();
  });

  it("combines filters without overwriting keys and drops undefined fields", () => {
    expect(and({}, { a: 1 })).toEqual({ a: 1 });
    expect(and({ status: { $ne: "DRAFT" } }, { status: "QUOTING" })).toEqual({ $and: [{ status: { $ne: "DRAFT" } }, { status: "QUOTING" }] });
    expect(defined({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
  });

  it("orders attachments by kind (enum order), version desc with nulls first, then newest", () => {
    const at = (kind, version, day, id) => ({ _id: id, kind, version, createdAt: new Date(2026, 0, day) });
    const sorted = sortAttachments([
      at("OTHER", null, 1, "a"),
      at("TECH_PACK", 1, 1, "b"),
      at("TECH_PACK", 2, 2, "c"),
      at("SKETCH", null, 1, "d"),
      at("SKETCH", null, 3, "e"),
      at("MEASUREMENT_CHART", null, 1, "f"),
      at("REFERENCE_IMAGE", null, 1, "g"),
    ]);
    expect(sorted.map((x) => x._id)).toEqual(["c", "b", "e", "d", "a", "g", "f"]);
  });
});

describe("project revisions", () => {
  it("stores values as the PostgreSQL app did (ISO dates, JSON arrays, Decimal.toString, text numbers)", () => {
    const deadline = new Date("2027-03-01T00:00:00.000Z");
    expect(normaliseRevisionValue(deadline)).toBe("2027-03-01T00:00:00.000Z");
    expect(normaliseRevisionValue(["S", "M"])).toBe('["S","M"]');
    expect(normaliseRevisionValue([])).toBe("[]");
    expect(normaliseRevisionValue(mongoose.Types.Decimal128.fromString("12.50"))).toBe("12.5");
    expect(normaliseRevisionValue(500)).toBe("500");
    expect(normaliseRevisionValue(true)).toBe("true");
    expect(normaliseRevisionValue(undefined)).toBeNull();
  });

  it("records only fields of this step that changed", () => {
    const project = { quantity: 500, sampleQuantity: 1, sampleSizes: [], sampleNotes: null, sampleRequired: true, name: "Tee" };
    expect(projectChanges(project, { quantity: 650 })).toEqual({ quantity: { from: "500", to: "650" } });
    expect(projectChanges(project, { sampleRequired: true, sampleQuantity: 4, sampleSizes: ["M"], sampleNotes: undefined })).toEqual({
      sampleQuantity: { from: "1", to: "4" },
      sampleSizes: { from: "[]", to: '["M"]' },
    });
    expect(projectChanges(project, {})).toEqual({});
  });
});

describe("submit checklist", () => {
  const complete = {
    name: "Organic tee",
    category: "T_SHIRTS",
    description: "Heavyweight organic cotton crew-neck tee with a front screen print.",
    fabricRequirements: "100% organic cotton jersey",
    colors: "Black",
    sizes: ["S"],
    quantity: 500,
    deadline: inDays(90),
    targetUnitPrice: mongoose.Types.Decimal128.fromString("4.50"),
    maxMoq: null,
    sampleRequired: true,
    sampleQuantity: 1,
    fabrics: [],
    requiredCapabilities: [],
    requiredCertifications: [],
    sampleSizes: [],
    currency: "USD",
  };

  it("is empty for a complete project with a tech pack", () => {
    expect(forValidation(complete).targetUnitPrice).toBe("4.50");
    expect(submitIssuesFor(complete, [{ kind: "TECH_PACK" }])).toEqual([]);
  });

  it("lists missing fields and the tech pack with the page's messages", () => {
    const issues = submitIssuesFor({ ...complete, description: null, quantity: null }, [{ kind: "SKETCH" }]);
    expect(issues).toEqual(
      expect.arrayContaining([
        // z.string() has no required_error, so a missing description reports zod's own "Required" (as today).
        { field: "description", message: "Required" },
        { field: "quantity", message: "Enter the estimated quantity." },
        { field: "techPack", message: "Upload at least one tech pack." },
      ]),
    );
    expect(issues.at(-1)).toEqual({ field: "techPack", message: "Upload at least one tech pack." });
    expect(submitIssuesFor({ ...complete, description: "Too short" }, [{ kind: "TECH_PACK" }])).toEqual([{ field: "description", message: "Describe the product in at least 20 characters." }]);
    expect(submitIssuesFor({ ...complete, sampleQuantity: null }, [{ kind: "TECH_PACK" }])).toEqual([{ field: "sampleQuantity", message: "Enter how many sample pieces you need." }]);
  });
});

describe("wizard steps", () => {
  it("reads only the fields of the step, arrays as non-blank strings and scalars as strings", () => {
    const input = stepInput({ step: "3", quantity: "300", currency: "EUR", name: "ignored", fabrics: ["x"] });
    expect(input).toEqual({ step: 3, raw: { quantity: "300", maxMoq: "", targetUnitPrice: "", currency: "EUR", deadline: "", preferredCountry: "" } });
    expect(stepInput({ step: "2", fabrics: ["Linen", " "], sizes: [] }).raw).toMatchObject({ fabrics: ["Linen"], sizes: [], colors: "" });
    expect(stepInput({ step: "6" })).toEqual({ step: 6, raw: {} });
    expect(stepInput({ step: "9" })).toBeNull();
    expect(stepInput({})).toBeNull();
  });

  it("navigates like saveProjectStepAction", () => {
    const id = "p1";
    expect(saveStepOutcome({ id, step: 3, projectId: "p1", intent: "save", submitted: "1" })).toEqual({ redirectTo: "/projects/p1?updated=1" });
    expect(saveStepOutcome({ id, step: 3, projectId: "p1", intent: "next" })).toEqual({ redirectTo: "/projects/p1/edit?step=4" });
    expect(saveStepOutcome({ id, step: 1, projectId: null, intent: "save" })).toEqual({ redirectTo: "/projects/p1/edit?step=1&saved=1" });
    expect(saveStepOutcome({ id, step: 2, projectId: "p1", intent: "save" })).toEqual({ message: "Draft saved." });
  });

  it("accepts only known list filters", () => {
    expect(projectStatusFilter("ACTIVE")).toBe("ACTIVE");
    expect(projectStatusFilter("QUOTING")).toBe("QUOTING");
    expect(projectStatusFilter("toString")).toBeUndefined();
    expect(projectStatusFilter(["QUOTING"])).toBeUndefined();
    expect(quotationStatusFilter("EXPIRED")).toBe("EXPIRED");
    expect(quotationStatusFilter("nope")).toBeUndefined();
    expect(opportunityFilter("new")).toBe("new");
    expect(opportunityFilter(undefined)).toBe("open");
    expect(opportunityFilter("weird")).toBe("open");
    expect(searchTerm("  tee  ")).toBe("tee");
    expect(searchTerm("x".repeat(150))).toHaveLength(100);
    expect(searchTerm(["a"])).toBe("");
  });
});

describe("quotation snapshot", () => {
  it("archives the previous terms with Prisma's decimal strings", () => {
    const D = (v) => mongoose.Types.Decimal128.fromString(v);
    const q = {
      quantity: 500, minQuantity: 300, productionDays: 40, currency: "USD", unitPrice: D("3.10"), fabricCostPerUnit: D("2.05"), finishingCostPerUnit: D("0.40"),
      packagingCostPerUnit: D("0.15"), samplingCost: D("120.00"), logisticsCost: D("350.50"), taxPercent: D("0.00"), subtotal: D("3320.50"), taxAmount: D("0.00"),
      totalAmount: D("3320.50"), validUntil: new Date("2027-01-01T00:00:00.000Z"), notes: null, sampleLeadTimeDays: 12, sampleNotes: "One fit sample",
    };
    expect(snapshot(q)).toEqual({
      quantity: 500, minQuantity: 300, productionDays: 40, currency: "USD", unitPrice: "3.1", fabricCostPerUnit: "2.05", finishingCostPerUnit: "0.4",
      packagingCostPerUnit: "0.15", samplingCost: "120", logisticsCost: "350.5", taxPercent: "0", subtotal: "3320.5", taxAmount: "0", totalAmount: "3320.5",
      validUntil: "2027-01-01T00:00:00.000Z", notes: null, sampleLeadTimeDays: 12, sampleNotes: "One fit sample",
    });
  });
});

describe("matching summary", () => {
  it("buckets exclusion reasons into the brand-facing labels", () => {
    const candidate = (o) => ({
      manufacturerId: o.id, name: o.id, verified: true, active: true, country: "Pakistan", categories: ["T_SHIRTS"], minOrderQuantity: 100,
      maxMonthlyCapacity: 10000, committedMonthlyUnits: 0, typicalLeadTimeDays: 30, capabilities: [], fabrics: [], verifiedCertifications: [],
      history: { qcReports: 0, qcPassed: 0, deliveredOrders: 0, onTimeDeliveries: 0 }, ...o,
    });
    const outcome = matchFactories(
      { category: "T_SHIRTS", quantity: 500, maxMoq: null, deadline: inDays(90), fabrics: [], requiredCapabilities: [], requiredCertifications: ["GOTS"], preferredCountry: null },
      [
        candidate({ id: "a", verifiedCertifications: ["GOTS"] }),
        candidate({ id: "b", verified: false, verifiedCertifications: ["GOTS"] }),
        candidate({ id: "c", categories: ["DENIM"], verifiedCertifications: ["GOTS"] }),
        candidate({ id: "d", minOrderQuantity: 2000, verifiedCertifications: ["GOTS"] }),
        candidate({ id: "e" }),
        candidate({ id: "f", active: false, typicalLeadTimeDays: 200, maxMonthlyCapacity: 1, verifiedCertifications: ["GOTS"] }),
      ],
    );
    expect(outcome.eligible.map((m) => m.manufacturerId)).toEqual(["a"]);
    expect(summariseExclusions(outcome)).toEqual({
      "Not yet verified": 1,
      "Different product category": 1,
      "MOQ above your quantity": 1,
      "Missing a required certification": 1,
      "Account suspended": 1,
      "Lead time too long for your deadline": 1,
      "Not enough free capacity": 1,
    });
  });
});

describe("factory profile form", () => {
  it("builds machinery rows from parallel lists, keeping empty rows so errors line up", () => {
    expect(machineryFromBody({ machineType: ["Bartack", "", "Overlock"], machineQuantity: ["2", "", "3"] })).toEqual([
      { type: "Bartack", quantity: "2" },
      { type: "", quantity: "" },
      { type: "Overlock", quantity: "3" },
    ]);
    expect(machineryFromBody({ machineType: "Bartack" })).toEqual([{ type: "Bartack", quantity: "" }]);
    expect(machineryFromBody({})).toEqual([]);
    expect(machineryFromBody({ machinery: [{ type: "Bartack", quantity: 2 }] })).toEqual([{ type: "Bartack", quantity: 2 }]);
  });

  it("turns the capability lists into unique rows (createMany skipDuplicates)", () => {
    expect(capabilityRows(["Cut and sew", "Cut and sew"], ["Cotton"], [])).toEqual([
      { kind: "PRODUCTION", name: "Cut and sew" },
      { kind: "FABRIC", name: "Cotton" },
    ]);
  });
});

describe("file download headers", () => {
  it("match the original route handler", () => {
    expect(fileHeaders({ fileName: "tech pack v2 (final).pdf", mimeType: "application/pdf" }, 42, false)).toEqual({
      "Content-Type": "application/pdf",
      "Content-Length": "42",
      "Content-Disposition": "inline; filename*=UTF-8''tech%20pack%20v2%20(final).pdf",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    });
    expect(fileHeaders({ fileName: "a.png", mimeType: "image/png" }, 1, true)["Content-Disposition"]).toBe("attachment; filename*=UTF-8''a.png");
  });
});
