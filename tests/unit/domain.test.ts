import { describe, expect, it } from "vitest";
import { allocateAmounts, calculateQuotationTotals } from "@/lib/quotation-math";
import { codeLetterForLot, evaluateInspection, inspectionPlan, samplingPlan } from "@/lib/aql";
import { DEFAULT_WEIGHTS, matchFactories, type MatchCandidate, type MatchProject } from "@/lib/matching";
import { daysOverdue, estimateDelivery, nextStage, planMilestoneDates, STAGES } from "@/lib/workflow";

describe("quotation totals", () => {
  it("adds per-unit costs, one-off charges and tax with exact decimals", () => {
    const t = calculateQuotationTotals({
      quantity: 500,
      unitPrice: "3.10",
      fabricCostPerUnit: "2.05",
      finishingCostPerUnit: "0.40",
      packagingCostPerUnit: "0.15",
      samplingCost: "120",
      logisticsCost: "350.50",
      taxPercent: "17",
    });
    expect(t.perUnitCost).toBe("5.70");
    expect(t.subtotal).toBe("3320.50"); // 5.70 × 500 + 120 + 350.50
    expect(t.taxAmount).toBe("564.49"); // 3320.50 × 17% = 564.485 → half-up
    expect(t.totalAmount).toBe("3884.99");
  });

  it("avoids floating point drift", () => {
    expect(calculateQuotationTotals({ quantity: 3, unitPrice: "0.10", fabricCostPerUnit: "0.20" }).subtotal).toBe("0.90");
  });

  it("rejects invalid input", () => {
    expect(() => calculateQuotationTotals({ quantity: 0, unitPrice: 1 })).toThrow();
    expect(() => calculateQuotationTotals({ quantity: 10, unitPrice: -1 })).toThrow();
    expect(() => calculateQuotationTotals({ quantity: 10, unitPrice: 1, taxPercent: 101 })).toThrow();
  });

  it("allocates payment milestones that sum exactly to the total", () => {
    const parts = allocateAmounts("1000.01", [30, 40, 30]);
    expect(parts).toEqual(["300.00", "400.00", "300.01"]);
    expect(() => allocateAmounts(100, [50, 40])).toThrow(/100/);
  });
});

describe("AQL sampling plans (ISO 2859-1, level II, normal)", () => {
  it("maps lot sizes to code letters", () => {
    expect(codeLetterForLot(8)).toBe("A");
    expect(codeLetterForLot(500)).toBe("H");
    expect(codeLetterForLot(501)).toBe("J");
    expect(codeLetterForLot(3200)).toBe("K");
    expect(codeLetterForLot(10001)).toBe("M");
  });

  it("matches published reference plans", () => {
    expect(samplingPlan(1000, 2.5)).toMatchObject({ codeLetter: "J", sampleSize: 80, accept: 5, reject: 6 });
    expect(samplingPlan(500, 2.5)).toMatchObject({ codeLetter: "H", sampleSize: 50, accept: 3, reject: 4 });
    expect(samplingPlan(5000, 2.5)).toMatchObject({ codeLetter: "L", sampleSize: 200, accept: 10, reject: 11 });
    expect(samplingPlan(1000, 4.0)).toMatchObject({ sampleSize: 80, accept: 7, reject: 8 });
  });

  it("resolves arrows to the plan below or above", () => {
    // Lot 100 → F; at AQL 1.0 the arrow points up to E (13 samples, Ac 0).
    expect(samplingPlan(100, 1.0)).toMatchObject({ codeLetter: "E", sampleSize: 13, accept: 0, reject: 1 });
    // Lot 20 → C; at AQL 1.0 the arrow points down to E (13 samples, Ac 0).
    expect(samplingPlan(20, 1.0)).toMatchObject({ codeLetter: "E", sampleSize: 13, accept: 0 });
    // Lot 40000 → N; at AQL 4.0 the arrow points up to M (315 samples, Ac 21).
    expect(samplingPlan(40000, 4.0)).toMatchObject({ codeLetter: "M", sampleSize: 315, accept: 21 });
  });

  it("caps the sample at the lot size (100% inspection)", () => {
    expect(samplingPlan(10, 0.65)).toMatchObject({ sampleSize: 10, fullInspection: true });
  });

  it("rejects unsupported AQL values", () => {
    expect(() => samplingPlan(1000, 3)).toThrow(/not configured/);
  });

  it("evaluates pass and fail with reasons", () => {
    const plan = inspectionPlan(1000, 2.5, 4.0);
    expect(plan.sampleSize).toBe(80);
    expect(evaluateInspection(plan, { critical: 0, major: 5, minor: 7 }).result).toBe("PASS");
    const fail = evaluateInspection(plan, { critical: 1, major: 6, minor: 0 });
    expect(fail.result).toBe("FAIL");
    expect(fail.reasons).toHaveLength(2);
  });
});

describe("production workflow", () => {
  it("defines the eight stages in order", () => {
    expect(STAGES.map((s) => s.stage)).toEqual([
      "FABRIC_SOURCING", "SAMPLING", "CUTTING", "STITCHING", "FINISHING", "QUALITY_CONTROL", "SHIPPING", "DELIVERY",
    ]);
    expect(nextStage("FINISHING")).toBe("QUALITY_CONTROL");
    expect(nextStage("DELIVERY")).toBeNull();
  });

  it("plans dates across the production duration", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const plan = planMilestoneDates(start, 40);
    expect(plan[0].plannedStart.toISOString()).toBe(start.toISOString());
    expect(plan.at(-1)!.plannedEnd.toISOString()).toBe("2026-02-10T00:00:00.000Z");
  });

  it("recalibrates the delivery estimate by the current stage's delay", () => {
    const now = new Date("2026-01-20T00:00:00Z");
    const plannedEnd = new Date("2026-01-15T00:00:00Z");
    expect(daysOverdue(plannedEnd, null, now)).toBe(5);
    expect(daysOverdue(plannedEnd, new Date(), now)).toBe(0);
    expect(estimateDelivery(new Date("2026-02-01T00:00:00Z"), { plannedEnd, completedAt: null }, now).toISOString()).toBe("2026-02-06T00:00:00.000Z");
  });
});

describe("factory matching", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const project: MatchProject = {
    category: "T_SHIRTS",
    quantity: 500,
    deadline: new Date("2026-03-02T00:00:00Z"), // 60 days
    fabrics: ["Organic cotton"],
    requiredCapabilities: ["Cut and sew", "Screen printing"],
    requiredCertifications: ["GOTS"],
    preferredCountry: "Pakistan",
  };
  const base: MatchCandidate = {
    manufacturerId: "m1",
    name: "Alpha Knits",
    verified: true,
    active: true,
    country: "Pakistan",
    categories: ["T_SHIRTS"],
    minOrderQuantity: 100,
    maxMonthlyCapacity: 5000,
    committedMonthlyUnits: 0,
    typicalLeadTimeDays: 30,
    capabilities: ["Cut and sew", "Screen printing"],
    fabrics: ["Organic cotton"],
    verifiedCertifications: ["GOTS"],
    history: { qcReports: 0, qcPassed: 0, deliveredOrders: 0, onTimeDeliveries: 0 },
  };

  it("applies mandatory filters before ranking", () => {
    const out = matchFactories(
      project,
      [
        base,
        { ...base, manufacturerId: "m2", name: "Unverified", verified: false },
        { ...base, manufacturerId: "m3", name: "High MOQ", minOrderQuantity: 1000 },
        { ...base, manufacturerId: "m4", name: "No GOTS", verifiedCertifications: [] },
        { ...base, manufacturerId: "m5", name: "Slow", typicalLeadTimeDays: 90 },
        { ...base, manufacturerId: "m6", name: "Full", maxMonthlyCapacity: 200, committedMonthlyUnits: 150 },
        { ...base, manufacturerId: "m7", name: "Denim only", categories: ["DENIM"] },
      ],
      DEFAULT_WEIGHTS,
      now,
    );
    expect(out.eligible.map((e) => e.manufacturerId)).toEqual(["m1"]);
    expect(out.excluded).toHaveLength(6);
    expect(out.excluded.find((e) => e.manufacturerId === "m3")!.reasons[0]).toMatch(/Minimum order is 1000/);
  });

  it("is deterministic and ranks better fits higher with explanations", () => {
    const weaker = { ...base, manufacturerId: "m8", name: "Beta", capabilities: ["Cut and sew"], country: "Bangladesh" };
    const a = matchFactories(project, [weaker, base], DEFAULT_WEIGHTS, now);
    const b = matchFactories(project, [base, weaker], DEFAULT_WEIGHTS, now);
    expect(a).toEqual(b);
    expect(a.eligible[0].manufacturerId).toBe("m1");
    expect(a.eligible[0].score).toBeGreaterThan(a.eligible[1].score);
    expect(a.eligible[1].breakdown.capability.note).toMatch(/missing: Screen printing/);
    expect(a.eligible[0].breakdown.performance.note).toMatch(/neutral/);
  });

  it("uses delivery and QC history when available", () => {
    const proven = { ...base, manufacturerId: "m9", name: "Proven", history: { qcReports: 4, qcPassed: 4, deliveredOrders: 2, onTimeDeliveries: 2 } };
    const out = matchFactories(project, [base, proven], DEFAULT_WEIGHTS, now);
    expect(out.eligible[0].manufacturerId).toBe("m9");
  });

  it("validates weights", () => {
    expect(() => matchFactories(project, [], { ...DEFAULT_WEIGHTS, capability: 50 }, now)).toThrow(/100/);
  });
});

describe("factory matching — MOQ limit", () => {
  it("excludes factories above the brand's MOQ limit even when below the quantity", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const project: MatchProject = { category: "T_SHIRTS", quantity: 1000, maxMoq: 300, deadline: null, fabrics: [], requiredCapabilities: [], requiredCertifications: [], preferredCountry: null };
    const c: MatchCandidate = {
      manufacturerId: "x", name: "X", verified: true, active: true, country: "PK", categories: ["T_SHIRTS"], minOrderQuantity: 500, maxMonthlyCapacity: 5000,
      committedMonthlyUnits: 0, typicalLeadTimeDays: 30, capabilities: [], fabrics: [], verifiedCertifications: [], history: { qcReports: 0, qcPassed: 0, deliveredOrders: 0, onTimeDeliveries: 0 },
    };
    const out = matchFactories(project, [c], DEFAULT_WEIGHTS, now);
    expect(out.eligible).toHaveLength(0);
    expect(out.excluded[0].reasons[0]).toMatch(/MOQ of at most 300/);
    expect(matchFactories({ ...project, maxMoq: 600 }, [c], DEFAULT_WEIGHTS, now).eligible).toHaveLength(1);
  });
});
