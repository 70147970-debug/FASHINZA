import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import * as enums from "@fashinza/shared/enums.js";
import { ALL_MODELS, BrandProfile, ManufacturerProfile, Order, PaymentMilestone, Project, ProjectAttachment, Quotation, QCReport, User, WebhookEvent } from "../../src/models/index.js";
import { money, page, plain, serialize } from "../../src/lib/serialize.js";

const id = () => new mongoose.Types.ObjectId();

const COLLECTIONS = [
  "user", "session", "account", "verification", "brand_profile", "manufacturer_profile", "manufacturer_capability", "manufacturer_machine",
  "manufacturer_document", "project", "project_attachment", "project_revision", "match_result", "quotation", "quotation_revision", "order",
  "production_milestone", "milestone_evidence", "sample", "sample_photo", "qc_report", "qc_defect", "qc_report_photo", "rework_task",
  "payment_milestone", "payment_transaction", "webhook_event", "message", "activity_log", "notification", "contact_inquiry", "issue_report", "audit_log",
];

const uniqueIndexes = (Model) => Model.schema.indexes().filter(([, o]) => o?.unique).map(([fields, o]) => ({ fields, partial: o.partialFilterExpression }));

describe("models", () => {
  it("has one model per Prisma model, named after the @@map tables", () => {
    expect(ALL_MODELS.map((M) => M.collection.collectionName).sort()).toEqual([...COLLECTIONS].sort());
  });

  it("declares the uniqueness guarantees the services rely on", () => {
    expect(uniqueIndexes(Order).map((i) => i.fields)).toEqual([{ reference: 1 }, { projectId: 1 }, { quotationId: 1 }]);
    expect(uniqueIndexes(WebhookEvent).map((i) => i.fields)).toEqual([{ provider: 1, eventId: 1 }]);
    expect(uniqueIndexes(User).map((i) => i.fields)).toEqual([{ email: 1 }]);
    expect(uniqueIndexes(Quotation).map((i) => i.fields)).toEqual([{ projectId: 1, manufacturerId: 1 }]);
    const versioned = uniqueIndexes(ProjectAttachment).find((i) => "version" in i.fields);
    expect(versioned.partial).toEqual({ version: { $type: "number" } });
  });

  it("uses the enum values from @fashinza/shared in declaration order", () => {
    expect(Project.schema.path("status").enumValues).toEqual([...enums.ProjectStatus]);
    expect(Quotation.schema.path("status").enumValues).toEqual([...enums.QuotationStatus]);
    expect(ManufacturerProfile.schema.path("categories").caster.enumValues).toEqual([...enums.GarmentCategory]);
  });

  it("reproduces Prisma defaults and null optionals", () => {
    const p = new Project({ brandId: id(), name: "Tee", category: "T_SHIRTS" });
    expect(p.toJSON()).toMatchObject({
      currency: "USD", status: "DRAFT", wizardStep: 1, sampleRequired: true, sampleQuantity: 1,
      fabrics: [], sizes: [], sampleSizes: [], description: null, targetUnitPrice: null, deadline: null,
    });
    expect(new User({ name: "A", email: "MiXeD@Example.TEST" }).toJSON()).toMatchObject({ email: "mixed@example.test", role: "BRAND", status: "ACTIVE", emailVerified: false, profileCompleted: false });
    expect(new ManufacturerProfile({}).typicalLeadTimeDays).toBe(45);
  });

  it("accepts empty strings in required text columns (as PostgreSQL did)", () => {
    const b = new BrandProfile({ userId: id(), companyName: "Loom & Line", country: "" });
    expect(b.validateSync()).toBeUndefined();
    const missing = new BrandProfile({ userId: id(), companyName: "X" });
    expect(Object.keys(missing.validateSync().errors)).toEqual(["country"]);
  });

  it("stores money as Decimal128 at the column's scale and serialises it as a string", () => {
    const q = new Quotation({ projectId: id(), manufacturerId: id(), unitPrice: "3.1", taxPercent: 5, currency: "USD", minQuantity: 1, productionDays: 2, validUntil: new Date() });
    expect(q.unitPrice).toBeInstanceOf(mongoose.Types.Decimal128);
    expect(q.unitPrice.toString()).toBe("3.10");
    const json = JSON.parse(JSON.stringify(q));
    expect(json).toMatchObject({ unitPrice: "3.10", taxPercent: "5.00", subtotal: "0.00", samplingCost: null });
    expect(json.id).toMatch(/^[a-f0-9]{24}$/);
    expect(json._id).toBeUndefined();
    expect(json.projectId).toMatch(/^[a-f0-9]{24}$/);
    const bad = new PaymentMilestone({ amount: "not money" });
    expect(bad.validateSync().errors.amount).toBeDefined();
    expect(new QCReport({ defectRate: "2.5" }).defectRate.toString()).toBe("2.50");
  });

  it("serialises lean documents the same way as hydrated ones", () => {
    const q = new Quotation({ projectId: id(), manufacturerId: id(), unitPrice: "1234.5", currency: "USD", minQuantity: 1, productionDays: 2, validUntil: new Date() });
    const lean = q.toObject({ transform: false });
    expect(lean._id).toBeInstanceOf(mongoose.Types.ObjectId);
    const out = serialize(Quotation, lean);
    expect(out).toEqual(JSON.parse(JSON.stringify(q), (k, v) => (k === "validUntil" || k === "createdAt" || k === "updatedAt" ? new Date(v) : v)));
    expect(serialize(Quotation, [lean])[0].unitPrice).toBe("1234.50");
    expect(serialize(Quotation, null)).toBeNull();
  });

  it("plain() converts nested ids and decimals, keeps dates and Json", () => {
    const when = new Date("2026-11-05T10:00:00.000Z");
    const out = plain({ _id: id(), __v: 0, amount: mongoose.Types.Decimal128.fromString("30.00"), at: when, meta: { a: [1, 2] }, list: [{ _id: id() }] });
    expect(out.id).toMatch(/^[a-f0-9]{24}$/);
    expect(out.__v).toBeUndefined();
    expect(out.amount).toBe("30.00");
    expect(out.at).toBe(when);
    expect(out.meta).toEqual({ a: [1, 2] });
    expect(out.list[0].id).toMatch(/^[a-f0-9]{24}$/);
  });

  it("money() and page() follow the contract", () => {
    expect(money("1234.5")).toBe("1234.50");
    expect(money(mongoose.Types.Decimal128.fromString("87.255"), 2)).toBe("87.26");
    expect(money(null)).toBeNull();
    expect(page({ items: [], total: 0, page: 1, pageSize: 10 })).toEqual({ items: [], total: 0, page: 1, pageSize: 10, pages: 1 });
    expect(page({ items: [], total: 41, page: 2, pageSize: 20 }, { withPageSize: false })).toEqual({ items: [], total: 41, page: 2, pages: 3 });
  });
});
