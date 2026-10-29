import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Webhook } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { paymentOverview } from "@/server/services/admin";
import { EmptyState, PageHeader, Pagination, Panel, SandboxBadge, StatusBadge } from "@/components/app/primitives";
import { RefundButton } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS } from "@/lib/labels";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Payment events" };

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const d = await paymentOverview(actor, { page: Number(sp.page) || 1 });
  const errors = d.events.filter((e) => e.error && !e.processedAt).length;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Payment events"
        meta={<SandboxBadge />}
        description="Webhook deliveries from the payment provider and payment milestones in progress. Payments change state only through verified webhooks."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel
            title={`Webhook events (${d.total})`}
            description={errors ? `${errors} event${errors === 1 ? "" : "s"} on this page could not be applied.` : "Newest first. Each event is applied once."}
            bodyClassName="p-0 sm:p-0"
          >
            {d.events.length === 0 ? (
              <EmptyState variant="plain" icon={Webhook} title="No webhook events yet" description="Events arrive when the sandbox provider reports a charge or refund." />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Event</th>
                    <th scope="col" className="hidden sm:table-cell">
                      Received (UTC)
                    </th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {d.events.map((e) => (
                    <tr key={e.id} className={e.error && !e.processedAt ? "bg-danger-soft/40" : undefined}>
                      <td>
                        <p className="break-words font-mono text-[13px] font-medium text-ink">{e.type}</p>
                        <p className="mt-0.5 break-all font-mono text-2xs text-ink-muted">
                          {e.provider} · {e.eventId}
                        </p>
                        <p className="tabular mt-0.5 text-xs text-ink-muted sm:hidden">{formatDateTime(e.createdAt)}</p>
                      </td>
                      <td className="tabular hidden whitespace-nowrap text-[13px] text-ink-muted sm:table-cell">{formatDateTime(e.createdAt)}</td>
                      <td>
                        {e.processedAt ? (
                          <Badge tone="success" dot>
                            Processed
                          </Badge>
                        ) : e.error ? (
                          <Badge tone="danger" dot>
                            Error
                          </Badge>
                        ) : (
                          <Badge tone="warning" dot>
                            Pending
                          </Badge>
                        )}
                        {e.error && <p className="mt-1 max-w-56 break-words text-xs text-danger-strong">{e.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Pagination page={d.page} pages={d.pages} total={d.total} basePath="/admin/payments" params={{}} />
        </div>

        <Panel title="Recent payment milestones" description="Paid and in-progress milestones. Refunds go through the provider." bodyClassName="p-0 sm:p-0">
          {d.refundable.length === 0 ? (
            <EmptyState variant="plain" icon={CreditCard} title="No payments yet" description="No payments in progress or paid yet." />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {d.refundable.map((p) => (
                <li key={p.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/orders/${p.order.id}#payments`} className="rounded-sm text-sm font-medium text-ink underline-offset-4 hover:underline">
                        <span className="tabular">{p.order.reference}</span> · {p.label}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {p.transactions.length} transaction{p.transactions.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="tabular text-sm font-medium text-ink">{formatMoney(p.amount, p.currency)}</span>
                      <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                    </div>
                  </div>
                  {p.status === "PAID" && !p.transactions.some((t) => t.type === "REFUND" && t.status === "PENDING") && (
                    <div className="mt-2.5">
                      <RefundButton paymentMilestoneId={p.id} amount={formatMoney(p.amount, p.currency)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
