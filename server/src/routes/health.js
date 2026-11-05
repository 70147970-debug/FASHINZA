/**
 * GET /api/health (mounted at /api/health) — liveness/readiness probe (port of src/app/api/health/route.ts):
 * reports whether the database answers. Never cached.
 * Implemented by the server foundation; owner per docs/mern/api.md §6.1: SERVER-B.
 */
import { Router } from "express";
import { pingDb } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  const started = Date.now();
  try {
    await pingDb();
    res.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() });
  } catch (e) {
    console.error("[health] database check failed", e instanceof Error ? e.message : e);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

export default router;
