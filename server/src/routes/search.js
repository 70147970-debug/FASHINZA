/**
 * Workspace search (mounted at /api/search) — owner: SERVER-A (docs/mern/api.md §3.8, §6.1).
 * Port of the data loading in src/app/(app)/search/page.tsx.
 *   GET /?q=   onboarded (any role)
 */
import { Router } from "express";
import { requireOnboardedUser } from "../middleware/auth.js";
import { search, searchTerm } from "../services/search.js";

const router = Router();

router.get("/", requireOnboardedUser(), async (req, res) => {
  res.json(await search(req.actor, searchTerm(req.query.q)));
});

export default router;
