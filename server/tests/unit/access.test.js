import { afterEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { assertRole, disputeFilter, orderFilter, projectFilter, quotationFilter } from "../../src/lib/access.js";
import { MatchResult, Order, Project, Quotation } from "../../src/models/index.js";
import { audit, logActivity, notify } from "../../src/lib/events.js";
import { ActivityLog, AuditLog, Notification } from "../../src/models/index.js";

const hex = () => new mongoose.Types.ObjectId().toHexString();
const actor = (role) => ({ id: hex(), role, name: "X", email: "x@example.test", profileCompleted: true });
const distinctReturning = (ids) => ({ session: async () => ids });

afterEach(() => vi.restoreAllMocks());

describe("tenant scoping", () => {
  it("admins see everything", async () => {
    const admin = actor("ADMIN");
    expect(await projectFilter(admin)).toEqual({});
    expect(orderFilter(admin)).toEqual({});
    expect(await quotationFilter(admin)).toEqual({});
    expect(await disputeFilter(admin)).toEqual({});
  });

  it("brands are scoped to their own records and never see quotation drafts", async () => {
    const brand = actor("BRAND");
    const own = [new mongoose.Types.ObjectId()];
    vi.spyOn(Project, "distinct").mockReturnValue(distinctReturning(own));
    expect(String((await projectFilter(brand)).brandId)).toBe(brand.id);
    expect(String(orderFilter(brand).brandId)).toBe(brand.id);
    expect(await quotationFilter(brand)).toEqual({ projectId: { $in: own }, status: { $ne: "DRAFT" } });
  });

  it("manufacturers reach non-draft projects they were matched to or quoted on, and their own orders", async () => {
    const m = actor("MANUFACTURER");
    const a = new mongoose.Types.ObjectId();
    const b = new mongoose.Types.ObjectId();
    vi.spyOn(MatchResult, "distinct").mockReturnValue(distinctReturning([a]));
    vi.spyOn(Quotation, "distinct").mockReturnValue(distinctReturning([a, b]));
    const f = await projectFilter(m);
    expect(f.status).toEqual({ $ne: "DRAFT" });
    expect(f._id.$in.map(String)).toEqual([String(a), String(b)]);
    expect(String(orderFilter(m).manufacturerId)).toBe(m.id);
    expect(String((await quotationFilter(m)).manufacturerId)).toBe(m.id);
  });

  it("disputes: reporter, parties of the order, and (brands) their projects", async () => {
    const brand = actor("BRAND");
    const orderIds = [new mongoose.Types.ObjectId()];
    const projectIds = [new mongoose.Types.ObjectId()];
    vi.spyOn(Order, "distinct").mockReturnValue(distinctReturning(orderIds));
    vi.spyOn(Project, "distinct").mockReturnValue(distinctReturning(projectIds));
    const f = await disputeFilter(brand);
    expect(f.$or).toHaveLength(3);
    expect(f.$or[1]).toEqual({ orderId: { $in: orderIds } });
    expect(f.$or[2]).toEqual({ projectId: { $in: projectIds } });
    expect((await disputeFilter(actor("MANUFACTURER"))).$or).toHaveLength(2);
  });

  it("assertRole throws the original FORBIDDEN message", () => {
    expect(() => assertRole(actor("BRAND"), "MANUFACTURER")).toThrow("You do not have permission to do that.");
    expect(() => assertRole(actor("BRAND"), "BRAND", "ADMIN")).not.toThrow();
  });
});

describe("event helpers", () => {
  it("notify de-duplicates recipients and passes the session", async () => {
    const insert = vi.spyOn(Notification, "insertMany").mockResolvedValue([]);
    const u = hex();
    const session = { fake: true };
    await notify(session, [u, u, hex()], "SYSTEM", "Title", "Body", "/orders/1");
    const [docs, opts] = insert.mock.calls[0];
    expect(docs).toHaveLength(2);
    expect(docs[0]).toEqual({ userId: u, type: "SYSTEM", title: "Title", message: "Body", link: "/orders/1" });
    expect(opts).toEqual({ session });
    await notify(undefined, [], "SYSTEM", "t", "m");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("logActivity and audit write one append-only row inside the session", async () => {
    const act = vi.spyOn(ActivityLog, "create").mockResolvedValue([{ id: "a" }]);
    const aud = vi.spyOn(AuditLog, "create").mockResolvedValue([{ id: "b" }]);
    await logActivity(undefined, { actorId: null, type: "MILESTONE_DELAYED", message: "Late", orderId: "o1" });
    expect(act.mock.calls[0][0][0]).toEqual({ actorId: null, type: "MILESTONE_DELAYED", message: "Late", projectId: null, orderId: "o1", metadata: null });
    await audit("s", { actorId: "u", action: "USER_SUSPENDED", targetType: "User", targetId: "t", reason: undefined });
    expect(aud.mock.calls[0][0][0]).toMatchObject({ reason: null, metadata: null, targetId: "t" });
    expect(aud.mock.calls[0][1]).toEqual({ session: "s" });
  });
});
