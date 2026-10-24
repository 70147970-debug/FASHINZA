import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate, changePassword, createPasswordReset, registerAccount, resetPassword, setUserStatus } from "@/server/services/accounts";
import { getProject, listProjects, saveProject } from "@/server/services/projects";
import { getOrder, listOrders } from "@/server/services/orders";
import { authorizeFile } from "@/server/services/files";
import { decideVerification } from "@/server/services/profiles";
import { listNotifications, markRead } from "@/server/services/notifications";
import { verifyPassword } from "@/server/auth/password";
import { makeAdmin, makeBrand, makeFactory, makeOrder, makeSubmittedProject, makeUser, resetDb } from "../support/fixtures";

beforeEach(resetDb);

describe("authentication", () => {
  it("registers an account with a hashed password and an organisation profile", async () => {
    const id = await registerAccount({ role: "BRAND", name: "Ayesha Khan", organization: "Loom & Line", email: "ayesha@example.test", password: "Password123", confirmPassword: "Password123" });
    const account = await db.account.findFirstOrThrow({ where: { userId: id } });
    expect(account.password).not.toContain("Password123");
    expect(await verifyPassword("Password123", account.password!)).toBe(true);
    expect((await db.brandProfile.findUniqueOrThrow({ where: { userId: id } })).companyName).toBe("Loom & Line");
    expect(await db.notification.count({ where: { userId: id } })).toBe(1);
  });

  it("rejects duplicate emails", async () => {
    const input = { role: "BRAND" as const, name: "A", organization: "Org", email: "dup@example.test", password: "Password123", confirmPassword: "Password123" };
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
    expect(await db.auditLog.count({ where: { targetId: user.id, action: "USER_SUSPENDED" } })).toBe(1);
  });

  it("resets a password with a single-use token and signs out other sessions", async () => {
    const user = await makeUser("BRAND");
    await db.session.create({ data: { id: "s1", userId: user.id, token: "hash", expiresAt: new Date(Date.now() + 1e6) } });
    expect(await createPasswordReset("unknown@example.test")).toBeNull();
    const token = (await createPasswordReset(user.email))!;
    const stored = await db.verification.findFirstOrThrow();
    expect(stored.value).not.toBe(token); // only the hash is stored
    await resetPassword(token, "NewPassword9");
    expect(await authenticate(user.email, "NewPassword9")).toBe(user.id);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
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
    const profile = await db.manufacturerProfile.findUniqueOrThrow({ where: { userId: factory.id } });
    await expect(decideVerification(brand, profile.id, "VERIFIED", "self-approve")).rejects.toMatchObject({ code: "FORBIDDEN" });
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

    const techPack = await db.projectAttachment.findFirstOrThrow({ where: { projectId } });
    await expect(authorizeFile(brand, techPack.fileKey)).resolves.toMatchObject({ mimeType: "application/pdf" });
    await expect(authorizeFile(factory, techPack.fileKey)).resolves.toBeTruthy();
    await expect(authorizeFile(otherBrand, techPack.fileKey)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(authorizeFile(outsiderFactory, techPack.fileKey)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Factory verification documents are visible only to their owner and admins.
    const doc = await db.manufacturerDocument.findFirstOrThrow({ where: { profile: { userId: factory.id } } });
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
