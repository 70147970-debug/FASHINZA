import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getCheckout } from "@/server/services/payments";
import { isAppError } from "@/server/errors";
import { Logo } from "@/components/site/logo";
import { Alert } from "@/components/ui/alert";
import { SandboxBadge } from "@/components/app/primitives";
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
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="border-b border-warning-line bg-warning-soft">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-2 px-4 py-2.5 text-center text-xs font-medium text-warning-strong">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          Demonstration environment · simulated payment provider
        </div>
      </div>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Logo />
            <SandboxBadge>Sandbox</SandboxBadge>
          </div>
          <div className="overflow-hidden rounded-xl border-2 border-dashed border-warning bg-surface">
            <div className="flex items-center gap-2 border-b border-warning-line bg-warning-soft px-5 py-3 text-sm font-semibold text-warning-strong">
              <FlaskConical className="size-4 shrink-0" aria-hidden /> Sandbox payment provider — no real money is charged
            </div>
            <div className="border-b border-line-subtle px-5 pb-6 pt-6 sm:px-7">
              <p className="label-caps text-ink-muted">{pm.order.reference} · {pm.order.project.name}</p>
              <h1 className="mt-2 font-display text-xl font-medium tracking-[-0.01em] text-ink">{pm.label}</h1>
              <p className="tabular mt-4 font-display text-[2.5rem] font-[450] leading-none tracking-[-0.025em] text-ink">{formatMoney(txn.amount, txn.currency)}</p>
              <dl className="mt-5 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-xs">
                <dt className="text-ink-muted">Reference</dt>
                <dd className="min-w-0 break-all font-medium text-ink">{txn.providerRef}</dd>
              </dl>
            </div>
            <div className="space-y-4 p-5 sm:p-7">
              {txn.status !== "PENDING" ? (
                <Alert tone="info">This checkout has already been processed (status: {txn.status.toLowerCase()}). <Link className="font-medium underline underline-offset-4" href={`/orders/${pm.order.id}#payments`}>Back to the order</Link></Alert>
              ) : (
                <>
                  <p className="text-sm leading-6 text-ink-muted">
                    Choose an outcome to simulate. The sandbox sends a signed webhook to Fashinza, which verifies it and updates the payment — the same path a real provider would use.
                    No card details are collected.
                  </p>
                  <CheckoutButtons providerRef={txn.providerRef} />
                </>
              )}
            </div>
          </div>
          <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-xs leading-5 text-ink-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Fashinza records milestone payments; it is not a regulated escrow service.
          </p>
        </div>
      </main>
    </div>
  );
}
