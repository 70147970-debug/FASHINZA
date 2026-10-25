import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { listPayments } from "@/server/services/payments";
import { DataTable, EmptyState, Metric, MetricStrip, MobileCard, MobileCardList, PageHeader, PageSection, Pagination, SandboxBadge, StatusBadge } from "@/components/app/primitives";
import { PayButton } from "@/components/orders/order-forms";
import { StatusTabs } from "@/components/orders/order-parts";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS } from "@/lib/labels";
import { stageLabel } from "@/lib/workflow";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

const TX_TONE: Record<string, "success" | "danger" | "info" | "neutral"> = { SUCCEEDED: "success", FAILED: "danger", PENDING: "info" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireOnboardedUser(["BRAND", "MANUFACTURER"]);
  const sp = await searchParams;
  const status = sp.status && sp.status in PAYMENT_STATUS ? sp.status : undefined;
  const data = await listPayments(actor, { status, page: Number(sp.page) || 1 });
  const sum = (s: string) => data.totals.filter((t) => t.status === s);
  const isBrand = actor.role === "BRAND";
  const counterparty = (p: (typeof data.items)[number]) => (isBrand ? p.order.manufacturer.manufacturerProfile?.businessName : p.order.brand.brandProfile?.companyName);
  const dueText = (p: (typeof data.items)[number]) =>
    p.paidAt ? `Paid ${formatDate(p.paidAt)}` : p.dueAt && p.status === "DUE" ? `Due by ${formatDate(p.dueAt)}` : `After ${stageLabel(p.triggerStage).toLowerCase()}`;
  const payable = (s: string) => isBrand && ["DUE", "FAILED", "PROCESSING"].includes(s);

  const totals = (key: string) => {
    const rows = sum(key);
    if (rows.length === 0) return "—";
    return (
      <>
        {rows.map((t) => (
          <span key={t.currency} className="block">
            {formatMoney(t._sum.amount ?? 0, t.currency)}
          </span>
        ))}
      </>
    );
  };

  const transactions = data.items
    .flatMap((p) => p.transactions.map((t) => ({ ...t, milestone: p })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <PageHeader
        title="Payments"
        meta={<SandboxBadge />}
        description="Milestone payments across your orders. This build uses a sandbox payment provider: no real money moves, and Fashinza does not hold funds in escrow."
      />

      <MetricStrip label="Payment totals" columns={3}>
        <Metric label={isBrand ? "Paid" : "Received"} value={totals("PAID")} muted={sum("PAID").length === 0} href="/payments?status=PAID" />
        <Metric label="Due now" value={totals("DUE")} muted={sum("DUE").length === 0} tone={sum("DUE").length ? "warning" : undefined} href="/payments?status=DUE" />
        <Metric label="Scheduled" value={totals("SCHEDULED")} muted={sum("SCHEDULED").length === 0} href="/payments?status=SCHEDULED" />
      </MetricStrip>

      <StatusTabs basePath="/payments" label="Payment status" value={status} options={Object.entries(PAYMENT_STATUS).map(([value, s]) => ({ value, label: s.label }))} />

      {data.items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={status ? "No payments with this status" : "No payments yet"}
          description="Each order gets a milestone payment schedule (by default 30% after sample approval, 40% after the QC report is accepted and 30% on delivery)."
          action={status ? <Link href="/payments" className="text-sm font-medium text-teal-700 hover:underline">Show all payments</Link> : undefined}
        />
      ) : (
        <div className="space-y-8">
          <PageSection title="Payment milestones" description={isBrand ? "Pay a milestone when it becomes due; the order page shows the full schedule." : "Milestones become due as production stages complete."}>
            <DataTable
              label="Payment milestones"
              cards={
                <MobileCardList>
                  {data.items.map((p) => (
                    <MobileCard
                      key={p.id}
                      title={
                        <>
                          {p.label} · <span className="tabular">{p.percentage.toString()}%</span>
                        </>
                      }
                      badge={<StatusBadge map={PAYMENT_STATUS} value={p.status} />}
                      meta={
                        <>
                          <Link href={`/orders/${p.order.id}#payments`} className="font-medium text-teal-700 hover:underline">{p.order.reference}</Link> · {p.order.project.name} · {counterparty(p)}
                        </>
                      }
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted">{dueText(p)}</span>
                        <span className="tabular text-sm font-semibold text-navy">{formatMoney(p.amount, p.currency)}</span>
                      </span>
                      {payable(p.status) && (
                        <span className="mt-3 block">
                          <PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} />
                        </span>
                      )}
                    </MobileCard>
                  ))}
                </MobileCardList>
              }
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Milestone</th>
                    <th scope="col">Order</th>
                    <th scope="col">Timing</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col">Status</th>
                    {isBrand && <th scope="col"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id} className={p.status === "DUE" ? "bg-warning-50/40" : undefined}>
                      <td>
                        <p className="cell-primary">
                          {p.label} · <span className="tabular">{p.percentage.toString()}%</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">Due after {stageLabel(p.triggerStage).toLowerCase()}</p>
                      </td>
                      <td>
                        <Link href={`/orders/${p.order.id}#payments`} className="rounded-sm text-[13px] font-medium text-navy hover:underline hover:underline-offset-4">
                          {p.order.project.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted">
                          <span className="tabular">{p.order.reference}</span> · {counterparty(p)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-[13px] text-muted">{dueText(p)}</td>
                      <td className="num font-semibold text-navy">{formatMoney(p.amount, p.currency)}</td>
                      <td>
                        <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                      </td>
                      {isBrand && <td className="text-right">{payable(p.status) && <PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} />}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
            <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/payments" params={{ status }} />
          </PageSection>

          <PageSection title="Transaction history" description="Charges and refunds reported by the sandbox provider for the milestones above.">
            {transactions.length === 0 ? (
              <EmptyState icon={CreditCard} title="No transactions yet" description="A transaction is recorded each time a milestone payment is attempted or refunded." />
            ) : (
              <DataTable
                label="Transaction history"
                cards={
                  <MobileCardList>
                    {transactions.map((t) => (
                      <MobileCard
                        key={t.id}
                        title={
                          <>
                            {t.type === "REFUND" ? "Refund" : "Charge"} · <span className="tabular">{formatMoney(t.amount, t.currency)}</span>
                          </>
                        }
                        badge={<Badge tone={TX_TONE[t.status] ?? "neutral"} dot>{t.status.toLowerCase()}</Badge>}
                        meta={
                          <>
                            {t.milestone.order.reference} · {t.milestone.label} · {formatDateTime(t.createdAt)}
                            <span className="block break-all font-mono text-2xs">ref {t.providerRef}</span>
                            {t.failureReason && <span className="block text-danger-700">{t.failureReason}</span>}
                          </>
                        }
                      />
                    ))}
                  </MobileCardList>
                }
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">When (UTC)</th>
                      <th scope="col">Type</th>
                      <th scope="col">Milestone</th>
                      <th scope="col" className="num">Amount</th>
                      <th scope="col">Result</th>
                      <th scope="col">Provider reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="tabular whitespace-nowrap text-[13px] text-muted">{formatDateTime(t.createdAt)}</td>
                        <td className="text-[13px]">{t.type === "REFUND" ? "Refund" : "Charge"}</td>
                        <td className="text-[13px]">
                          <span className="tabular">{t.milestone.order.reference}</span> · {t.milestone.label}
                        </td>
                        <td className="num">{formatMoney(t.amount, t.currency)}</td>
                        <td>
                          <Badge tone={TX_TONE[t.status] ?? "neutral"} dot>{t.status.toLowerCase()}</Badge>
                          {t.failureReason && <p className="mt-1 max-w-56 text-xs text-danger-700">{t.failureReason}</p>}
                        </td>
                        <td className="max-w-48 break-all font-mono text-2xs text-muted">{t.providerRef}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            )}
          </PageSection>
        </div>
      )}
    </>
  );
}
