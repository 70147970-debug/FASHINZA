import { Link, useLoaderData } from "react-router";
import { CreditCard, Webhook } from "lucide-react";
import { EmptyState, PageHeader, Pagination, Panel, SandboxBadge, StatusBadge } from "@/components/app/primitives";
import { RefundButton } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { PAYMENT_STATUS } from "@fashinza/shared/labels.js";
import { formatDateTime, formatMoney } from "@fashinza/shared/format.js";

/**
 * /admin/payments — port of src/app/(app)/admin/payments/page.tsx (gate: user ADMIN).
 * Money first: the milestones (and refunds) an admin may act on lead in the wide column; the provider's webhook
 * log follows as supporting detail. `?events=errors` narrows the log to events that could not be applied, the
 * same set the overview's "Unprocessed webhook errors" queue counts.
 */
export async function loader({ request }) {
  const sp = searchOf(request);
  const errorsOnly = sp.events === "errors";
  const d = await loadData("/api/admin/payments", { request, query: { page: Number(sp.page) || 1, events: errorsOnly ? "errors" : undefined } });
  return { d, errorsOnly };
}

export default function AdminPaymentsPage() {
  const { d, errorsOnly } = useLoaderData();
  const errors = d.events.filter((e) => e.error && !e.processedAt).length;
  const brandName = (o) => o.brand.brandProfile?.companyName ?? o.brand.name;

  return (
    <>
      <PageMeta title="Payment events" />
      <PageHeader
        eyebrow="Administration"
        title="Payment events"
        meta={<SandboxBadge />}
        description="Milestone payments and refunds, then the payment provider's event log. Payments change state only through verified provider events."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Recent payment milestones"
          description="Paid and in-progress milestones, most recently updated first. Refunds go through the provider."
          bodyClassName="p-0 sm:p-0"
        >
          {d.refundable.length === 0 ? (
            <EmptyState variant="plain" icon={CreditCard} title="No payments yet" description="No payments in progress or paid yet." />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {d.refundable.map((p) => (
                <li key={p.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/orders/${p.order.id}?tab=payments`} className="rounded-sm text-sm font-medium text-ink underline-offset-4 hover:underline">
                        {p.order.project.name} · {p.label}
                      </Link>
                      <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                        <span className="tabular">{p.order.reference}</span> · {brandName(p.order)} · {p.transactions.length} transaction
                        {p.transactions.length === 1 ? "" : "s"}
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

        <div className="min-w-0 space-y-4">
          <Panel
            title={errorsOnly ? `Events with errors (${d.total})` : `Webhook events (${d.total})`}
            description={
              errors
                ? `${errors} event${errors === 1 ? "" : "s"} on this page could not be applied (highlighted in red). Errors are counted per page.`
                : errorsOnly
                  ? "Every provider event was applied."
                  : "Newest first. Each event is applied once. Events that could not be applied are highlighted in red."
            }
            actions={
              <Link
                to={errorsOnly ? "/admin/payments" : "/admin/payments?events=errors"}
                className="inline-flex min-h-8 items-center rounded-sm text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline max-sm:min-h-10"
              >
                {errorsOnly ? "Show all events" : "Show errors only"}
              </Link>
            }
            bodyClassName="p-0 sm:p-0"
          >
            {d.events.length === 0 ? (
              <EmptyState
                variant="plain"
                icon={Webhook}
                title={errorsOnly ? "No unprocessed errors" : "No webhook events yet"}
                description={
                  errorsOnly ? "Events that fail to apply appear here until they are processed." : "Events arrive when the payment provider reports a charge or refund."
                }
              />
            ) : (
              // In the narrow side column (xl to 2xl) the received time moves under the event, as on phones.
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Event</th>
                      <th scope="col" className="hidden sm:table-cell xl:hidden 2xl:table-cell">
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
                          <p className="tabular mt-0.5 text-xs text-ink-muted sm:hidden xl:block 2xl:hidden">{formatDateTime(e.createdAt)}</p>
                        </td>
                        <td className="tabular hidden whitespace-nowrap text-[13px] text-ink-muted sm:table-cell xl:hidden 2xl:table-cell">{formatDateTime(e.createdAt)}</td>
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
              </div>
            )}
          </Panel>
          <Pagination page={d.page} pages={d.pages} total={d.total} basePath="/admin/payments" params={{ events: errorsOnly ? "errors" : undefined }} />
        </div>
      </div>
    </>
  );
}
