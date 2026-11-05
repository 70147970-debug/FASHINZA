import { Link, useLoaderData } from "react-router";
import { CreditCard } from "lucide-react";
import {
  DataTable,
  EmptyState,
  Metric,
  MetricStrip,
  MobileCard,
  MobileCardList,
  PageHeader,
  PageSection,
  Pagination,
  SandboxBadge,
  StatusBadge,
} from "@/components/app/primitives";
import { PayButton } from "@/components/orders/order-forms";
import { StatusTabs } from "@/components/orders/order-parts";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/meta";
import { decimalText, loadData, searchOf } from "@/lib/data";
import { PAYMENT_STATUS } from "@fashinza/shared/labels.js";
import { stageLabel } from "@fashinza/shared/workflow.js";
import { formatDate, formatDateTime, formatMoney } from "@fashinza/shared/format.js";
import { cn } from "@fashinza/shared/utils.js";

/** /payments — port of src/app/(app)/payments/page.tsx (gate: onboarded BRAND, MANUFACTURER). */

const TX_TONE = { SUCCEEDED: "success", FAILED: "danger", PENDING: "info" };

export async function loader({ request, user }) {
  const sp = searchOf(request);
  const status = sp.status && sp.status in PAYMENT_STATUS ? sp.status : undefined;
  const data = await loadData("/api/payments", { request, query: { status, page: Number(sp.page) || 1 } });
  return { data, status, actor: user };
}

export default function PaymentsPage() {
  const { data, status, actor } = useLoaderData();
  const sum = (s) => data.totals.filter((t) => t.status === s);
  const isBrand = actor.role === "BRAND";
  const counterparty = (p) => (isBrand ? p.order.manufacturer.manufacturerProfile?.businessName : p.order.brand.brandProfile?.companyName);
  /** One timing line per row (the Timing column), worded for the milestone's state. */
  const dueText = (p) =>
    p.status === "SCHEDULED"
      ? `Due after ${stageLabel(p.triggerStage).toLowerCase()}`
      : p.status === "DUE"
        ? p.dueAt
          ? `Due by ${formatDate(p.dueAt)}`
          : "Due now"
        : p.status === "PROCESSING"
          ? "Checkout in progress"
          : p.status === "FAILED"
            ? isBrand
              ? "Failed, pay again"
              : "Payment failed"
            : p.paidAt
              ? `Paid ${formatDate(p.paidAt)}`
              : "—";
  const payable = (s) => isBrand && ["DUE", "FAILED", "PROCESSING"].includes(s);
  // Group each order's milestones together in schedule order (the order page's order), keeping the orders in
  // the sequence the list returned them (most recently active first). The first payable row is then the same
  // milestone the order page's "Your next step" card highlights.
  const orderRank = new Map();
  for (const p of data.items) if (!orderRank.has(p.order.id)) orderRank.set(p.order.id, orderRank.size);
  const items = [...data.items].sort((a, b) => orderRank.get(a.order.id) - orderRank.get(b.order.id) || a.sequence - b.sequence);
  // Only the first payable milestone gets the accent button; the rest are outline, so the screen keeps one key action.
  const firstPayable = items.find((p) => payable(p.status))?.id;

  const totals = (key) => {
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

  const transactions = items
    .flatMap((p) => p.transactions.map((t) => ({ ...t, milestone: p })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <PageMeta title="Payments" />
      <PageHeader
        title="Payments"
        meta={<SandboxBadge />}
        description="Milestone payments across your orders, grouped by order in schedule order. Payments are simulated for now: no real money moves, and Fashinza does not hold funds in escrow."
      />

      <MetricStrip label="Payment totals" columns={3}>
        <Metric label={isBrand ? "Paid" : "Received"} value={totals("PAID")} muted={sum("PAID").length === 0} href="/payments?status=PAID" />
        <Metric
          label="Due now"
          value={totals("DUE")}
          muted={sum("DUE").length === 0}
          tone={sum("DUE").length ? "warning" : undefined}
          href="/payments?status=DUE"
        />
        <Metric label="Scheduled" value={totals("SCHEDULED")} muted={sum("SCHEDULED").length === 0} href="/payments?status=SCHEDULED" />
      </MetricStrip>

      <StatusTabs
        basePath="/payments"
        label="Payment status"
        value={status}
        options={Object.entries(PAYMENT_STATUS).map(([value, s]) => ({ value, label: s.label }))}
      />

      {data.items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={status ? "No payments with this status" : "No payments yet"}
          description="Each order gets a milestone payment schedule (by default 30% after sample approval, 40% after the QC report is accepted and 30% on delivery)."
          action={
            status ? (
              <Link to="/payments" className="rounded-sm text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
                Show all payments
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          <PageSection
            title="Payment milestones"
            description={isBrand ? "Pay a milestone when it becomes due; the order page shows the full schedule." : "Milestones become due as production stages complete."}
          >
            <DataTable
              label="Payment milestones"
              cards={
                <MobileCardList>
                  {items.map((p) => (
                    <MobileCard
                      key={p.id}
                      title={
                        <>
                          {p.label} · <span className="tabular">{decimalText(p.percentage)}%</span>
                        </>
                      }
                      badge={<StatusBadge map={PAYMENT_STATUS} value={p.status} />}
                      meta={
                        <>
                          <Link to={`/orders/${p.order.id}?tab=payments`} className="rounded-sm font-medium text-accent-strong underline-offset-4 hover:underline">
                            {p.order.reference}
                          </Link>{" "}
                          · {p.order.project.name} · {counterparty(p)}
                        </>
                      }
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-xs text-ink-muted">{dueText(p)}</span>
                        <span className="tabular text-sm font-medium text-ink">{formatMoney(p.amount, p.currency)}</span>
                      </span>
                      {payable(p.status) && (
                        <span className="mt-3 block">
                          <PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} quiet={p.id !== firstPayable} />
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
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col">Status</th>
                    {isBrand && (
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p, i) => (
                    <tr
                      key={p.id}
                      className={cn(p.status === "DUE" && "bg-warning-soft/60", i < items.length - 1 && items[i + 1].order.id !== p.order.id && "[&>td]:border-b-line-strong")}
                    >
                      <td>
                        <p className="cell-primary">
                          {p.label} · <span className="tabular">{decimalText(p.percentage)}%</span>
                        </p>
                      </td>
                      <td>
                        <Link to={`/orders/${p.order.id}?tab=payments`} className="rounded-sm text-[13px] font-medium text-ink hover:underline hover:underline-offset-4">
                          {p.order.project.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          <span className="tabular">{p.order.reference}</span> · {counterparty(p)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-[13px] text-ink-muted">{dueText(p)}</td>
                      <td className="num font-medium text-ink">{formatMoney(p.amount, p.currency)}</td>
                      <td>
                        <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                      </td>
                      {isBrand && (
                        <td className="text-right">
                          {payable(p.status) && (
                            <PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} quiet={p.id !== firstPayable} />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTable>
            <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/payments" params={{ status }} />
          </PageSection>

          <PageSection title="Transaction history" description="Charges and refunds reported by the payment provider (test mode) for the milestones above.">
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
                        badge={
                          <Badge tone={TX_TONE[t.status] ?? "neutral"} dot>
                            {t.status.toLowerCase()}
                          </Badge>
                        }
                        meta={
                          <>
                            {t.milestone.order.reference} · {t.milestone.label} · {formatDateTime(t.createdAt)}
                            <span className="block break-all font-mono text-2xs">ref {t.providerRef}</span>
                            {t.failureReason && <span className="block text-danger-strong">{t.failureReason}</span>}
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
                      <th scope="col" className="num">
                        Amount
                      </th>
                      <th scope="col">Result</th>
                      <th scope="col">Provider reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="tabular whitespace-nowrap text-[13px] text-ink-muted">{formatDateTime(t.createdAt)}</td>
                        <td className="text-[13px]">{t.type === "REFUND" ? "Refund" : "Charge"}</td>
                        <td className="text-[13px]">
                          <span className="tabular">{t.milestone.order.reference}</span> · {t.milestone.label}
                        </td>
                        <td className="num">{formatMoney(t.amount, t.currency)}</td>
                        <td>
                          <Badge tone={TX_TONE[t.status] ?? "neutral"} dot>
                            {t.status.toLowerCase()}
                          </Badge>
                          {t.failureReason && <p className="mt-1 max-w-56 text-xs text-danger-strong">{t.failureReason}</p>}
                        </td>
                        <td className="max-w-48 break-all font-mono text-2xs text-ink-muted">{t.providerRef}</td>
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
