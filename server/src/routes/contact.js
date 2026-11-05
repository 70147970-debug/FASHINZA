/**
 * Contact enquiries (mounted at /api/contact) — owner: SERVER-A (docs/mern/api.md §3.7, §6.1).
 * Port of src/app/(public)/contact/actions.ts.
 *   POST /   public
 */
import { Router } from "express";
import { contactSchema } from "@fashinza/shared/validation/contact.js";
import { ok, readForm, validateForm } from "../lib/form.js";
import { enforceRateLimit, RATE_LIMIT_MESSAGES } from "../lib/rate-limit.js";
import { clientIp } from "../lib/request.js";
import { createInquiry } from "../services/contact.js";

const router = Router();

router.post("/", async (req, res) => {
  enforceRateLimit(`contact:${clientIp(req)}`, 5, 10 * 60 * 1000, RATE_LIMIT_MESSAGES.messages);
  const data = validateForm(contactSchema, readForm(req));
  await createInquiry(data);
  ok(res, { message: "Thank you — your message has been received. We usually reply within two working days." });
});

export default router;
