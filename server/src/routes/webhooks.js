/**
 * Payment webhooks (mounted at /api/webhooks with express.raw for every content type, limit 64kb, before the
 * JSON parsers; req.body is a Buffer; no Origin check) — owner: SERVER-B (docs/mern/api.md §6.1).
 * Port of src/app/api/webhooks/payments/[provider]/route.ts: the raw body is verified against the provider
 * signature before anything is parsed or stored. Duplicates are acknowledged with 200 so the provider stops
 * retrying. Bodies over 64 KiB are refused by express.raw (413 "Payload too large.").
 */
import { Router } from "express";
import { isAppError } from "../lib/errors.js";
import { processPaymentWebhook } from "../services/payments.js";

const router = Router();

router.post("/payments/:provider", async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  try {
    const result = await processPaymentWebhook(req.params.provider, raw, req.get("x-fashinza-signature") ?? null);
    res.json(result);
  } catch (e) {
    if (isAppError(e)) return res.status(400).json({ error: { code: "INVALID", message: e.message } });
    console.error("[webhook] processing failed", e);
    // 500 tells the provider to retry later; the event is stored with its error for review.
    res.status(500).json({ error: { code: "INTERNAL", message: "Processing failed." } });
  }
});

export default router;
