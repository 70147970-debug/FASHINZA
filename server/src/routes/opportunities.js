/**
 * Opportunities (mounted at /api/opportunities) — owner: SERVER-A (docs/mern/api.md §3.4–3.5, §6.1).
 * Port of the /opportunities pages' data and saveQuotationAction in (app)/opportunities/actions.ts.
 *   GET  /                       onboarded MANUFACTURER
 *   GET  /:projectId             onboarded MANUFACTURER
 *   POST /:projectId/quotation   onboarded MANUFACTURER
 */
import { Router } from "express";
import { quotationSchema } from "@fashinza/shared/validation/quotation.js";
import { ok, readForm, validateForm } from "../lib/form.js";
import { oid } from "../lib/records.js";
import { requireOnboardedUser } from "../middleware/auth.js";
import { ManufacturerProfile } from "../models/ManufacturerProfile.js";
import { getOpportunity, listOpportunities } from "../services/opportunities.js";
import { saveQuotation } from "../services/quotations.js";

const router = Router();
const manufacturer = requireOnboardedUser(["MANUFACTURER"]);

/** `filter` query: new | open | all, default open (the opportunities page). */
export function opportunityFilter(value) {
  return ["new", "open", "all"].includes(value) ? value : "open";
}

router.get("/", manufacturer, async (req, res) => {
  const [data, profile] = await Promise.all([
    listOpportunities(req.actor, {
      filter: opportunityFilter(req.query.filter),
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      page: Number(req.query.page) || 1,
    }),
    ManufacturerProfile.findOne({ userId: oid(req.actor.id) }, { verificationStatus: 1 }).lean(),
  ]);
  res.json({ ...data, verified: profile?.verificationStatus === "VERIFIED" });
});

router.get("/:projectId", manufacturer, async (req, res) => {
  res.json(await getOpportunity(req.actor, req.params.projectId));
});

router.post("/:projectId/quotation", manufacturer, async (req, res) => {
  const form = readForm(req);
  const submit = form.intent === "submit";
  const data = validateForm(quotationSchema, form);
  const q = await saveQuotation(req.actor, req.params.projectId, data, submit);
  ok(res, { message: submit ? `Quotation version ${q.version} sent to the brand.` : "Draft saved. The brand cannot see it until you send it." });
});

export default router;
