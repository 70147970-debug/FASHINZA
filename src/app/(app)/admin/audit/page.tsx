import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listAudit } from "@/server/services/admin";
import { EmptyState, PageHeader, Pagination } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; targetType?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const data = await listAudit(actor, { q: sp.q, targetType: sp.targetType || undefined, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of administrative and sensitive actions: who did what, to which record, when and why." />
      <FilterBar
        basePath="/admin/audit"
        q={sp.q}
        searchLabel="Search action, reason or record id"
        selects={[{ name: "targetType", label: "Record type", value: sp.targetType, options: data.types.map((t) => ({ value: t, label: t })) }]}
      />
      {data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Verification decisions, suspensions, refunds and dispute updates are recorded here." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">When (UTC)</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                  <th scope="col" className="px-4 py-3 font-medium">Action</th>
                  <th scope="col" className="px-4 py-3 font-medium">Target</th>
                  <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(a.createdAt)}</td>
                    <td className="px-4 py-3">{a.actor.name}<p className="text-xs text-muted">{a.actor.email}</p></td>
                    <td className="px-4 py-3 font-medium text-navy">{a.action}</td>
                    <td className="px-4 py-3">{a.targetType}<p className="font-mono text-2xs text-muted">{a.targetId}</p></td>
                    <td className="max-w-72 px-4 py-3 text-xs">{a.reason ?? "—"}{a.metadata ? <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-2xs text-muted">{JSON.stringify(a.metadata)}</pre> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/audit" params={{ q: sp.q, targetType: sp.targetType }} />
        </>
      )}
    </>
  );
}
