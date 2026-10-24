import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { IssueStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/server/auth/session";
import { listDisputes } from "@/server/services/disputes";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ROLE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Disputes" };

export default async function AdminDisputesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const status = sp.status && sp.status in DISPUTE_STATUS ? (sp.status as IssueStatus) : undefined;
  const data = await listDisputes(actor, { status, page: Number(sp.page) || 1, pageSize: 20 });
  return (
    <>
      <PageHeader title="Disputes" description="Investigate with the order's milestones, QC reports, payments and messages, then record a resolution." />
      <FilterBar basePath="/admin/disputes" selects={[{ name: "status", label: "Status", value: status, options: Object.entries(DISPUTE_STATUS).map(([value, s]) => ({ value, label: s.label })) }]} />
      {data.items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No disputes" description="Disputes raised by brands or factories appear here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Subject</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category</th>
                  <th scope="col" className="px-4 py-3 font-medium">Order / project</th>
                  <th scope="col" className="px-4 py-3 font-medium">Raised by</th>
                  <th scope="col" className="px-4 py-3 font-medium">Opened</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((d) => (
                  <tr key={d.id} className="hover:bg-canvas">
                    <td className="px-4 py-3"><Link href={`/disputes/${d.id}`} className="font-medium text-navy hover:underline">{d.subject}</Link></td>
                    <td className="px-4 py-3">{DISPUTE_CATEGORY[d.category]}</td>
                    <td className="px-4 py-3">{d.order ? <Link href={`/orders/${d.order.id}`} className="hover:underline">{d.order.reference}</Link> : d.project?.name ?? "—"}</td>
                    <td className="px-4 py-3">{d.reporter.name}<p className="text-xs text-muted">{ROLE_LABEL[d.reporter.role]}</p></td>
                    <td className="px-4 py-3">{formatDate(d.createdAt)}</td>
                    <td className="px-4 py-3"><StatusBadge map={DISPUTE_STATUS} value={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/disputes" params={{ status }} />
        </>
      )}
    </>
  );
}
