import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { listPayments } from "@/server/services/payments";
import { EmptyState, PageHeader, Pagination, Panel, SandboxBadge, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { PayButton } from "@/components/orders/order-forms";
import { PAYMENT_STATUS } from "@/lib/labels";
import { stageLabel } from "@/lib/workflow";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireOnboardedUser(["BRAND", "MANUFACTURER"]);
  const sp = await searchParams;
  const status = sp.status && sp.status in PAYMENT_STATUS ? sp.status : undefined;
  const data = await listPayments(actor, { status, page: Number(sp.page) || 1 });
  const sum = (s: string) => data.totals.filter((t) => t.status === s);

  return (
    <>
      <PageHeader
        title="Payments"
        meta={<SandboxBadge />}
        description="Milestone payments across your orders. This build uses a sandbox payment provider: no real money moves, and Fashinza does not hold funds in escrow."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: actor.role === "BRAND" ? "Paid" : "Received", key: "PAID" },
          { label: "Due now", key: "DUE" },
          { label: "Scheduled", key: "SCHEDULED" },
        ].map((c) => (
          <Panel key={c.key} bodyClassName="p-4">
            <p className="text-xs text-muted">{c.label}</p>
            {sum(c.key).length === 0 ? (
              <p className="tabular mt-1 font-display text-xl font-semibold text-navy">—</p>
            ) : (
              sum(c.key).map((t) => <p key={t.currency} className="tabular mt-1 font-display text-xl font-semibold text-navy">{formatMoney(t._sum.amount ?? 0, t.currency)}</p>)
            )}
          </Panel>
        ))}
      </div>
      <FilterBar basePath="/payments" selects={[{ name: "status", label: "Status", value: status, options: Object.entries(PAYMENT_STATUS).map(([value, s]) => ({ value, label: s.label })) }]} />
      {data.items.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet" description="Each order gets a milestone payment schedule (by default 30% after sample approval, 40% after the QC report is accepted and 30% on delivery)." />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((p) => (
              <li key={p.id} className="rounded-lg border border-line bg-white p-4 shadow-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{p.label} · {p.percentage.toString()}%</p>
                    <p className="text-xs text-muted">
                      <Link href={`/orders/${p.order.id}#payments`} className="hover:underline">{p.order.reference} · {p.order.project.name}</Link> ·{" "}
                      {actor.role === "BRAND" ? p.order.manufacturer.manufacturerProfile?.businessName : p.order.brand.brandProfile?.companyName}
                    </p>
                    <p className="text-xs text-muted">Due after {stageLabel(p.triggerStage).toLowerCase()}{p.dueAt && p.status === "DUE" ? ` · by ${formatDate(p.dueAt)}` : ""}{p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <span className="tabular font-semibold">{formatMoney(p.amount, p.currency)}</span>
                    <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                  </div>
                </div>
                {actor.role === "BRAND" && ["DUE", "FAILED", "PROCESSING"].includes(p.status) && <div className="mt-3"><PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} /></div>}
                {p.transactions.length > 0 && (
                  <details className="mt-3 border-t border-line pt-2">
                    <summary className="cursor-pointer text-xs font-medium text-teal-700">Transaction history ({p.transactions.length})</summary>
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {p.transactions.map((t) => (
                        <li key={t.id}>
                          {t.type === "REFUND" ? "Refund" : "Charge"} · {t.status.toLowerCase()} · {formatMoney(t.amount, t.currency)} · {formatDateTime(t.createdAt)} · ref {t.providerRef}
                          {t.failureReason ? ` · ${t.failureReason}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/payments" params={{ status }} />
        </>
      )}
    </>
  );
}
