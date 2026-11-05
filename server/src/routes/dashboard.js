/**
 * Dashboard (mounted at /api/dashboard) — owner: SERVER-B (docs/mern/api.md §6.1). Port of the /dashboard page
 * data (src/app/(app)/dashboard/page.tsx). Admins get ROLE_DENIED; the client sends them to /admin first.
 */
import { Router } from "express";
import { requireOnboardedUser } from "../middleware/auth.js";
import { brandDashboard, manufacturerDashboard } from "../services/dashboard.js";
import { listProjects } from "../services/projects.js";

const router = Router();

router.get("/", requireOnboardedUser(["BRAND", "MANUFACTURER"]), async (req, res) => {
  const actor = req.actor;
  if (actor.role === "BRAND") {
    const [d, recent] = await Promise.all([brandDashboard(actor), listProjects(actor, { pageSize: 5 })]);
    return res.json({ role: "BRAND", ...d, recent });
  }
  res.json({ role: "MANUFACTURER", ...(await manufacturerDashboard(actor)) });
});

export default router;
