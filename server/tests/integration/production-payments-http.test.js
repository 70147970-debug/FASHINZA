/**
 * HTTP layer of the SERVER-B endpoints (orders, samples/QC, payments, sandbox checkout, webhooks, disputes,
 * notifications, dashboard, admin) against MongoDB: status codes, error shapes, messages, redirects and the
 * nesting of the page-data responses.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { addEvidence, completeEvidenceStage } from "../../src/services/orders.js";
import { reviewSample, submitSample } from "../../src/services/quality.js";
import { buildSandboxEvent, setSandboxWebhookBase } from "../../src/payments/provider.js";
import { ContactInquiry, ManufacturerProfile, Notification, PaymentMilestone, PaymentTransaction, WebhookEvent } from "../../src/models/index.js";
import { idOf } from "../../src/lib/ids.js";
import { makeFactory, makeOrder, pngFile, resetDb } from "../support/fixtures.js";
import { sameOrigin, sessionCookie } from "../support/http.js";

const app = createApp();
let server;

beforeAll(async () => {
  // Sandbox checkout and refunds deliver their webhook over HTTP to this server.
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  setSandboxWebhookBase(`http://127.0.0.1:${server.address().port}`);
});
afterAll(async () => {
  setSandboxWebhookBase(null);
  await new Promise((r) => server.close(r));
});
beforeEach(resetDb);

const get = (path, cookie) => request(app).get(path).set("Cookie", cookie);
const post = (path, cookie) => sameOrigin(request(app).post(path)).set("Cookie", cookie);
const put = (path, cookie) => sameOrigin(request(app).put(path)).set("Cookie", cookie);

async function orderContext() {
  const ctx = await makeOrder();
  return {
    ...ctx,
    orderId: idOf(ctx.order),
    brandCookie: await sessionCookie(ctx.brand.id),
    factoryCookie: await sessionCookie(ctx.factory.id),
    adminCookie: await sessionCookie(ctx.admin.id),
  };
}

async function toCutting(ctx) {
  await addEvidence(ctx.factory, ctx.orderId, "FABRIC_SOURCING", pngFile());
  await completeEvidenceStage(ctx.factory, ctx.orderId, "FABRIC_SOURCING");
  const s = await submitSample(ctx.factory, ctx.orderId, { description: "Pre-production sample in size M, black." }, [pngFile()]);
  await reviewSample(ctx.brand, s.id, "APPROVED");
}

describe("orders", () => {
  it("lists and returns orders with the original relation tree, scoped to the parties", async () => {
    const ctx = await orderContext();
    const list = await get("/api/orders?status=ACTIVE", ctx.brandCookie);
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ total: 1, page: 1, pageSize: 10, pages: 1 });
    const item = list.body.items[0];
    expect(item).toMatchObject({ id: ctx.orderId, project: { name: "Organic tee", category: "T_SHIRTS" }, brand: { brandProfile: { companyName: expect.any(String) } } });
    expect(item.manufacturer.manufacturerProfile.businessName).toMatch(/^Factory/);
    expect(item.milestones).toHaveLength(8);
    expect(Object.keys(item.milestones[0]).sort()).toEqual(["completedAt", "isDelayed", "plannedEnd", "stage", "status"]);
    expect(item.totalAmount).toBe("3320.50");

    const detail = await get(`/api/orders/${ctx.orderId}`, ctx.factoryCookie);
    expect(detail.status).toBe(200);
    const o = detail.body.order;
    expect(o.milestones.map((m) => m.stage)[0]).toBe("FABRIC_SOURCING");
    expect(o.paymentMilestones.map((p) => [p.sequence, p.percentage, p.amount])).toEqual([
      [1, "30.00", "996.15"],
      [2, "40.00", "1328.20"],
      [3, "30.00", "996.15"],
    ]);
    expect(o.project.attachments[0]).toMatchObject({ kind: "TECH_PACK", version: 1 });
    expect(o.brand).toEqual({ name: ctx.brand.name, brandProfile: { companyName: expect.any(String) } });
    expect(o.activities[0]).toMatchObject({ type: "ORDER_CREATED", actor: { name: ctx.brand.name } });

    const outsider = await makeFactory(ctx.admin, { categories: ["DENIM"] });
    const outsiderCookie = await sessionCookie(outsider.id);
    const denied = await get(`/api/orders/${ctx.orderId}`, outsiderCookie);
    expect(denied.status).toBe(404);
    expect(denied.body).toEqual({ error: { code: "NOT_FOUND", message: "Order was not found or you do not have access to it." } });
    expect((await get("/api/orders/not-an-id", ctx.brandCookie)).status).toBe(404);
    expect((await request(app).get("/api/orders")).status).toBe(401);
  });

  it("uploads evidence with today's messages and order of checks", async () => {
    const ctx = await orderContext();
    const url = `/api/orders/${ctx.orderId}/evidence`;
    const none = await post(url, ctx.factoryCookie).field("stage", "FABRIC_SOURCING");
    expect(none.status).toBe(400);
    expect(none.body.error).toEqual({ code: "INVALID", message: "Choose a photo or document.", fieldErrors: { file: "Choose a photo or document." } });
    const png = pngFile();
    const badStage = await post(url, ctx.factoryCookie).field("stage", "NOPE").attach("file", png.buffer, { filename: "a.png", contentType: "image/png" });
    expect(badStage.body.error).toEqual({ code: "INVALID", message: "Unknown stage." });
    const wrongStage = await post(url, ctx.factoryCookie).field("stage", "CUTTING").attach("file", png.buffer, { filename: "a.png", contentType: "image/png" });
    expect(wrongStage.status).toBe(409);
    expect(wrongStage.body.error.message).toBe("Evidence can only be added to the current stage.");
    const brandTry = await post(url, ctx.brandCookie).field("stage", "FABRIC_SOURCING");
    expect(brandTry.status).toBe(403);
    expect(brandTry.body.error.code).toBe("ROLE_DENIED");

    const added = await post(url, ctx.factoryCookie)
      .field("stage", "FABRIC_SOURCING")
      .field("note", "Fabric arrived")
      .attach("file", png.buffer, { filename: "a.png", contentType: "image/png" })
      .attach("file", png.buffer, { filename: "b.png", contentType: "image/png" });
    expect(added.status).toBe(200);
    expect(added.body).toEqual({ ok: true, message: "2 evidence files added." });

    const done = await post(`/api/orders/${ctx.orderId}/stages/complete`, ctx.factoryCookie).send({ stage: "FABRIC_SOURCING", note: "  " });
    expect(done.body).toEqual({ ok: true, message: "Stage completed. The brand has been notified." });
    const again = await post(`/api/orders/${ctx.orderId}/stages/complete`, ctx.factoryCookie).send({ stage: "SAMPLING" });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe("Sampling completes when the brand approves a sample.");
  });

  it("validates samples, QC defect lists and the payment schedule like the original actions", async () => {
    const ctx = await orderContext();
    const noPhotos = await post(`/api/orders/${ctx.orderId}/samples`, ctx.factoryCookie).field("description", "A sample without photos attached.");
    expect(noPhotos.body.error).toEqual({ code: "INVALID", message: "Add at least one photo of the sample.", fieldErrors: { photos: "Add at least one photo of the sample." } });

    const qc = await post(`/api/orders/${ctx.orderId}/qc-reports`, ctx.factoryCookie).field("defects", "{not json");
    expect(qc.body.error).toEqual({ code: "INVALID", message: "The defect list could not be read. Please re-enter it." });

    const unreadable = await put(`/api/orders/${ctx.orderId}/payment-schedule`, ctx.brandCookie).field("items", "[oops");
    expect(unreadable.body.error).toEqual({ code: "INVALID", message: "The schedule could not be read." });
    const wrongSum = await put(`/api/orders/${ctx.orderId}/payment-schedule`, ctx.brandCookie).send({
      items: [
        { label: "Deposit", percentage: 50, triggerStage: "SAMPLING" },
        { label: "Balance", percentage: 40, triggerStage: "DELIVERY" },
      ],
    });
    expect(wrongSum.status).toBe(400);
    expect(wrongSum.body.error.message).toBe("Shares must add up to 100%.");
    const sameStage = await put(`/api/orders/${ctx.orderId}/payment-schedule`, ctx.brandCookie).field(
      "items",
      JSON.stringify([
        { label: "Deposit", percentage: 50, triggerStage: "SAMPLING" },
        { label: "Balance", percentage: 50, triggerStage: "SAMPLING" },
      ]),
    );
    expect(sameStage.body.error.message).toBe("Each payment must be tied to a different stage.");
    const saved = await put(`/api/orders/${ctx.orderId}/payment-schedule`, ctx.brandCookie).field(
      "items",
      JSON.stringify([
        { label: "Deposit", percentage: 50, triggerStage: "SAMPLING" },
        { label: "Balance", percentage: 50, triggerStage: "DELIVERY" },
      ]),
    );
    expect(saved.body).toEqual({ ok: true, message: "Payment schedule updated." });
  });

  it("posts messages and notifies the other party", async () => {
    const ctx = await orderContext();
    const empty = await post(`/api/orders/${ctx.orderId}/messages`, ctx.brandCookie).send({ body: " " });
    expect(empty.body.error.fieldErrors).toEqual({ body: "Write a message." });
    const long = "x".repeat(150);
    const sent = await post(`/api/orders/${ctx.orderId}/messages`, ctx.brandCookie).send({ body: long });
    expect(sent.body).toEqual({ ok: true, message: "Message sent." });
    const note = await Notification.findOne({ userId: ctx.factory.id, type: "MESSAGE_RECEIVED" }).orFail().lean();
    expect(note.message).toBe(`${"x".repeat(137)}…`);
    expect(note.link).toBe(`/orders/${ctx.orderId}?tab=messages`);
  });
});

describe("payments", () => {
  it("checks out through the sandbox and records the result from the signed webhook", async () => {
    const ctx = await orderContext();
    await toCutting(ctx);
    const pm = (await PaymentMilestone.findOne({ orderId: ctx.orderId, sequence: 1 }).orFail()).toJSON();
    const started = await post(`/api/payments/milestones/${pm.id}/checkout`, ctx.brandCookie);
    expect(started.body.redirectTo).toMatch(/^\/sandbox-checkout\/sbx_pay_/);
    const ref = started.body.redirectTo.split("/").pop();

    const page = await get(`/api/sandbox-checkout/${ref}`, ctx.brandCookie);
    expect(page.body.txn).toMatchObject({ providerRef: ref, status: "PENDING", amount: "996.15", paymentMilestone: { id: pm.id, order: { id: ctx.orderId, project: { name: "Organic tee" } } } });
    expect((await get(`/api/sandbox-checkout/${ref}`, ctx.factoryCookie)).status).toBe(403);

    const paid = await post(`/api/sandbox-checkout/${ref}`, ctx.brandCookie).send({ outcome: "success" });
    expect(paid.body).toEqual({ ok: true, redirectTo: `/orders/${ctx.orderId}?payment=returned&tab=payments` });
    expect((await PaymentMilestone.findById(pm.id).orFail()).status).toBe("PAID");
    const twice = await post(`/api/sandbox-checkout/${ref}`, ctx.brandCookie).send({ outcome: "success" });
    expect(twice.body.error).toEqual({ code: "CONFLICT", message: "This checkout has already been completed." });

    const list = await get("/api/payments", ctx.factoryCookie);
    expect(list.body).toMatchObject({ total: 3, page: 1, pageSize: 20, pages: 1 });
    expect(list.body.items[0].order).toMatchObject({ id: ctx.orderId, project: { name: "Organic tee" } });
    expect(list.body.totals).toEqual([
      { currency: "USD", status: "SCHEDULED", _sum: { amount: "2324.35" } },
      { currency: "USD", status: "PAID", _sum: { amount: "996.15" } },
    ]);

    // Admin refund settles through the sandbox refund webhook.
    const refund = await post(`/api/admin/payments/milestones/${pm.id}/refund`, ctx.adminCookie).send({ reason: "Order cancelled by agreement" });
    expect(refund.body).toEqual({ ok: true, message: "Refund issued through the payment provider (test mode)." });
    expect((await PaymentMilestone.findById(pm.id).orFail()).status).toBe("REFUNDED");
    const overview = await get("/api/admin/payments", ctx.adminCookie);
    expect(overview.body.events).toHaveLength(2);
    expect(overview.body.refundable).toEqual([]);
  });

  it("rejects bad webhook signatures and unknown providers with today's status codes", async () => {
    const ctx = await orderContext();
    await toCutting(ctx);
    const pm = (await PaymentMilestone.findOne({ orderId: ctx.orderId, sequence: 1 }).orFail()).toJSON();
    await post(`/api/payments/milestones/${pm.id}/checkout`, ctx.brandCookie);
    const txn = (await PaymentTransaction.findOne({ paymentMilestoneId: pm.id }).orFail()).toJSON();
    const { body, signature } = buildSandboxEvent("payment.succeeded", { providerRef: txn.providerRef, amount: txn.amount, currency: txn.currency });

    const bad = await request(app).post("/api/webhooks/payments/sandbox").set("Content-Type", "application/json").set("x-fashinza-signature", "t=1,v1=deadbeef").send(body);
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ error: { code: "INVALID", message: "Webhook rejected: Signature timestamp outside tolerance." } });
    const unknown = await request(app).post("/api/webhooks/payments/stripe").set("Content-Type", "application/json").set("x-fashinza-signature", signature).send(body);
    expect(unknown.status).toBe(500);
    expect(unknown.body).toEqual({ error: { code: "INTERNAL", message: "Processing failed." } });

    // A foreign Origin does not matter for webhooks (no cross-site check).
    const good = await request(app).post("/api/webhooks/payments/sandbox").set("Origin", "https://provider.example").set("Content-Type", "application/json").set("x-fashinza-signature", signature).send(body);
    expect(good.status).toBe(200);
    expect(good.body).toEqual({ status: "processed" });
    const dup = await request(app).post("/api/webhooks/payments/sandbox").set("Content-Type", "application/json").set("x-fashinza-signature", signature).send(body);
    expect(dup.body).toEqual({ status: "duplicate" });
    expect(await WebhookEvent.countDocuments()).toBe(1);
  });

  it("stores the processing error on the event when the amount does not match", async () => {
    const ctx = await orderContext();
    await toCutting(ctx);
    const pm = (await PaymentMilestone.findOne({ orderId: ctx.orderId, sequence: 1 }).orFail()).toJSON();
    await post(`/api/payments/milestones/${pm.id}/checkout`, ctx.brandCookie);
    const txn = (await PaymentTransaction.findOne({ paymentMilestoneId: pm.id }).orFail()).toJSON();
    const { body, signature } = buildSandboxEvent("payment.succeeded", { providerRef: txn.providerRef, amount: "1.00", currency: txn.currency });
    const res = await request(app).post("/api/webhooks/payments/sandbox").set("Content-Type", "application/json").set("x-fashinza-signature", signature).send(body);
    expect(res.status).toBe(500);
    const event = await WebhookEvent.findOne().orFail().lean();
    expect(event.error).toBe(`Amount mismatch for ${txn.providerRef}.`);
    expect(event.processedAt).toBeNull();
    const overview = await get("/api/admin/overview", ctx.adminCookie);
    expect(overview.body.webhookErrors).toBe(1);
  });
});

describe("disputes, notifications, dashboard", () => {
  it("raises a dispute, lets the admin update it and opens notifications safely", async () => {
    const ctx = await orderContext();
    const missing = await post("/api/disputes", ctx.brandCookie).send({ category: "QUALITY", subject: "Something wrong", description: "A long enough description of the problem." });
    expect(missing.body.error).toEqual({ code: "INVALID", message: "Choose the order or project this dispute is about.", fieldErrors: { orderId: "Choose an order." } });
    const raised = await post("/api/disputes", ctx.brandCookie).send({ orderId: ctx.orderId, category: "DELIVERY", subject: "Fabric delayed", description: "Fabric sourcing is two weeks behind the plan." });
    expect(raised.body.redirectTo).toMatch(/^\/disputes\/[a-f0-9]{24}\?created=1$/);
    const id = raised.body.redirectTo.split("/")[2].split("?")[0];

    const detail = await get(`/api/disputes/${id}`, ctx.factoryCookie);
    expect(detail.body.dispute).toMatchObject({ id, status: "OPEN", reporter: { name: ctx.brand.name, role: "BRAND", email: ctx.brand.email }, order: { id: ctx.orderId } });
    const adminList = await get("/api/disputes?pageSize=20", ctx.adminCookie);
    expect(adminList.body).toMatchObject({ total: 1, pageSize: 20 });

    const noResolution = await post(`/api/admin/disputes/${id}`, ctx.adminCookie).send({ status: "RESOLVED" });
    expect(noResolution.body.error.fieldErrors).toEqual({ resolution: "Record the resolution before resolving or closing." });
    const updated = await post(`/api/admin/disputes/${id}`, ctx.adminCookie).send({ status: "IN_REVIEW", adminNote: "Checking with the factory." });
    expect(updated.body).toEqual({ ok: true, message: "Dispute updated and the parties notified." });
    expect((await post(`/api/admin/disputes/${id}`, ctx.brandCookie).send({ status: "CLOSED" })).status).toBe(403);

    const note = await Notification.findOne({ userId: ctx.factory.id, title: "Dispute in review" }).orFail().lean();
    expect(note.message).toBe("“Fabric delayed” is now in review.");
    const opened = await post(`/api/notifications/${idOf(note._id)}/open`, ctx.factoryCookie);
    expect(opened.body).toEqual({ ok: true, redirectTo: `/disputes/${id}` });
    expect((await Notification.findById(note._id).orFail().lean()).readAt).not.toBeNull();
    // Someone else's notification never opens (and stays unread).
    const brandNote = await Notification.findOne({ userId: ctx.brand.id }).orFail().lean();
    expect((await post(`/api/notifications/${idOf(brandNote._id)}/open`, ctx.factoryCookie)).body).toEqual({ ok: true, redirectTo: "/notifications" });
    expect((await post("/api/notifications/xyz/open", ctx.factoryCookie)).body.redirectTo).toBe("/notifications");

    const page = await get("/api/notifications?unread=1", ctx.factoryCookie);
    expect(page.body).toMatchObject({ page: 1, pageSize: 20 });
    expect(page.body.unreadTotal).toBe(page.body.total);
    expect((await post("/api/notifications/read-all", ctx.factoryCookie)).body).toEqual({ ok: true });
    expect((await get("/api/notifications", ctx.factoryCookie)).body.unreadTotal).toBe(0);
  });

  it("serves both dashboards and keeps admins out", async () => {
    const ctx = await orderContext();
    const brand = await get("/api/dashboard", ctx.brandCookie);
    expect(brand.status).toBe(200);
    expect(brand.body).toMatchObject({ role: "BRAND", activeOrders: 1, isNew: false, recent: { total: 1 } });
    const factory = await get("/api/dashboard", ctx.factoryCookie);
    expect(factory.body).toMatchObject({ role: "MANUFACTURER", activeOrders: 1, profile: { verificationStatus: "VERIFIED" } });
    expect(factory.body.actionOrders[0]).toMatchObject({ id: ctx.orderId, project: { name: "Organic tee" } });
    expect(factory.body.stageStates[0]).toMatchObject({ id: ctx.orderId, currentStage: "FABRIC_SOURCING" });
    const adminTry = await get("/api/dashboard", ctx.adminCookie);
    expect(adminTry.status).toBe(403);
    expect(adminTry.body.error.code).toBe("ROLE_DENIED");
  });
});

describe("admin", () => {
  it("serves the factory queue, user list, audit trail and enquiries", async () => {
    const ctx = await orderContext();
    const queue = await get("/api/admin/factories", ctx.adminCookie);
    expect(queue.body).toMatchObject({ status: "PENDING", total: 0, counts: { VERIFIED: 1 } });
    const all = await get("/api/admin/factories?status=ALL", ctx.adminCookie);
    expect(all.body).toMatchObject({ status: null, total: 1 });
    expect(all.body.items[0]).toMatchObject({ _count: { documents: 1 }, user: { email: ctx.factory.email, status: "ACTIVE" } });
    const profile = await ManufacturerProfile.findOne({ userId: ctx.factory.id }).orFail().lean();
    const factory = await get(`/api/admin/factories/${idOf(profile._id)}`, ctx.adminCookie);
    expect(factory.body.profile.user).toMatchObject({ id: ctx.factory.id, email: ctx.factory.email });
    expect(factory.body.machinery).toEqual([
      { type: "Single-needle lockstitch", quantity: 40 },
      { type: "Overlock 4-thread", quantity: 12 },
    ]);
    expect(factory.body.history.map((h) => h.action)).toEqual(expect.arrayContaining(["FACTORY_VERIFIED", "DOCUMENT_VERIFIED"]));
    expect(factory.body.history[0].target.href).toBe(`/admin/factories/${idOf(profile._id)}`);
    expect((await get("/api/admin/factories/0123456789abcdef01234567", ctx.adminCookie)).body.error.message).toBe("Factory was not found or you do not have access to it.");

    const revoke = await post(`/api/admin/factories/${idOf(profile._id)}/revoke`, ctx.adminCookie).send({ reason: "no" });
    expect(revoke.body.error.fieldErrors).toEqual({ reason: "Give a reason (at least 5 characters)." });

    const users = await get(`/api/admin/users?q=${encodeURIComponent("factory")}`, ctx.adminCookie);
    expect(users.body.items.map((u) => u.id)).toContain(ctx.factory.id);
    const self = await post(`/api/admin/users/${ctx.admin.id}/status`, ctx.adminCookie).send({ status: "SUSPENDED", reason: "Testing myself" });
    expect(self.body.error).toEqual({ code: "CONFLICT", message: "You cannot change the status of your own account." });
    const suspended = await post(`/api/admin/users/${ctx.brand.id}/status`, ctx.adminCookie).send({ status: "SUSPENDED", reason: "Payment fraud review" });
    expect(suspended.body).toEqual({ ok: true, message: "Account suspended and signed out." });
    expect((await get("/api/orders", ctx.brandCookie)).status).toBe(401);

    const audit = await get("/api/admin/audit", ctx.adminCookie);
    expect(audit.body.types).toEqual(expect.arrayContaining(["ManufacturerDocument", "ManufacturerProfile", "User"]));
    expect(audit.body.items[0]).toMatchObject({ action: "USER_SUSPENDED", actor: { name: "Admin" } });

    const enquiry = await ContactInquiry.create({ name: "Ann", email: "ann@example.test", inquiryType: "brand", subject: "Pricing", message: "How much does it cost to start?" });
    const enquiries = await get("/api/admin/enquiries?status=NEW", ctx.adminCookie);
    expect(enquiries.body).toMatchObject({ total: 1, page: 1, pages: 1 });
    const moved = await post(`/api/admin/enquiries/${idOf(enquiry._id)}/status`, ctx.adminCookie).send({ status: "RESOLVED" });
    expect(moved.body).toEqual({ ok: true, message: "Enquiry updated." });
    expect((await get("/api/admin/qc", ctx.adminCookie)).body).toEqual({ failed: [], rejectedByBrand: [], openRework: [], pendingDecisions: 0 });
    expect((await get("/api/admin/overview", ctx.brandCookie)).status).toBe(401);
  });
});
