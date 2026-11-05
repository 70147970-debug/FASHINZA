/**
 * Port of tests/integration/auth-access.test.ts (same cases, same names) against MongoDB, plus HTTP checks of
 * the SERVER-A endpoints (cookies, status codes, error shape, tenant isolation, file headers).
 * Uses SERVER-B services where the original did (admin, orders, notifications).
 */
import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { authenticate, changePassword, createPasswordReset, registerAccount, resetPassword } from "../../src/services/accounts.js";
import { getProject, listProjects, saveProject } from "../../src/services/projects.js";
import { authorizeFile } from "../../src/services/files.js";
import { decideVerification, setUserStatus } from "../../src/services/admin.js";
import { getOrder, listOrders } from "../../src/services/orders.js";
import { listNotifications, markRead } from "../../src/services/notifications.js";
import { verifyPassword, sha256 } from "../../src/auth/password.js";
import { resetRateLimits } from "../../src/lib/rate-limit.js";
import { Account, AuditLog, BrandProfile, ManufacturerDocument, ManufacturerProfile, Notification, ProjectAttachment, Session, User, Verification } from "../../src/models/index.js";
import { makeAdmin, makeBrand, makeFactory, makeOrder, makeSubmittedProject, makeUser, PASSWORD, resetDb } from "../support/fixtures.js";
import { sameOrigin, sessionCookie } from "../support/http.js";

beforeEach(async () => {
  await resetDb();
  resetRateLimits();
});

describe("authentication", () => {
  it("registers an account with a hashed password and an organisation profile", async () => {
    const id = await registerAccount({ role: "BRAND", name: "Ayesha Khan", organization: "Loom & Line", email: "ayesha@example.test", password: "Password123", confirmPassword: "Password123" });
    const account = await Account.findOne({ userId: id }).orFail().lean();
    expect(account.password).not.toContain("Password123");
    expect(account).toMatchObject({ providerId: "credential", accountId: id });
    expect(await verifyPassword("Password123", account.password)).toBe(true);
    expect((await BrandProfile.findOne({ userId: id }).orFail().lean()).companyName).toBe("Loom & Line");
    expect(await Notification.countDocuments({ userId: id })).toBe(1);
  });

  it("rejects duplicate emails", async () => {
    const input = { role: "BRAND", name: "A", organization: "Org", email: "dup@example.test", password: "Password123", confirmPassword: "Password123" };
    await registerAccount(input);
    await expect(registerAccount(input)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("authenticates only with the right password and blocks suspended accounts", async () => {
    const user = await makeUser("BRAND");
    await expect(authenticate(user.email, "wrong-password1")).rejects.toThrow(/incorrect/);
    await expect(authenticate("nobody@example.test", "Password123")).rejects.toThrow(/incorrect/);
    expect(await authenticate(user.email, "Password123")).toBe(user.id);
    const admin = await makeAdmin();
    await setUserStatus(admin, user.id, "SUSPENDED", "Policy violation under review");
    await expect(authenticate(user.email, "Password123")).rejects.toThrow(/suspended/);
    expect(await AuditLog.countDocuments({ targetId: user.id, action: "USER_SUSPENDED" })).toBe(1);
  });

  it("resets a password with a single-use token and signs out other sessions", async () => {
    const user = await makeUser("BRAND");
    await Session.create({ userId: user.id, token: "hash", expiresAt: new Date(Date.now() + 1e6) });
    expect(await createPasswordReset("unknown@example.test")).toBeNull();
    const token = await createPasswordReset(user.email);
    const stored = await Verification.findOne().orFail().lean();
    expect(stored.value).not.toBe(token); // only the hash is stored
    expect(stored.value).toBe(sha256(token));
    await resetPassword(token, "NewPassword9");
    expect(await authenticate(user.email, "NewPassword9")).toBe(user.id);
    expect(await Session.countDocuments({ userId: user.id })).toBe(0);
    await expect(resetPassword(token, "Another123")).rejects.toThrow(/invalid or has expired/);
  });

  it("changes a password only with the current password", async () => {
    const user = await makeUser("BRAND");
    await expect(changePassword(user, "wrong", "Password456")).rejects.toThrow(/incorrect/);
    await changePassword(user, "Password123", "Password456");
    expect(await authenticate(user.email, "Password456")).toBe(user.id);
  });
});

describe("role permissions", () => {
  it("rejects brand-only and admin-only operations from other roles", async () => {
    const admin = await makeAdmin();
    const factory = await makeFactory(admin);
    const brand = await makeBrand();
    await expect(saveProject(factory, null, { name: "Hack", category: "T_SHIRTS" }, 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setUserStatus(brand, factory.id, "SUSPENDED", "not allowed")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const profile = await ManufacturerProfile.findOne({ userId: factory.id }).orFail().lean();
    await expect(decideVerification(brand, profile._id.toHexString(), "VERIFIED", "self-approve")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("tenant isolation", () => {
  it("keeps projects, orders and files private to their organisations", async () => {
    const { brand, factory, projectId, order } = await makeOrder();
    const otherBrand = await makeBrand();
    const admin = await makeAdmin();
    const outsiderFactory = await makeFactory(admin, { categories: ["DENIM"] });

    await expect(getProject(otherBrand, projectId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getProject(outsiderFactory, projectId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getOrder(otherBrand, order.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getOrder(outsiderFactory, order.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listProjects(otherBrand)).total).toBe(0);
    expect((await listOrders(outsiderFactory)).total).toBe(0);

    expect((await getProject(brand, projectId)).id).toBe(projectId);
    expect((await getProject(factory, projectId)).id).toBe(projectId);
    expect((await getOrder(admin, order.id)).id).toBe(order.id);

    const techPack = await ProjectAttachment.findOne({ projectId }).orFail().lean();
    await expect(authorizeFile(brand, techPack.fileKey)).resolves.toMatchObject({ mimeType: "application/pdf" });
    await expect(authorizeFile(factory, techPack.fileKey)).resolves.toBeTruthy();
    await expect(authorizeFile(otherBrand, techPack.fileKey)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(authorizeFile(outsiderFactory, techPack.fileKey)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Factory verification documents are visible only to their owner and admins.
    const profile = await ManufacturerProfile.findOne({ userId: factory.id }).orFail().lean();
    const doc = await ManufacturerDocument.findOne({ profileId: profile._id }).orFail().lean();
    await expect(authorizeFile(factory, doc.fileKey)).resolves.toBeTruthy();
    await expect(authorizeFile(admin, doc.fileKey)).resolves.toBeTruthy();
    await expect(authorizeFile(brand, doc.fileKey)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides draft projects from manufacturers", async () => {
    const brand = await makeBrand();
    const admin = await makeAdmin();
    const factory = await makeFactory(admin);
    const draftId = await saveProject(brand, null, { name: "Secret draft", category: "T_SHIRTS" }, 1);
    await expect(getProject(factory, draftId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only marks the caller's own notifications as read", async () => {
    const a = await makeBrand();
    const b = await makeBrand();
    const bNotes = await listNotifications(b);
    await markRead(a, bNotes.items.map((n) => n.id));
    expect((await listNotifications(b, { unread: true })).total).toBe(bNotes.total);
    await markRead(b, "all");
    expect((await listNotifications(b, { unread: true })).total).toBe(0);
  });

  it("lets a matched factory see a submitted project", async () => {
    const admin = await makeAdmin();
    const factory = await makeFactory(admin);
    const brand = await makeBrand();
    const { projectId } = await makeSubmittedProject(brand);
    expect((await getProject(factory, projectId)).name).toBe("Organic tee");
  });
});

describe("HTTP: auth endpoints", () => {
  const app = createApp({ clientDistDir: "/nonexistent-client-dist", publicDir: "/nonexistent-public" });

  it("registers, sets an http-only SameSite=Lax session cookie and stores only its hash", async () => {
    const res = await sameOrigin(request(app).post("/api/auth/register")).send({
      role: "MANUFACTURER", name: "Bilal Ahmed", organization: "Stitch Works", email: "Bilal@Example.test", password: PASSWORD, confirmPassword: PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, redirectTo: "/onboarding" });
    const cookie = res.headers["set-cookie"].find((c) => c.startsWith("fz_session="));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    const token = decodeURIComponent(cookie.split(";")[0].slice("fz_session=".length));
    const user = await User.findOne({ email: "bilal@example.test" }).orFail().lean();
    const session = await Session.findOne({ userId: user._id }).orFail().lean();
    expect(session.token).toBe(sha256(token));
    expect(await ManufacturerProfile.findOne({ userId: user._id }).orFail().lean()).toMatchObject({ businessName: "Stitch Works", contactName: "Bilal Ahmed", contactEmail: "bilal@example.test" });

    const me = await request(app).get("/api/auth/me").set("Cookie", `fz_session=${token}`);
    expect(me.body.user).toMatchObject({ name: "Bilal Ahmed", role: "MANUFACTURER", profileCompleted: false, org: "Stitch Works", unread: 1 });

    const dup = await sameOrigin(request(app).post("/api/auth/register")).send({
      role: "BRAND", name: "Other", organization: "Other", email: "bilal@example.test", password: PASSWORD, confirmPassword: PASSWORD,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toEqual({
      code: "CONFLICT",
      message: "An account with this email already exists.",
      fieldErrors: { email: "An account with this email already exists. Sign in instead." },
    });
  });

  it("signs in, honours a safe ?next= and signs out", async () => {
    const user = await makeUser("BRAND");
    const wrong = await sameOrigin(request(app).post("/api/auth/login")).send({ email: user.email, password: "Wrong1234" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toEqual({ code: "INVALID", message: "The email or password is incorrect." });

    const res = await sameOrigin(request(app).post("/api/auth/login")).send({ email: user.email.toUpperCase(), password: PASSWORD, next: "/projects?status=ACTIVE" });
    expect(res.body).toEqual({ ok: true, redirectTo: "/projects?status=ACTIVE" });
    expect((await User.findById(user.id).lean()).lastLoginAt).toBeInstanceOf(Date);
    const cookie = res.headers["set-cookie"].find((c) => c.startsWith("fz_session=")).split(";")[0];

    const home = await sameOrigin(request(app).post("/api/auth/login")).send({ email: user.email, password: PASSWORD, next: "//evil.example" });
    expect(home.body.redirectTo).toBe("/dashboard");

    const out = await sameOrigin(request(app).post("/api/auth/logout")).set("Cookie", cookie);
    expect(out.body).toEqual({ ok: true, redirectTo: "/login?signedOut=1" });
    expect(out.headers["set-cookie"].some((c) => c.startsWith("fz_session=;"))).toBe(true);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).body).toEqual({ user: null });
  });

  it("refuses suspended accounts with today's message", async () => {
    const user = await makeUser("BRAND");
    await User.updateOne({ _id: user.id }, { $set: { status: "SUSPENDED" } });
    const res = await sameOrigin(request(app).post("/api/auth/login")).send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "FORBIDDEN", message: "This account has been suspended. Contact the Fashinza team for help." });
  });

  it("resets a password over HTTP and always gives the same forgot-password answer", async () => {
    const user = await makeUser("BRAND");
    const message = "If an account exists for that email, a reset link has been issued. It expires in one hour.";
    expect((await sameOrigin(request(app).post("/api/auth/forgot-password")).send({ email: "nobody@example.test" })).body).toEqual({ ok: true, message });
    expect((await sameOrigin(request(app).post("/api/auth/forgot-password")).send({ email: user.email })).body).toEqual({ ok: true, message });
    const token = await createPasswordReset(user.email);
    const res = await sameOrigin(request(app).post("/api/auth/reset-password")).send({ token, password: "NewPassword9", confirmPassword: "NewPassword9" });
    expect(res.body).toEqual({ ok: true, redirectTo: "/login?reset=1" });
    const again = await sameOrigin(request(app).post("/api/auth/reset-password")).send({ token, password: "NewPassword9", confirmPassword: "NewPassword9" });
    expect(again.body.error).toEqual({ code: "INVALID", message: "This reset link is invalid or has expired. Request a new one." });
  });

  it("changes the password of the signed-in user", async () => {
    const user = await makeUser("BRAND");
    const cookie = await sessionCookie(user.id);
    const bad = await sameOrigin(request(app).post("/api/auth/change-password")).set("Cookie", cookie).send({ currentPassword: "nope", newPassword: "Password456", confirmPassword: "Password456" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toEqual({ code: "INVALID", message: "Your current password is incorrect.", fieldErrors: { currentPassword: "Your current password is incorrect." } });
    const good = await sameOrigin(request(app).post("/api/auth/change-password")).set("Cookie", cookie).send({ currentPassword: PASSWORD, newPassword: "Password456", confirmPassword: "Password456" });
    expect(good.body).toEqual({ ok: true, message: "Password changed." });
  });
});

describe("HTTP: gates and tenant isolation", () => {
  const app = createApp({ clientDistDir: "/nonexistent-client-dist", publicDir: "/nonexistent-public" });

  it("applies authentication, role and onboarding checks in that order", async () => {
    const fresh = await makeUser("BRAND"); // profile not completed
    const freshCookie = await sessionCookie(fresh.id);
    expect((await request(app).get("/api/projects").set("Cookie", freshCookie)).body.error.code).toBe("PROFILE_INCOMPLETE");
    expect((await request(app).get("/api/opportunities").set("Cookie", freshCookie)).body.error).toEqual({
      code: "ROLE_DENIED",
      message: "That page is not available for your account type.",
    });
    // Profile endpoints only need a signed-in user of the right role (onboarding uses them).
    expect((await request(app).get("/api/profile/brand").set("Cookie", freshCookie)).body.profile).toMatchObject({ companyName: expect.any(String), country: "" });
    expect((await request(app).get("/api/profile/factory").set("Cookie", freshCookie)).status).toBe(403);
  });

  it("onboards a brand with a redirect and later saves with a message", async () => {
    const fresh = await makeUser("BRAND");
    const cookie = await sessionCookie(fresh.id);
    const body = { companyName: "North Thread", country: "United Kingdom", city: "Leeds", website: "https://north.example", phone: "", description: "" };
    const first = await sameOrigin(request(app).put("/api/profile/brand")).set("Cookie", cookie).send(body);
    expect(first.body).toEqual({ ok: true, redirectTo: "/dashboard?welcome=1" });
    const second = await sameOrigin(request(app).put("/api/profile/brand")).set("Cookie", cookie).send({ ...body, city: "York" });
    expect(second.body).toEqual({ ok: true, message: "Company profile saved." });
    expect(await BrandProfile.findOne({ userId: fresh.id }).lean()).toMatchObject({ companyName: "North Thread", city: "York" });
    const invalid = await sameOrigin(request(app).put("/api/profile/brand")).set("Cookie", cookie).send({ ...body, website: "north.example" });
    expect(invalid.body.error.fieldErrors).toEqual({ website: "Enter a full web address starting with http:// or https://." });
  });

  it("returns the not-found message for other brands' projects and malformed ids", async () => {
    const brand = await makeBrand();
    const other = await makeBrand();
    const { projectId } = await makeSubmittedProject(brand);
    const cookie = await sessionCookie(other.id);
    for (const path of [`/api/projects/${projectId}`, `/api/projects/${projectId}/detail`, "/api/projects/not-an-id"]) {
      const res = await request(app).get(path).set("Cookie", cookie);
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "Project was not found or you do not have access to it." });
    }
    const list = await request(app).get("/api/projects").set("Cookie", cookie);
    expect(list.body).toMatchObject({ items: [], total: 0, page: 1, pageSize: 10, pages: 1 });
  });

  it("serves files only to those who may see them, with the original headers", async () => {
    const brand = await makeBrand();
    const other = await makeBrand();
    const { projectId } = await makeSubmittedProject(brand);
    const att = await ProjectAttachment.findOne({ projectId }).orFail().lean();
    const res = await request(app)
      .get(`/api/files/${att.fileKey}?download`)
      .set("Cookie", await sessionCookie(brand.id))
      .buffer(true)
      .parse((r, done) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe("attachment; filename*=UTF-8''techpack.pdf");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBe("default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    expect(Buffer.from(res.body).toString("latin1")).toMatch(/^%PDF-/);

    const denied = await request(app).get(`/api/files/${att.fileKey}`).set("Cookie", await sessionCookie(other.id));
    expect(denied.status).toBe(404);
    expect(denied.body.error).toEqual({ code: "NOT_FOUND", message: "File was not found or you do not have access to it." });
  });

  it("searches only the actor's own records", async () => {
    const brand = await makeBrand();
    const other = await makeBrand();
    await makeSubmittedProject(brand);
    const mine = await request(app).get("/api/search?q=organic").set("Cookie", await sessionCookie(brand.id));
    expect(mine.body).toMatchObject({ q: "organic", total: 1, opportunities: null, projects: { total: 1 } });
    const theirs = await request(app).get("/api/search?q=organic").set("Cookie", await sessionCookie(other.id));
    expect(theirs.body).toMatchObject({ total: 0 });
    const empty = await request(app).get("/api/search?q=%20%20").set("Cookie", await sessionCookie(other.id));
    expect(empty.body).toEqual({ q: "", projects: null, orders: null, opportunities: null, total: 0 });
  });

  it("stores contact enquiries", async () => {
    const res = await sameOrigin(request(app).post("/api/contact")).send({
      name: "Sara", email: "sara@example.test", company: "", inquiryType: "Brand enquiry", subject: "Sampling", message: "We would like to discuss a sampling run for our spring range.",
    });
    expect(res.body).toEqual({ ok: true, message: "Thank you — your message has been received. We usually reply within two working days." });
    const { ContactInquiry } = await import("../../src/models/index.js");
    expect(await ContactInquiry.findOne().lean()).toMatchObject({ name: "Sara", status: "NEW", company: null });
  });
});
