/**
 * Sandbox checkout (mounted at /api/sandbox-checkout) — owner: SERVER-B (docs/mern/api.md §6.1). Ports the
 * /sandbox-checkout/[ref] page data and simulateCheckoutAction.
 *
 * The simulation does not update the payment itself: it asks the sandbox provider to deliver a signed webhook
 * to /api/webhooks/payments/sandbox, exactly as a real provider would, and the webhook handler records the
 * outcome.
 */
import { Router } from "express";
import { conflict, invalid } from "../lib/errors.js";
import { ok, readForm } from "../lib/form.js";
import { requireUser } from "../middleware/auth.js";
import { deliverSandboxEvent, getPaymentProvider } from "../payments/provider.js";
import { getCheckout } from "../services/payments.js";

const router = Router();

router.get("/:ref", requireUser(["BRAND"]), async (req, res) => {
  res.json({ txn: await getCheckout(req.actor, req.params.ref) });
});

router.post("/:ref", requireUser(["BRAND"]), async (req, res) => {
  if (!getPaymentProvider().isSandbox) throw invalid("Simulation is only available in sandbox mode.");
  const outcome = String(readForm(req).outcome ?? null);
  const txn = await getCheckout(req.actor, req.params.ref);
  if (txn.status !== "PENDING") throw conflict("This checkout has already been completed.");
  const orderId = txn.paymentMilestone.order.id;
  await deliverSandboxEvent(outcome === "success" ? "payment.succeeded" : "payment.failed", {
    providerRef: txn.providerRef,
    amount: txn.amount,
    currency: txn.currency,
    ...(outcome === "success" ? {} : { reason: outcome === "cancel" ? "Checkout cancelled by the payer" : "Card declined (sandbox test)" }),
  });
  ok(res, { redirectTo: `/orders/${orderId}?payment=returned&tab=payments` });
});

export default router;
