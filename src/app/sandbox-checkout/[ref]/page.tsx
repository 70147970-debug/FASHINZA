import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getCheckout } from "@/server/services/payments";
import { isAppError } from "@/server/errors";
import { Logo } from "@/components/site/logo";
import { Alert } from "@/components/ui/alert";
import { formatMoney } from "@/lib/format";
import { CheckoutButtons } from "./buttons";

export const metadata: Metadata = { title: "Sandbox checkout", robots: { index: false } };

export default async function SandboxCheckoutPage({ params }: { params: Promise<{ ref: string }> }) {
  const actor = await requireUser(["BRAND"]);
  const { ref } = await params;
  const txn = await getCheckout(actor, ref).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const pm = txn.paymentMilestone;
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="rounded-lg border-2 border-dashed border-warning bg-white shadow-pop">
          <div className="flex items-center gap-2 rounded-t-md bg-warning-50 px-5 py-3 text-sm font-semibold text-warning-700">
            <FlaskConical className="size-4" aria-hidden /> Sandbox payment provider — no real money is charged
          </div>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-xs text-muted">{pm.order.reference} · {pm.order.project.name}</p>
              <h1 className="mt-1 text-lg font-semibold">{pm.label}</h1>
              <p className="tabular mt-2 font-display text-3xl font-semibold text-navy">{formatMoney(txn.amount, txn.currency)}</p>
              <p className="mt-1 text-xs text-muted">Reference {txn.providerRef}</p>
            </div>
            {txn.status !== "PENDING" ? (
              <Alert tone="info">This checkout is already {txn.status.toLowerCase()}. <Link className="underline" href={`/orders/${pm.order.id}#payments`}>Back to the order</Link></Alert>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Choose an outcome to simulate. The sandbox sends a signed webhook to Fashinza, which verifies it and updates the payment — the same path a real provider would use.
                  No card details are collected.
                </p>
                <CheckoutButtons providerRef={txn.providerRef} />
              </>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Fashinza records milestone payments; it is not a regulated escrow service.</p>
      </div>
    </main>
  );
}
