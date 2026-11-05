/**
 * Payments (mounted at /api/payments) — owner: SERVER-B (docs/mern/api.md §6.1). Ports the /payments page data
 * and startPaymentAction (src/app/(app)/orders/actions.ts).
 */
import { Router } from "express";
import { PaymentMilestoneStatus } from "@fashinza/shared/enums.js";
import { ok } from "../lib/form.js";
import { oneOf, pageParam, queryString } from "../lib/query.js";
import { requireOnboardedUser } from "../middleware/auth.js";
import { listPayments, startPayment } from "../services/payments.js";

const router = Router();

router.get("/", requireOnboardedUser(["BRAND", "MANUFACTURER"]), async (req, res) => {
  res.json(await listPayments(req.actor, { status: oneOf(PaymentMilestoneStatus, queryString(req, "status")), page: pageParam(req) }));
});

router.post("/milestones/:id/checkout", requireOnboardedUser(["BRAND"]), async (req, res) => {
  const url = await startPayment(req.actor, req.params.id);
  ok(res, { redirectTo: url });
});

export default router;
