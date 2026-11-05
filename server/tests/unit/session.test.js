import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import mongoose from "mongoose";
import { Session } from "../../src/models/Session.js";
import { User } from "../../src/models/User.js";
import { sha256 } from "../../src/auth/password.js";
import { createSession, destroySession, getCurrentUser, revokeAllSessions, SESSION_COOKIE } from "../../src/auth/session.js";
import { optionalUser, requireOnboardedUser, requireRole, requireUser } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/middleware/errors.js";

const userId = new mongoose.Types.ObjectId();
const lean = (value) => ({ lean: async () => value });

function stubSession({ session = { userId, expiresAt: new Date(Date.now() + 60_000) }, user = {} } = {}) {
  const findOne = vi.spyOn(Session, "findOne").mockReturnValue(lean(session));
  const findById = vi.spyOn(User, "findById").mockReturnValue(
    lean(session && user ? { _id: userId, role: "BRAND", name: "Ayesha", email: "a@example.test", status: "ACTIVE", profileCompleted: true, ...user } : null),
  );
  return { findOne, findById };
}

function appWith(...handlers) {
  const app = express();
  app.use(cookieParser());
  app.get("/t", ...handlers, (req, res) => res.json({ actor: req.actor ?? null }));
  app.use(errorHandler);
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe("createSession / destroySession", () => {
  it("stores only the SHA-256 of the token and sets an HttpOnly, SameSite=Lax cookie for 7 days", async () => {
    const create = vi.spyOn(Session, "create").mockResolvedValue({});
    const app = express();
    app.get("/login", async (_req, res) => {
      await createSession(res, userId.toHexString(), { ip: "203.0.113.9", userAgent: "x".repeat(400) });
      res.json({ ok: true });
    });
    const res = await request(app).get("/login");
    const cookie = res.headers["set-cookie"][0];
    const token = /^fz_session=([^;]+)/.exec(cookie)[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Secure/); // only in production
    const row = create.mock.calls[0][0];
    expect(row.token).toBe(sha256(token));
    expect(row.token).not.toBe(token);
    expect(row.userAgent).toHaveLength(300);
    expect(row.ipAddress).toBe("203.0.113.9");
    const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
    const expires = new Date(/Expires=([^;]+)/.exec(cookie)[1]);
    expect(Math.abs(expires.getTime() - row.expiresAt.getTime())).toBeLessThan(1000);
  });

  it("deletes the session by token hash and clears the cookie on logout", async () => {
    const del = vi.spyOn(Session, "deleteMany").mockResolvedValue({ deletedCount: 1 });
    const app = express();
    app.use(cookieParser());
    app.post("/logout", async (req, res) => {
      await destroySession(req, res);
      res.json({ ok: true });
    });
    const res = await request(app).post("/logout").set("Cookie", `${SESSION_COOKIE}=raw-token`);
    expect(del).toHaveBeenCalledWith({ token: sha256("raw-token") });
    expect(res.headers["set-cookie"][0]).toMatch(/^fz_session=;.*Expires=Thu, 01 Jan 1970/);
  });

  it("revokeAllSessions deletes every session of the user", async () => {
    const del = vi.spyOn(Session, "deleteMany").mockResolvedValue({ deletedCount: 3 });
    await revokeAllSessions("u1");
    expect(del).toHaveBeenCalledWith({ userId: "u1" }, { session: undefined });
  });
});

describe("getCurrentUser", () => {
  const req = (cookie) => ({ cookies: cookie ? { [SESSION_COOKIE]: cookie } : {} });

  it("returns null without a cookie (and never queries)", async () => {
    const { findOne } = stubSession();
    expect(await getCurrentUser(req())).toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it("looks the session up by the token hash and returns the actor shape", async () => {
    const { findOne } = stubSession();
    const actor = await getCurrentUser(req("tok"));
    expect(findOne.mock.calls[0][0]).toEqual({ token: sha256("tok") });
    expect(actor).toEqual({ id: userId.toHexString(), role: "BRAND", name: "Ayesha", email: "a@example.test", profileCompleted: true });
  });

  it("returns null for unknown or expired sessions and suspended users", async () => {
    stubSession({ session: null });
    expect(await getCurrentUser(req("tok"))).toBeNull();
    vi.restoreAllMocks();
    stubSession({ session: { userId, expiresAt: new Date(Date.now() - 1000) } });
    expect(await getCurrentUser(req("tok"))).toBeNull();
    vi.restoreAllMocks();
    stubSession({ user: { status: "SUSPENDED" } });
    expect(await getCurrentUser(req("tok"))).toBeNull();
  });

  it("is memoised per request", async () => {
    const { findOne } = stubSession();
    const r = req("tok");
    await getCurrentUser(r);
    await getCurrentUser(r);
    expect(findOne).toHaveBeenCalledTimes(1);
  });
});

describe("requireUser / requireOnboardedUser", () => {
  const cookie = `${SESSION_COOKIE}=tok`;

  it("401 UNAUTHENTICATED when signed out", async () => {
    const res = await request(appWith(requireUser())).get("/t");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  });

  it("403 ROLE_DENIED when the role is not allowed", async () => {
    stubSession();
    const res = await request(appWith(requireUser(["ADMIN"]))).get("/t").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: "ROLE_DENIED", message: "That page is not available for your account type." });
  });

  it("sets req.actor when allowed", async () => {
    stubSession();
    const res = await request(appWith(requireUser(["BRAND"]))).get("/t").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.actor).toMatchObject({ id: userId.toHexString(), role: "BRAND" });
  });

  it("403 PROFILE_INCOMPLETE for non-admins without a completed profile, after the role check", async () => {
    stubSession({ user: { profileCompleted: false } });
    let res = await request(appWith(requireOnboardedUser(["BRAND"]))).get("/t").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PROFILE_INCOMPLETE");
    // role is checked before onboarding
    res = await request(appWith(requireOnboardedUser(["MANUFACTURER"]))).get("/t").set("Cookie", cookie);
    expect(res.body.error.code).toBe("ROLE_DENIED");
  });

  it("admins pass requireOnboardedUser without a completed profile", async () => {
    stubSession({ user: { role: "ADMIN", profileCompleted: false } });
    const res = await request(appWith(requireOnboardedUser())).get("/t").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("requireRole checks req.actor; optionalUser never fails", async () => {
    stubSession();
    let res = await request(appWith(requireUser(), requireRole("ADMIN"))).get("/t").set("Cookie", cookie);
    expect(res.body.error.code).toBe("ROLE_DENIED");
    res = await request(appWith(optionalUser)).get("/t");
    expect(res.status).toBe(200);
    expect(res.body.actor).toBeNull();
  });
});
