import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { QuotationStatus } from "@/generated/prisma/enums";
import { requireOnboardedUser } from "@/server/auth/session";
import { listMyQuotations } from "@/server/services/opportunities";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
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
  return (
    <>
      <PageHeader title="Quotations" description="Every quotation you have drafted or sent, with its current status." />
      <FilterBar basePath="/quotations" selects={[{ name: "status", label: "Status", value: status, options: Object.entries(QUOTATION_STATUS).map(([value, s]) => ({ value, label: s.label })) }]} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={status ? "No quotations with this status" : "No quotations yet"}
          description="Open an opportunity to prepare a quotation."
          action={<Button asChild variant="accent"><Link href="/opportunities">View opportunities</Link></Button>}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Project</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Version</th>
                  <th scope="col" className="px-4 py-3 font-medium">Valid until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((q) => (
                  <tr key={q.id} className="hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link href={q.status === "ACCEPTED" && q.project.order ? `/orders/${q.project.order.id}` : `/opportunities/${q.project.id}`} className="font-medium text-navy hover:underline">{q.project.name}</Link>
                      <p className="text-xs text-muted">{categoryLabel(q.project.category)}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge map={QUOTATION_STATUS} value={q.status} /></td>
                    <td className="tabular px-4 py-3 text-right">{formatMoney(q.totalAmount, q.currency)}</td>
                    <td className="px-4 py-3">v{q.version}</td>
                    <td className="px-4 py-3">{formatDate(q.validUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/quotations" params={{ status }} />
        </>
      )}
    </>
  );
}
