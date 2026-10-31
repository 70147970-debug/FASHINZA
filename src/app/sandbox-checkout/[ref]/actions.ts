"use server";

import type { FormState } from "@/lib/form-state";
import { runAction } from "@/server/action";
import { requireUser } from "@/server/auth/session";
import { getCheckout } from "@/server/services/payments";
import { deliverSandboxEvent, getPaymentProvider } from "@/server/payments/provider";
import { conflict } from "@/server/errors";

/**
 * Sandbox stand-in for a provider's hosted checkout. It does not update the payment itself:
 * it asks the sandbox provider to deliver a signed webhook to /api/webhooks/payments/sandbox,
 * exactly as a real provider would, and the webhook handler records the outcome.
 */
export async function simulateCheckoutAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireUser(["BRAND"]);
  if (!getPaymentProvider().isSandbox) return { status: "error", message: "Simulation is only available in sandbox mode." };
  const ref = String(fd.get("ref"));
  const outcome = String(fd.get("outcome"));
  let orderId = "";
  const result = await runAction(async () => {
    const txn = await getCheckout(actor, ref);
    if (txn.status !== "PENDING") throw conflict("This checkout has already been completed.");
    orderId = txn.paymentMilestone.order.id;
    await deliverSandboxEvent(outcome === "success" ? "payment.succeeded" : "payment.failed", {
      providerRef: txn.providerRef,
      amount: txn.amount.toFixed(2),
      currency: txn.currency,
      ...(outcome === "success" ? {} : { reason: outcome === "cancel" ? "Checkout cancelled by the payer" : "Card declined (sandbox test)" }),
    });
  });
  if (result.status === "error") return result;
  return { status: "success", redirectTo: `/orders/${orderId}?payment=returned&tab=payments` };
}
