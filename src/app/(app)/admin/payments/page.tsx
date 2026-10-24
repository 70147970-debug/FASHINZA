import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { paymentOverview } from "@/server/services/admin";
import { PageHeader, Pagination, Panel, SandboxBadge, StatusBadge } from "@/components/app/primitives";
import { RefundButton } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS } from "@/lib/labels";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Payment events" };

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const d = await paymentOverview(actor, { page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Payment events" meta={<SandboxBadge />} description="Webhook deliveries from the payment provider and payment milestones in progress. Payments change state only through verified webhooks." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Recent payment milestones" bodyClassName="p-0">
          {d.refundable.length === 0 ? <p className="p-5 text-sm text-muted">No payments in progress or paid yet.</p> : (
            <ul className="divide-y divide-line">
              {d.refundable.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/orders/${p.order.id}#payments`} className="text-sm font-medium text-navy hover:underline">{p.order.reference} · {p.label}</Link>
                    <p className="text-xs text-muted">{p.transactions.length} transaction{p.transactions.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular text-sm font-medium">{formatMoney(p.amount, p.currency)}</span>
                    <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                    {p.status === "PAID" && !p.transactions.some((t) => t.type === "REFUND" && t.status === "PENDING") && <RefundButton paymentMilestoneId={p.id} amount={formatMoney(p.amount, p.currency)} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`Webhook events (${d.total})`} bodyClassName="p-0">
          {d.events.length === 0 ? <p className="p-5 text-sm text-muted">No webhook events received yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Event</th>
                    <th scope="col" className="px-4 py-2 font-medium">Received</th>
                    <th scope="col" className="px-4 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.events.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2"><p className="font-medium text-navy">{e.type}</p><p className="font-mono text-2xs text-muted">{e.provider} · {e.eventId}</p></td>
                      <td className="px-4 py-2 text-xs">{formatDateTime(e.createdAt)}</td>
                      <td className="px-4 py-2">
                        {e.processedAt ? <Badge tone="success">Processed</Badge> : e.error ? <Badge tone="danger">Error</Badge> : <Badge tone="warning">Pending</Badge>}
                        {e.error && <p className="mt-1 max-w-56 text-xs text-danger">{e.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
      <Pagination page={d.page} pages={d.pages} total={d.total} basePath="/admin/payments" params={{}} />
    </>
  );
}
