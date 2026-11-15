/**
 * Brand approval (MERN addition, services/brand-approval.js): new brands start PENDING, cannot create, edit or
 * submit projects until an administrator approves them (403 BRAND_NOT_APPROVED), and every decision is audited
 * and sent to the brand. Also covers the administrators' read-only access to every project and order.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Emails are captured instead of being sent or logged.
const mail = vi.hoisted(() => ({ sent: /** @type {{ to: string | string[], subject: string, text: string }[]} */ ([]) }));
vi.mock("../../src/lib/mail.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sendMailInBackground: (m) => void mail.sent.push(m),
    sendMail: async (m) => {
      mail.sent.push(m);
      return { sent: false };
    },
  };
});

const { createApp } = await import("../../src/app.js");
const { registerAccount, currentUserSummary } = await import("../../src/services/accounts.js");
const { addAttachment, cancelProject, deleteDraft, getProject, saveProject, submitProject } = await import("../../src/services/projects.js");
const { assertBrandApproved, countBrandsByApproval, decideBrandApproval, getBrand, listBrands } = await import("../../src/services/brand-approval.js");
const { listAllProjects } = await import("../../src/services/admin.js");
const { adminDashboard } = await import("../../src/services/dashboard.js");
const { getOrder } = await import("../../src/services/orders.js");
const { resetRateLimits } = await import("../../src/lib/rate-limit.js");
const { AuditLog, Notification, Project, User } = await import("../../src/models/index.js");
const { makeAdmin, makeBrand, makeFactory, makeOrder, makeSubmittedProject, makeUser, pdfFile, PASSWORD, resetDb } = await import("../support/fixtures.js");
const { sameOrigin, sessionCookie } = await import("../support/http.js");

const PENDING_MESSAGE = "Your brand is waiting for approval (usually 24–48 hours). You can create projects once it's approved.";
const REJECTED_MESSAGE = "Your brand was not approved. Contact us if you think this is a mistake.";

beforeEach(async () => {
  await resetDb();
  resetRateLimits();
  mail.sent.length = 0;
});

const app = createApp({ clientDistDir: "/nonexistent-client-dist", publicDir: "/nonexistent-public" });

describe("registration", () => {
  it("creates brands PENDING, tells every active administrator and keeps other accounts approved", async () => {
    const admin = await makeAdmin();
    const second = await makeAdmin();
    await User.updateOne({ _id: second.id }, { $set: { status: "SUSPENDED" } });
    const id = await registerAccount({ role: "BRAND", name: "Ayesha Khan", organization: "Loom & Line", email: "ayesha@example.test", password: PASSWORD, confirmPassword: PASSWORD });
    expect(await User.findById(id).lean()).toMatchObject({ approvalStatus: "PENDING" });
    const notes = await Notification.find({ userId: admin.id }).lean();
    expect(notes).toEqual([expect.objectContaining({ title: "New brand awaiting approval", link: `/admin/brands/${id}` })]);
    expect(await Notification.countDocuments({ userId: second.id })).toBe(0);
    // The administrators' email is sent after the transaction.
    expect(mail.sent).toEqual([expect.objectContaining({ to: [admin.email], subject: "New brand awaiting approval: Loom & Line" })]);
    expect(mail.sent[0].text).toContain(`/admin/brands/${id}`);
    // The brand's own welcome notification explains the review.
    expect((await Notification.findOne({ userId: id }).lean()).message).toMatch(/within 24–48 hours/);

    const factory = await makeUser("MANUFACTURER");
    expect(await User.findById(factory.id).lean()).toMatchObject({ approvalStatus: "APPROVED" });
    expect(await Notification.countDocuments({ userId: admin.id })).toBe(1);
  });

  it("lets trusted callers (the demo seed) create an approved brand without a review request", async () => {
    const admin = await makeAdmin();
    const id = await registerAccount(
      { role: "BRAND", name: "Demo Brand Manager", organization: "Demo Brand (Demo)", email: "demo@example.test", password: PASSWORD, confirmPassword: PASSWORD },
      { approved: true },
    );
    expect(await User.findById(id).lean()).toMatchObject({ approvalStatus: "APPROVED" });
    expect(await Notification.countDocuments({ userId: admin.id })).toBe(0);
    expect(mail.sent).toEqual([]);
  });

  it("reads users without the field (created before approvals) as approved", async () => {
    const brand = await makeBrand({ approved: false });
    await User.collection.updateOne({ _id: (await User.findById(brand.id))._id }, { $unset: { approvalStatus: "" } });
    await expect(assertBrandApproved(brand)).resolves.toBeUndefined();
    expect(await currentUserSummary(brand)).toMatchObject({ approvalStatus: "APPROVED", approvalNote: null });
  });
});

describe("project gating", () => {
  it("refuses to create projects for a pending brand, with the waiting message", async () => {
    const brand = await makeBrand({ approved: false });
    await expect(saveProject(brand, null, { name: "Organic tee", category: "T_SHIRTS" }, 1)).rejects.toMatchObject({
      code: "BRAND_NOT_APPROVED",
      message: PENDING_MESSAGE,
    });
    expect(await Project.countDocuments()).toBe(0);

    const cookie = await sessionCookie(brand.id);
    const res = await sameOrigin(request(app).post("/api/projects/save-step"))
      .set("Cookie", cookie)
      .send({ step: 1, name: "Organic tee", category: "T_SHIRTS", description: "" });
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "BRAND_NOT_APPROVED", message: PENDING_MESSAGE });
    // The profile stays editable while waiting.
    const profile = await sameOrigin(request(app).put("/api/profile/brand"))
      .set("Cookie", cookie)
      .send({ companyName: "North Thread", country: "United Kingdom", city: "", website: "", phone: "", description: "" });
    expect(profile.body).toEqual({ ok: true, message: "Company profile saved." });
    // GET /api/auth/me tells the client.
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.body.user).toMatchObject({ role: "BRAND", approvalStatus: "PENDING", approvalNote: null });
  });

  it("stops edits, files and submission when approval is withdrawn, but allows cancelling and deleting drafts", async () => {
    const admin = await makeAdmin();
    const brand = await makeBrand();
    const draftId = await saveProject(brand, null, { name: "Draft tee", category: "T_SHIRTS" }, 1);
    const otherDraft = await saveProject(brand, null, { name: "Second draft", category: "T_SHIRTS" }, 1);
    await makeFactory(admin);
    const { projectId } = await makeSubmittedProject(brand);
    await decideBrandApproval(admin, brand.id, "REJECTED", "We could not confirm the company.");

    const refused = { code: "BRAND_NOT_APPROVED", message: REJECTED_MESSAGE };
    await expect(saveProject(brand, null, { name: "New tee", category: "T_SHIRTS" }, 1)).rejects.toMatchObject(refused);
    await expect(saveProject(brand, draftId, { name: "Renamed tee", category: "T_SHIRTS" }, 1)).rejects.toMatchObject(refused);
    await expect(submitProject(brand, draftId)).rejects.toMatchObject(refused);
    await expect(addAttachment(brand, draftId, pdfFile(), "TECH_PACK")).rejects.toMatchObject(refused);
    // Reading, cancelling and deleting stay possible.
    expect((await getProject(brand, draftId)).name).toBe("Draft tee");
    await deleteDraft(brand, otherDraft);
    await cancelProject(brand, projectId, "Brand not approved");
    expect((await Project.findById(projectId).lean()).status).toBe("CANCELLED");

    const me = await request(app).get("/api/auth/me").set("Cookie", await sessionCookie(brand.id));
    expect(me.body.user).toMatchObject({ approvalStatus: "REJECTED", approvalNote: "We could not confirm the company." });
  });
});

describe("administrator decisions", () => {
  it("approves a brand: verified, audited, notified in the app and by email", async () => {
    const admin = await makeAdmin();
    const brand = await makeBrand({ approved: false });
    mail.sent.length = 0;
    await decideBrandApproval(admin, brand.id, "APPROVED", "  Website and registry checked.  ");
    const user = await User.findById(brand.id).lean();
    expect(user).toMatchObject({ approvalStatus: "APPROVED", approvalNote: "Website and registry checked." });
    expect(user.approvalReviewedAt).toBeInstanceOf(Date);
    expect(String(user.approvalReviewedById)).toBe(admin.id);
    expect(await AuditLog.findOne({ targetId: brand.id }).lean()).toMatchObject({
      action: "BRAND_APPROVED",
      actorId: expect.anything(),
      targetType: "User",
      reason: "Website and registry checked.",
      metadata: { from: "PENDING", to: "APPROVED" },
    });
    const note = await Notification.findOne({ userId: brand.id, title: "Your brand is approved" }).lean();
    expect(note).toMatchObject({ type: "VERIFICATION_DECISION", link: "/projects/new" });
    expect(note.message).toContain("Website and registry checked.");
    expect(mail.sent).toEqual([expect.objectContaining({ to: brand.email, subject: "Your brand is approved on Fashinza" })]);
    // Now it can create projects.
    await expect(saveProject(brand, null, { name: "Organic tee", category: "T_SHIRTS" }, 1)).resolves.toEqual(expect.any(String));
    // Repeating the same decision is refused; revisiting it is allowed.
    await expect(decideBrandApproval(admin, brand.id, "APPROVED")).rejects.toMatchObject({ code: "CONFLICT", message: "This brand is already approved." });
  });

  it("rejects only with a reason, which the brand receives, and allows a later approval", async () => {
    const admin = await makeAdmin();
    const brand = await makeBrand({ approved: false });
    mail.sent.length = 0;
    await expect(decideBrandApproval(admin, brand.id, "REJECTED", "   ")).rejects.toMatchObject({
      code: "INVALID",
      fieldErrors: { note: "Give a reason for rejecting the brand." },
    });
    await decideBrandApproval(admin, brand.id, "REJECTED", "The website does not exist.");
    expect(await User.findById(brand.id).lean()).toMatchObject({ approvalStatus: "REJECTED", approvalNote: "The website does not exist." });
    expect(await AuditLog.findOne({ targetId: brand.id, action: "BRAND_REJECTED" }).lean()).toMatchObject({ reason: "The website does not exist." });
    expect(await Notification.findOne({ userId: brand.id, title: "Brand not approved" }).lean()).toMatchObject({ message: "The website does not exist." });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: brand.email, subject: "Your Fashinza brand registration" });
    expect(mail.sent[0].text).toContain("Reason: The website does not exist.");

    await decideBrandApproval(admin, brand.id, "APPROVED");
    expect(await User.findById(brand.id).lean()).toMatchObject({ approvalStatus: "APPROVED", approvalNote: null });
    expect(await AuditLog.countDocuments({ targetId: brand.id, action: { $in: ["BRAND_APPROVED", "BRAND_REJECTED"] } })).toBe(2);
  });

  it("is only for administrators, and only for brands", async () => {
    const admin = await makeAdmin();
    const brand = await makeBrand({ approved: false });
    const factory = await makeUser("MANUFACTURER");
    await expect(decideBrandApproval(brand, brand.id, "APPROVED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listBrands(factory)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(decideBrandApproval(admin, factory.id, "APPROVED")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBrand(admin, "not-an-id")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists brands by approval status, newest first, with search and tab counts", async () => {
    const admin = await makeAdmin();
    const older = await makeBrand({ approved: false });
    const approved = await makeBrand();
    const newer = await makeBrand({ approved: false });
    await User.updateOne({ _id: older.id }, { $set: { createdAt: new Date(Date.now() - 3 * 86400000) } });
    const pending = await listBrands(admin, { status: "PENDING" });
    expect(pending.items.map((b) => b.id)).toEqual([newer.id, older.id]);
    expect(pending.items[0]).toMatchObject({ approvalStatus: "PENDING", projectCount: 0, brandProfile: { companyName: expect.stringMatching(/^Brand /) } });
    expect((await listBrands(admin, { status: "APPROVED" })).items.map((b) => b.id)).toEqual([approved.id]);
    expect((await listBrands(admin, {})).total).toBe(3);
    expect(await countBrandsByApproval(admin)).toEqual({ PENDING: 2, APPROVED: 1, REJECTED: 0 });
    // Search by email, person or company name.
    expect((await listBrands(admin, { q: older.email.toUpperCase() })).items.map((b) => b.id)).toEqual([older.id]);
    const company = (await getBrand(admin, newer.id)).profile.companyName;
    expect((await listBrands(admin, { q: company })).items.map((b) => b.id)).toContain(newer.id);
    expect((await adminDashboard(admin)).pendingBrands).toBe(2);
  });

  it("serves the queue, the review page and decisions over HTTP to administrators only", async () => {
    const admin = await makeAdmin();
    const brand = await makeBrand({ approved: false });
    const adminCookie = await sessionCookie(admin.id);

    const queue = await request(app).get("/api/admin/brands").set("Cookie", adminCookie);
    expect(queue.status).toBe(200);
    expect(queue.body).toMatchObject({ status: "PENDING", total: 1, counts: { PENDING: 1, APPROVED: 0, REJECTED: 0 }, items: [{ id: brand.id }] });
    const all = await request(app).get("/api/admin/brands?status=ALL").set("Cookie", adminCookie);
    expect(all.body).toMatchObject({ status: null, total: 1 });

    const review = await request(app).get(`/api/admin/brands/${brand.id}`).set("Cookie", adminCookie);
    expect(review.body).toMatchObject({
      brand: { id: brand.id, email: brand.email, approvalStatus: "PENDING", profileCompleted: true },
      profile: { companyName: expect.any(String), country: "United Kingdom", socialLinks: [] },
      projects: { total: 0, recent: [], activeOrders: 0 },
      history: [],
    });

    const missing = await sameOrigin(request(app).post(`/api/admin/brands/${brand.id}/approval`)).set("Cookie", adminCookie).send({ decision: "REJECTED" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fieldErrors).toEqual({ note: "Give a reason for rejecting the brand." });
    const approve = await sameOrigin(request(app).post(`/api/admin/brands/${brand.id}/approval`)).set("Cookie", adminCookie).send({ decision: "APPROVED", note: "" });
    expect(approve.body).toEqual({ ok: true, message: "Brand approved. The brand has been notified by email and in the app." });
    const after = await request(app).get(`/api/admin/brands/${brand.id}`).set("Cookie", adminCookie);
    expect(after.body.brand).toMatchObject({ approvalStatus: "APPROVED", approvalReviewedBy: { name: "Admin" } });
    expect(after.body.history).toEqual([expect.objectContaining({ action: "BRAND_APPROVED", actor: { name: "Admin" } })]);

    const brandCookie = await sessionCookie(brand.id);
    expect((await request(app).get("/api/admin/brands").set("Cookie", brandCookie)).body.error.code).toBe("ROLE_DENIED");
    const forged = await sameOrigin(request(app).post(`/api/admin/brands/${brand.id}/approval`)).set("Cookie", brandCookie).send({ decision: "APPROVED" });
    expect(forged.status).toBe(403);
  });
});

describe("administrators can open every project and order", () => {
  it("lists every project and opens drafts, submitted projects and orders read-only", async () => {
    const { admin, brand, projectId, order } = await makeOrder();
    const other = await makeBrand();
    const draftId = await saveProject(other, null, { name: "Private draft", category: "DENIM" }, 1);

    const all = await listAllProjects(admin);
    expect(all.items.map((p) => p.id).sort()).toEqual([projectId, draftId].sort());
    expect(all.items.find((p) => p.id === projectId)).toMatchObject({ brand: { id: brand.id, approvalStatus: "APPROVED" }, order: { id: order.id } });
    expect((await listAllProjects(admin, { status: "DRAFT" })).items.map((p) => p.id)).toEqual([draftId]);
    expect((await listAllProjects(admin, { status: "ACTIVE" })).items.map((p) => p.id)).toEqual([projectId]);
    expect((await listAllProjects(admin, { q: "private" })).items.map((p) => p.id)).toEqual([draftId]);
    expect(all.counts).toMatchObject({ DRAFT: 1 });
    await expect(listAllProjects(brand)).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect((await getProject(admin, draftId)).name).toBe("Private draft");
    expect((await getOrder(admin, order.id)).id).toBe(order.id);

    const cookie = await sessionCookie(admin.id);
    for (const id of [draftId, projectId]) {
      const res = await request(app).get(`/api/projects/${id}/detail`).set("Cookie", cookie);
      expect(res.status, id).toBe(200);
      expect(res.body.project.id).toBe(id);
    }
    expect((await request(app).get(`/api/orders/${order.id}`).set("Cookie", cookie)).body.order.id).toBe(order.id);
    const list = await request(app).get("/api/admin/projects?status=ACTIVE").set("Cookie", cookie);
    expect(list.body).toMatchObject({ total: 1, items: [{ id: projectId }] });
    // Read-only: administrators cannot change a brand's project.
    const save = await sameOrigin(request(app).post("/api/projects/save-step")).set("Cookie", cookie).send({ step: 1, projectId: draftId, name: "Changed", category: "DENIM" });
    expect(save.body.error.code).toBe("ROLE_DENIED");
  });
});
