import { Link, useLoaderData } from "react-router";
import { FileText } from "lucide-react";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { QUOTATION_STATUS, categoryLabel } from "@fashinza/shared/labels.js";
import { formatDate, formatMoney } from "@fashinza/shared/format.js";

/** /quotations — port of src/app/(app)/quotations/page.tsx (gate: onboarded MANUFACTURER). */

export async function loader({ request }) {
  const sp = searchOf(request);
  const status = sp.status && sp.status in QUOTATION_STATUS ? sp.status : undefined;
  const data = await loadData("/api/quotations", { request, query: { status, page: Number(sp.page) || 1 } });
  return { data, status };
}

export default function QuotationsPage() {
  const { data, status } = useLoaderData();
  const href = (q) => (q.status === "ACCEPTED" && q.project.order ? `/orders/${q.project.order.id}` : `/opportunities/${q.project.id}`);
  return (
    <>
      <PageMeta title="Quotations" />
      <PageHeader title="Quotations" description="Every quotation you have drafted or sent, with its current status." />
      <StatusTabs
        basePath="/quotations"
        label="Quotation status"
        value={status}
        options={Object.entries(QUOTATION_STATUS).map(([value, s]) => ({ value, label: s.label }))}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={status ? "No quotations with this status" : "No quotations yet"}
          description="Open an opportunity to prepare a quotation."
          action={
            status ? (
              <Button asChild variant="outline">
                <Link to="/quotations">Show all quotations</Link>
              </Button>
            ) : (
              <Button asChild variant="accent">
                <Link to="/opportunities">View opportunities</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            label="Quotations"
            cards={
              <MobileCardList>
                {data.items.map((q) => (
                  <MobileCard
                    key={q.id}
                    href={href(q)}
                    title={q.project.name}
                    badge={<StatusBadge map={QUOTATION_STATUS} value={q.status} />}
                    meta={`${categoryLabel(q.project.category)} · v${q.version} · valid until ${formatDate(q.validUntil)}`}
                  >
                    <span className="tabular font-display text-lg font-medium text-ink">{formatMoney(q.totalAmount, q.currency)}</span>
                  </MobileCard>
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col">Version</th>
                  <th scope="col">Valid until</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((q) => (
                  <tr key={q.id}>
                    <td className="max-w-80">
                      <Link to={href(q)} className="cell-primary block truncate">
                        {q.project.name}
                      </Link>
                      <p className="text-xs leading-5 text-ink-muted">{categoryLabel(q.project.category)}</p>
                    </td>
                    <td>
                      <StatusBadge map={QUOTATION_STATUS} value={q.status} />
                    </td>
                    <td className="num font-medium text-ink">{formatMoney(q.totalAmount, q.currency)}</td>
                    <td className="tabular text-ink-muted">v{q.version}</td>
                    <td className="tabular whitespace-nowrap">{formatDate(q.validUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/quotations" params={{ status }} />
        </>
      )}
    </>
  );
}
