import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addAttachment, deleteAttachment, getProject, saveProject, submitProject } from "@/server/services/projects";
import { acceptQuotation, rejectQuotation, requestRevision, saveQuotation, withdrawQuotation } from "@/server/services/quotations";
import { inDays, makeAdmin, makeBrand, makeFactory, makeSubmittedProject, pdfFile, pngFile, QUOTE, resetDb } from "../support/fixtures";

beforeEach(resetDb);

describe("project creation", () => {
  it("saves drafts step by step without overwriting earlier steps", async () => {
    const brand = await makeBrand();
    const id = await saveProject(brand, null, { name: "Linen shirt", category: "SHIRTS", description: "Relaxed fit linen shirt with coconut buttons." }, 1);
    await saveProject(brand, id, { fabricRequirements: "100% linen, 160 gsm", fabrics: ["Linen"], colors: "Sand", sizes: ["S", "M"], requiredCapabilities: ["Cut and sew"] }, 2);
    await saveProject(brand, id, { quantity: "300", currency: "EUR", deadline: inDays(60).toISOString().slice(0, 10), targetUnitPrice: "12.50" }, 3);
    const p = await db.project.findUniqueOrThrow({ where: { id } });
    expect(p).toMatchObject({ status: "DRAFT", description: "Relaxed fit linen shirt with coconut buttons.", fabrics: ["Linen"], sizes: ["S", "M"], quantity: 300, currency: "EUR", wizardStep: 4 });
    expect(p.targetUnitPrice?.toFixed(2)).toBe("12.50");
  });

  it("returns field errors for invalid step data", async () => {
    const brand = await makeBrand();
    await expect(saveProject(brand, null, { name: "x", category: "NOPE" }, 1)).rejects.toMatchObject({ code: "INVALID", fieldErrors: { name: expect.any(String), category: expect.any(String) } });
  });

  it("refuses to submit an incomplete project or one without a tech pack", async () => {
    const brand = await makeBrand();
    const id = await saveProject(brand, null, { name: "Hoodie", category: "HOODIES_SWEATSHIRTS" }, 1);
    await expect(submitProject(brand, id)).rejects.toMatchObject({ code: "INVALID", fieldErrors: expect.objectContaining({ description: expect.any(String), quantity: expect.any(String) }) });
    await saveProject(brand, id, { description: "Brushed-back fleece hoodie with kangaroo pocket.", fabricRequirements: "80/20 cotton poly fleece", colors: "Grey", sizes: ["M"], quantity: "200", deadline: inDays(80).toISOString() }, 3);
    await expect(submitProject(brand, id)).rejects.toThrow(/tech pack/);
  });

  it("versions tech packs and keeps history after submission", async () => {
    const admin = await makeAdmin();
    const factory = await makeFactory(admin);
    const brand = await makeBrand();
    const { projectId } = await makeSubmittedProject(brand);
    const v2 = await addAttachment(brand, projectId, pdfFile("techpack-v2.pdf"), "TECH_PACK", "Updated neck rib");
    expect(v2.version).toBe(2);
    await expect(deleteAttachment(brand, v2.id)).rejects.toThrow(/kept as part of its history/);
    // The matched factory is told about the new version.
    expect(await db.notification.count({ where: { userId: factory.id, title: "New tech pack version" } })).toBe(1);
  });

  it("rejects files whose content does not match their type", async () => {
    const brand = await makeBrand();
    const id = await saveProject(brand, null, { name: "Fake file", category: "T_SHIRTS" }, 1);
    const fake = new File([Buffer.from("MZ executable")], "evil.pdf", { type: "application/pdf" });
    await expect(addAttachment(brand, id, fake, "TECH_PACK")).rejects.toThrow(/does not match/);
    await expect(addAttachment(brand, id, pdfFile(), "SKETCH")).rejects.toThrow(/PNG, JPEG or WebP/);
    await expect(addAttachment(brand, id, pngFile(), "SKETCH")).resolves.toMatchObject({ kind: "SKETCH", version: null });
  });

  it("records revisions when a submitted project is edited", async () => {
    const brand = await makeBrand();
    const { projectId } = await makeSubmittedProject(brand);
    await saveProject(brand, projectId, { quantity: "650" }, 3);
    const p = await getProject(brand, projectId);
    expect(p.quantity).toBe(650);
    expect(p.revisions[0].changes).toMatchObject({ quantity: { from: "500", to: "650" } });
  });
});

describe("factory matching", () => {
  it("invites only verified, eligible factories and explains exclusions", async () => {
    const admin = await makeAdmin();
    const good = await makeFactory(admin);
    const highMoq = await makeFactory(admin, { moq: 2000 });
    const denim = await makeFactory(admin, { categories: ["DENIM"] });
    const unverified = await makeFactory(admin, { verify: false });
    const brand = await makeBrand();
    const { projectId, summary } = await makeSubmittedProject(brand);

    expect(summary).toMatchObject({ reviewed: 4, eligible: 1, newlyInvited: 1 });
    expect(summary.exclusionReasons).toMatchObject({ "MOQ above your quantity": 1, "Different product category": 1, "Not yet verified": 1 });
    const matches = await db.matchResult.findMany({ where: { projectId } });
    expect(matches.map((m) => m.manufacturerId)).toEqual([good.id]);
    expect(Number(matches[0].score)).toBeGreaterThan(0);
    expect(matches[0].reasons.length).toBeGreaterThan(2);
    expect((await db.project.findUniqueOrThrow({ where: { id: projectId } })).status).toBe("QUOTING");
    expect(await db.notification.count({ where: { userId: good.id, type: "MATCH_FOUND" } })).toBe(1);
    for (const f of [highMoq, denim, unverified]) expect(await db.notification.count({ where: { userId: f.id, type: "MATCH_FOUND" } })).toBe(0);
  });

  it("requires verified certifications when the brand asks for them", async () => {
    const admin = await makeAdmin();
    const gots = await makeFactory(admin, { certification: "GOTS" });
    await makeFactory(admin);
    const brand = await makeBrand();
    const { projectId, summary } = await makeSubmittedProject(brand, { requiredCertifications: ["GOTS"] });
    expect(summary.eligible).toBe(1);
    expect((await db.matchResult.findFirstOrThrow({ where: { projectId } })).manufacturerId).toBe(gots.id);
  });
});

describe("quotations", () => {
  async function setup() {
    const admin = await makeAdmin();
    const f1 = await makeFactory(admin);
    const f2 = await makeFactory(admin);
    const brand = await makeBrand();
    const { projectId } = await makeSubmittedProject(brand);
    return { admin, f1, f2, brand, projectId };
  }

  it("calculates totals on the server and hides drafts from the brand", async () => {
    const { f1, brand, projectId } = await setup();
    const draft = await saveQuotation(f1, projectId, { ...QUOTE, taxPercent: "17" }, false);
    expect(draft).toMatchObject({ status: "DRAFT" });
    expect(draft.subtotal.toFixed(2)).toBe("3320.50");
    expect(draft.taxAmount.toFixed(2)).toBe("564.49");
    expect(draft.totalAmount.toFixed(2)).toBe("3884.99");
    expect(await db.quotation.count({ where: { project: { brandId: brand.id }, status: { not: "DRAFT" } } })).toBe(0);
    const sent = await saveQuotation(f1, projectId, { ...QUOTE, taxPercent: "17" }, true);
    expect(sent.status).toBe("SUBMITTED");
    expect(await db.notification.count({ where: { userId: brand.id, type: "QUOTATION_RECEIVED" } })).toBe(1);
  });

  it("blocks factories that were not matched or are not verified", async () => {
    const { admin, projectId } = await setup();
    const outsider = await makeFactory(admin, { categories: ["DENIM"] });
    await expect(saveQuotation(outsider, projectId, QUOTE, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("records every revision with the previous terms", async () => {
    const { f1, brand, projectId } = await setup();
    const q = await saveQuotation(f1, projectId, QUOTE, true);
    await requestRevision(brand, q.id, "Please reduce the sampling charge.");
    expect((await db.quotation.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("REVISION_REQUESTED");
    await expect(acceptQuotation(brand, q.id)).rejects.toThrow(/revision/);
    const revised = await saveQuotation(f1, projectId, { ...QUOTE, samplingCost: "60" }, true);
    expect(revised).toMatchObject({ status: "SUBMITTED", version: 2 });
    const history = await db.quotationRevision.findMany({ where: { quotationId: q.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ version: 1, snapshot: expect.objectContaining({ samplingCost: "120", totalAmount: "3320.5" }) });
    expect(await db.notification.count({ where: { userId: brand.id, type: "QUOTATION_REVISED" } })).toBe(1);
  });

  it("does not accept expired quotations", async () => {
    const { f1, brand, projectId } = await setup();
    const q = await saveQuotation(f1, projectId, QUOTE, true);
    await db.quotation.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    await expect(acceptQuotation(brand, q.id)).rejects.toThrow(/expired/);
    expect((await db.quotation.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("EXPIRED");
    expect(await db.order.count()).toBe(0);
  });

  it("creates exactly one order from the accepted quotation and closes competing offers", async () => {
    const { f1, f2, brand, projectId } = await setup();
    const q1 = await saveQuotation(f1, projectId, QUOTE, true);
    const q2 = await saveQuotation(f2, projectId, { ...QUOTE, unitPrice: "3.50" }, true);
    const order = await acceptQuotation(brand, q1.id);

    expect(order).toMatchObject({ quantity: 500, currency: "USD", manufacturerId: f1.id, brandId: brand.id, currentStage: "FABRIC_SOURCING", status: "IN_PRODUCTION" });
    expect(order.totalAmount.toFixed(2)).toBe("3320.50");
    expect(order.agreedTerms).toMatchObject({ totalAmount: "3320.50", productionDays: 40, quotationVersion: 1 });
    const milestones = await db.productionMilestone.findMany({ where: { orderId: order.id }, orderBy: { sequence: "asc" } });
    expect(milestones.map((m) => m.status)).toEqual(["IN_PROGRESS", ...Array(7).fill("NOT_STARTED")]);
    const payments = await db.paymentMilestone.findMany({ where: { orderId: order.id }, orderBy: { sequence: "asc" } });
    expect(payments.map((p) => p.amount.toFixed(2))).toEqual(["996.15", "1328.20", "996.15"]);
    expect((await db.quotation.findUniqueOrThrow({ where: { id: q2.id } })).status).toBe("REJECTED");
    expect(await db.notification.count({ where: { userId: f2.id, type: "QUOTATION_REJECTED" } })).toBe(1);

    await expect(acceptQuotation(brand, q2.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(acceptQuotation(brand, q1.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.order.count({ where: { projectId } })).toBe(1);
  });

  it("allows only one order when two acceptances race", async () => {
    const { f1, f2, brand, projectId } = await setup();
    const q1 = await saveQuotation(f1, projectId, QUOTE, true);
    const q2 = await saveQuotation(f2, projectId, QUOTE, true);
    const results = await Promise.allSettled([acceptQuotation(brand, q1.id), acceptQuotation(brand, q2.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.order.count({ where: { projectId } })).toBe(1);
  });

  it("supports rejection and withdrawal", async () => {
    const { f1, f2, brand, projectId } = await setup();
    const q1 = await saveQuotation(f1, projectId, QUOTE, true);
    await rejectQuotation(brand, q1.id, "Price is above our budget.");
    await expect(acceptQuotation(brand, q1.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const q2 = await saveQuotation(f2, projectId, QUOTE, true);
    await withdrawQuotation(f2, q2.id);
    expect((await db.quotation.findUniqueOrThrow({ where: { id: q2.id } })).status).toBe("WITHDRAWN");
  });
});
