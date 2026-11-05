/**
 * Disputes (mounted at /api/disputes) — owner: SERVER-B (docs/mern/api.md §6.1). Ports raiseDisputeAction
 * (src/app/(app)/orders/actions.ts) and the /disputes, /disputes/[id] and /admin/disputes page data.
 * The admin update endpoint lives in routes/admin.js (POST /api/admin/disputes/:id).
 */
import { Router } from "express";
import { IssueStatus } from "@fashinza/shared/enums.js";
import { disputeSchema } from "@fashinza/shared/validation/operations.js";
import { ok, parseForm, readForm } from "../lib/form.js";
import { oneOf, pageParam, pageSizeParam, queryString } from "../lib/query.js";
import { requireOnboardedUser } from "../middleware/auth.js";
import { getDispute, listDisputes, raiseDispute } from "../services/disputes.js";

const router = Router();

router.post("/", requireOnboardedUser(["BRAND", "MANUFACTURER"]), async (req, res) => {
  const parsed = parseForm(disputeSchema, readForm(req));
  if (!parsed.ok) throw parsed.error;
  const issue = await raiseDispute(req.actor, parsed.data);
  ok(res, { redirectTo: `/disputes/${issue.id}?created=1` });
});

router.get("/", requireOnboardedUser(), async (req, res) => {
  res.json(await listDisputes(req.actor, { status: oneOf(IssueStatus, queryString(req, "status")), page: pageParam(req), pageSize: pageSizeParam(req) }));
});

router.get("/:id", requireOnboardedUser(), async (req, res) => {
  res.json({ dispute: await getDispute(req.actor, req.params.id) });
});

export default router;
