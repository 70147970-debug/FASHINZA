/**
 * Server foundation against a real MongoDB (replica set rs0, database name containing "test"):
 * indexes, transactions, sessions over HTTP, event helpers and tenant scoping.
 */
import { beforeEach, describe, expect, it } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import mongoose from "mongoose";
import { isDuplicateKeyError, withTransaction } from "../../src/db.js";
import { notify, notifyAdmins, logActivity, audit } from "../../src/lib/events.js";
import { disputeFilter, projectFilter, quotationFilter } from "../../src/lib/access.js";
import { requireOnboardedUser, requireUser } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/middleware/errors.js";
import { createSession, destroySession, getCurrentUser } from "../../src/auth/session.js";
import { sha256 } from "../../src/auth/password.js";
import {
  ActivityLog, AuditLog, IssueReport, MatchResult, Notification, Order, Project, ProjectAttachment, Quotation, Session, User, WebhookEvent,
} from "../../src/models/index.js";
import { resetDb } from "../support/db.js";
import { sessionCookie } from "../support/http.js";

beforeEach(resetDb);

const user = (o = {}) => User.create({ name: "U", email: `${new mongoose.Types.ObjectId()}@example.test`, ...o });
const actorOf = (u) => ({ id: u._id.toHexString(), role: u.role, name: u.name, email: u.email, profileCompleted: u.profileCompleted });
const project = (brandId, o = {}) => Project.create({ brandId, name: "Tee", category: "T_SHIRTS", ...o });

describe("indexes", () => {
  it("enforces one order per project and each webhook event once", async () => {
    const brand = await user();
    const m = await user({ role: "MANUFACTURER" });
    const p = await project(brand._id);
    const base = { projectId: p._id, brandId: brand._id, manufacturerId: m._id, quantity: 1, unitPrice: "1", currency: "USD", expectedCompletionDate: new Date() };
    await Order.create({ ...base, reference: "FZ-1", quotationId: new mongoose.Types.ObjectId() });
    const dup = await Order.create({ ...base, reference: "FZ-2", quotationId: new mongoose.Types.ObjectId() }).catch((e) => e);
    expect(isDuplicateKeyError(dup)).toBe(true);
    await WebhookEvent.create({ provider: "sandbox", eventId: "evt_1", type: "payment.succeeded", payload: {}, signatureValid: true });
    const again = await WebhookEvent.create({ provider: "sandbox", eventId: "evt_1", type: "payment.succeeded", payload: {}, signatureValid: true }).catch((e) => e);
    expect(isDuplicateKeyError(again)).toBe(true);
  });

  it("allows many unversioned attachments but each tech pack version once", async () => {
    const brand = await user();
    const p = await project(brand._id);
    const att = (o) => ProjectAttachment.create({ projectId: p._id, uploadedById: brand._id, fileKey: `projects/${new mongoose.Types.ObjectId()}00000000.pdf`, fileName: "a.pdf", mimeType: "application/pdf", size: 1, ...o });
    await att({ kind: "OTHER" });
    await att({ kind: "OTHER" });
    await att({ kind: "TECH_PACK", version: 1 });
    expect(isDuplicateKeyError(await att({ kind: "TECH_PACK", version: 1 }).catch((e) => e))).toBe(true);
  });

  it("round-trips Decimal128 money at the column scale", async () => {
    const brand = await user();
    const p = await project(brand._id, { targetUnitPrice: "4.5" });
    const lean = await Project.findById(p._id).lean();
    expect(lean.targetUnitPrice.toString()).toBe("4.50");
    expect((await Project.findById(p._id)).toJSON().targetUnitPrice).toBe("4.50");
  });
});

describe("withTransaction", () => {
  it("commits on success and rolls back every write on failure", async () => {
    const id = await withTransaction(async (session) => {
      const [u] = await User.create([{ name: "T", email: "t@example.test" }], { session });
      await notify(session, u._id.toHexString(), "SYSTEM", "Hi", "There");
      return u._id;
    });
    expect(await Notification.countDocuments({ userId: id })).toBe(1);

    await expect(
      withTransaction(async (session) => {
        await User.create([{ name: "R", email: "rollback@example.test" }], { session });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await User.countDocuments({ email: "rollback@example.test" })).toBe(0);
  });
});

describe("sessions over HTTP", () => {
  const app = express();
  app.use(cookieParser());
  app.post("/login/:id", async (req, res) => {
    await createSession(res, req.params.id, { ip: "203.0.113.1", userAgent: "vitest" });
    res.json({ ok: true });
  });
  app.post("/logout", async (req, res) => {
    await destroySession(req, res);
    res.json({ ok: true });
  });
  app.get("/me", async (req, res) => res.json({ user: await getCurrentUser(req) }));
  app.get("/onboarded", requireOnboardedUser(), (req, res) => res.json(req.actor));
  app.get("/admin", requireUser(["ADMIN"]), (req, res) => res.json(req.actor));
  app.use(errorHandler);

  it("creates a hashed session, resolves the actor and deletes it on logout", async () => {
    const u = await user({ profileCompleted: true });
    const login = await request(app).post(`/login/${u._id}`);
    const cookie = login.headers["set-cookie"][0].split(";")[0];
    const token = cookie.split("=")[1];
    const row = await Session.findOne({ userId: u._id }).lean();
    expect(row.token).toBe(sha256(token));
    expect((await request(app).get("/me").set("Cookie", cookie)).body.user).toEqual(actorOf(u));
    expect((await request(app).get("/onboarded").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get("/admin").set("Cookie", cookie)).body.error.code).toBe("ROLE_DENIED");
    await request(app).post("/logout").set("Cookie", cookie);
    expect(await Session.countDocuments({ userId: u._id })).toBe(0);
    expect((await request(app).get("/me").set("Cookie", cookie)).body.user).toBeNull();
  });

  it("rejects expired sessions, suspended users and incomplete profiles", async () => {
    const u = await user();
    const expired = await sessionCookie(u._id, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).get("/onboarded").set("Cookie", expired)).status).toBe(401);
    const fresh = await sessionCookie(u._id);
    expect((await request(app).get("/onboarded").set("Cookie", fresh)).body.error.code).toBe("PROFILE_INCOMPLETE");
    await User.updateOne({ _id: u._id }, { status: "SUSPENDED" });
    expect((await request(app).get("/onboarded").set("Cookie", fresh)).body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("event helpers", () => {
  it("notifyAdmins reaches only active administrators; activity and audit rows are written", async () => {
    const active = await user({ role: "ADMIN" });
    await user({ role: "ADMIN", status: "SUSPENDED" });
    await notifyAdmins(undefined, "DISPUTE_UPDATE", "New dispute", "…", "/admin/disputes/x");
    expect(await Notification.find().lean()).toHaveLength(1);
    expect(String((await Notification.findOne().lean()).userId)).toBe(active._id.toHexString());
    await logActivity(undefined, { actorId: null, type: "MILESTONE_DELAYED", message: "Late" });
    await audit(undefined, { actorId: active._id.toHexString(), action: "USER_SUSPENDED", targetType: "User", targetId: active._id.toHexString() });
    expect(await ActivityLog.countDocuments()).toBe(1);
    expect((await AuditLog.findOne().lean()).reason).toBeNull();
  });
});

describe("tenant scoping", () => {
  it("manufacturers see matched or quoted non-draft projects only; brands never see drafts of quotations", async () => {
    const brand = await user({ profileCompleted: true });
    const m = await user({ role: "MANUFACTURER", profileCompleted: true });
    const other = await user({ role: "MANUFACTURER", profileCompleted: true });
    const matched = await project(brand._id, { status: "QUOTING" });
    const quoted = await project(brand._id, { status: "QUOTING" });
    const draft = await project(brand._id, { status: "DRAFT" });
    await project(brand._id, { status: "QUOTING" }); // unrelated
    await MatchResult.create({ projectId: matched._id, manufacturerId: m._id, score: "80", breakdown: {}, algorithm: "rules-v1" });
    await MatchResult.create({ projectId: draft._id, manufacturerId: m._id, score: "80", breakdown: {}, algorithm: "rules-v1" });
    const q = { manufacturerId: m._id, unitPrice: "1", currency: "USD", minQuantity: 1, productionDays: 1, validUntil: new Date() };
    await Quotation.create({ ...q, projectId: quoted._id, status: "DRAFT" });
    await Quotation.create({ ...q, projectId: matched._id, status: "SUBMITTED" });

    const visible = await Project.find(await projectFilter(actorOf(m))).lean();
    expect(visible.map((p) => String(p._id)).sort()).toEqual([String(matched._id), String(quoted._id)].sort());
    expect(await Project.countDocuments(await projectFilter(actorOf(other)))).toBe(0);
    expect(await Project.countDocuments(await projectFilter(actorOf(brand)))).toBe(4);
    const brandQuotes = await Quotation.find(await quotationFilter(actorOf(brand))).lean();
    expect(brandQuotes.map((x) => x.status)).toEqual(["SUBMITTED"]);
  });

  it("disputes are visible to the reporter, the order's parties and the brand of the project", async () => {
    const brand = await user();
    const m = await user({ role: "MANUFACTURER" });
    const stranger = await user();
    const p = await project(brand._id, { status: "IN_PRODUCTION" });
    const order = await Order.create({ reference: "FZ-9", projectId: p._id, quotationId: new mongoose.Types.ObjectId(), brandId: brand._id, manufacturerId: m._id, quantity: 1, unitPrice: "1", currency: "USD", expectedCompletionDate: new Date() });
    await IssueReport.create({ reporterId: m._id, orderId: order._id, subject: "Late", description: "Fabric delayed" });
    await IssueReport.create({ reporterId: stranger._id, projectId: p._id, subject: "X", description: "Y" });
    expect(await IssueReport.countDocuments(await disputeFilter(actorOf(brand)))).toBe(2);
    expect(await IssueReport.countDocuments(await disputeFilter(actorOf(m)))).toBe(1);
    expect(await IssueReport.countDocuments(await disputeFilter(actorOf(stranger)))).toBe(1);
  });
});
