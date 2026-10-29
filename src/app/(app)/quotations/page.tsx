import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { QuotationStatus } from "@/generated/prisma/enums";
import { requireOnboardedUser } from "@/server/auth/session";
import { listMyQuotations } from "@/server/services/opportunities";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { Button } from "@/components/ui/button";
import { QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const sp = await searchParams;
  const status = sp.status && sp.status in QUOTATION_STATUS ? (sp.status as QuotationStatus) : undefined;
  const data = await listMyQuotations(actor, { status, page: Number(sp.page) || 1 });
  const href = (q: (typeof data.items)[number]) => (q.status === "ACCEPTED" && q.project.order ? `/orders/${q.project.order.id}` : `/opportunities/${q.project.id}`);
  return (
    <>
      <PageHeader title="Quotations" description="Every quotation you have drafted or sent, with its current status." />
      <FilterBar basePath="/quotations" selects={[{ name: "status", label: "Status", value: status, options: Object.entries(QUOTATION_STATUS).map(([value, s]) => ({ value, label: s.label })) }]} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={status ? "No quotations with this status" : "No quotations yet"}
          description="Open an opportunity to prepare a quotation."
          action={status ? <Button asChild variant="outline"><Link href="/quotations">Clear filter</Link></Button> : <Button asChild variant="accent"><Link href="/opportunities">View opportunities</Link></Button>}
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
                  <th scope="col" className="num">Total</th>
                  <th scope="col">Version</th>
                  <th scope="col">Valid until</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((q) => (
                  <tr key={q.id}>
                    <td className="max-w-80">
                      <Link href={href(q)} className="cell-primary block truncate">{q.project.name}</Link>
                      <p className="text-xs leading-5 text-ink-muted">{categoryLabel(q.project.category)}</p>
                    </td>
                    <td><StatusBadge map={QUOTATION_STATUS} value={q.status} /></td>
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
