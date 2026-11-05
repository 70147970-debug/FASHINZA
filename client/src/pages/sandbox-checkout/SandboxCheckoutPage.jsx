import { Link, useLoaderData } from "react-router";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Alert } from "@/components/ui/alert";
import { SandboxBadge } from "@/components/app/primitives";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageMeta } from "@/components/meta";
import { loadData } from "@/lib/data";
import { formatMoney } from "@fashinza/shared/format.js";

/**
 * /sandbox-checkout/:ref — port of src/app/sandbox-checkout/[ref]/page.tsx and buttons.tsx (gate: user BRAND).
 * Outside the app shell, as today. The buttons post `outcome` to POST /api/sandbox-checkout/:ref, which
 * delivers a signed sandbox webhook and returns `redirectTo` (the order's payments tab).
 */
export async function loader({ request, params }) {
  return loadData(`/api/sandbox-checkout/${encodeURIComponent(params.ref)}`, { request });
}

function CheckoutButtons({ providerRef }) {
  return (
    <ActionForm action={`/api/sandbox-checkout/${encodeURIComponent(providerRef)}`} className="grid gap-2">
      <input type="hidden" name="ref" value={providerRef} />
      <SubmitButton variant="accent" size="lg" className="w-full" name="outcome" value="success" pendingText="Sending webhook…">
        Simulate successful payment
      </SubmitButton>
      <SubmitButton variant="outline" size="lg" className="w-full" name="outcome" value="declined" pendingText="Sending webhook…">
        Simulate declined card
      </SubmitButton>
      <SubmitButton variant="ghost" className="w-full" name="outcome" value="cancel" pendingText="Sending webhook…">
        Cancel checkout
      </SubmitButton>
    </ActionForm>
  );
}

export default function SandboxCheckoutPage() {
  const { txn } = useLoaderData();
  const pm = txn.paymentMilestone;
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <PageMeta title="Sandbox checkout" noindex />
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
              <p className="label-caps text-ink-muted">
                {pm.order.reference} · {pm.order.project.name}
              </p>
              <h1 className="mt-2 font-display text-xl font-medium tracking-[-0.01em] text-ink">{pm.label}</h1>
              <p className="tabular mt-4 font-display text-[2.5rem] font-[450] leading-none tracking-[-0.025em] text-ink">{formatMoney(txn.amount, txn.currency)}</p>
              <dl className="mt-5 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-xs">
                <dt className="text-ink-muted">Reference</dt>
                <dd className="min-w-0 break-all font-medium text-ink">{txn.providerRef}</dd>
              </dl>
            </div>
            <div className="space-y-4 p-5 sm:p-7">
              {txn.status !== "PENDING" ? (
                <Alert tone="info">
                  This checkout has already been processed (status: {txn.status.toLowerCase()}).{" "}
                  <Link className="font-medium underline underline-offset-4" to={`/orders/${pm.order.id}?tab=payments`}>
                    Back to the order
                  </Link>
                </Alert>
              ) : (
                <>
                  <p className="text-sm leading-6 text-ink-muted">
                    Choose an outcome to simulate. The sandbox sends a signed webhook to Fashinza, which verifies it and updates the payment — the same path a real
                    provider would use. No card details are collected.
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
