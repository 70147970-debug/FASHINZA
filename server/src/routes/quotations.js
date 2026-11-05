/**
 * Quotations (mounted at /api/quotations) — owner: SERVER-A (docs/mern/api.md §3.4, §6.1).
 * Port of the quotation actions in (app)/projects/actions.ts and (app)/opportunities/actions.ts, and the
 * /quotations page data.
 *   GET  /                          onboarded MANUFACTURER
 *   POST /:id/withdraw              onboarded MANUFACTURER
 *   POST /:id/request-revision      onboarded BRAND
 *   POST /:id/reject                onboarded BRAND
 *   POST /:id/accept                onboarded BRAND
 * (Saving/sending a quotation is POST /api/opportunities/:projectId/quotation.)
 */
import { Router } from "express";
import { QUOTATION_STATUS } from "@fashinza/shared/labels.js";
import { decisionNoteSchema } from "@fashinza/shared/validation/quotation.js";
import { ok, readForm, validateForm } from "../lib/form.js";
import { requireOnboardedUser } from "../middleware/auth.js";
import { listMyQuotations } from "../services/opportunities.js";
import { acceptQuotation, rejectQuotation, requestRevision, withdrawQuotation } from "../services/quotations.js";

const router = Router();
const brand = requireOnboardedUser(["BRAND"]);
const manufacturer = requireOnboardedUser(["MANUFACTURER"]);

/** `status` query: a QuotationStatus, anything else ignored. */
export function quotationStatusFilter(value) {
  return typeof value === "string" && Object.hasOwn(QUOTATION_STATUS, value) ? value : undefined;
}

const noteOf = (req) => validateForm(decisionNoteSchema, { note: readForm(req).note ?? null }).note;

router.get("/", manufacturer, async (req, res) => {
  res.json(await listMyQuotations(req.actor, { status: quotationStatusFilter(req.query.status), page: Number(req.query.page) || 1 }));
});

router.post("/:id/withdraw", manufacturer, async (req, res) => {
  await withdrawQuotation(req.actor, req.params.id);
  ok(res, { message: "Quotation withdrawn." });
});

router.post("/:id/request-revision", brand, async (req, res) => {
  const note = noteOf(req);
  await requestRevision(req.actor, req.params.id, note);
  ok(res, { message: "Revision requested. The factory has been notified." });
});

router.post("/:id/reject", brand, async (req, res) => {
  const note = noteOf(req);
  await rejectQuotation(req.actor, req.params.id, note);
  ok(res, { message: "Quotation declined." });
});

router.post("/:id/accept", brand, async (req, res) => {
  const order = await acceptQuotation(req.actor, req.params.id);
  ok(res, { redirectTo: `/orders/${order.id}?created=1`, orderId: order.id });
});

export default router;
