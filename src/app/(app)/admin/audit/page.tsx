import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listAudit } from "@/server/services/admin";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { auditActionLabel, auditTone, targetLabel } from "@/components/admin/audit-parts";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

const DOT = { success: "bg-success", danger: "bg-danger", warning: "bg-warning", info: "bg-slate-blue", neutral: "bg-neutral-400" } as const;

function AuditDetails({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <details className="group mt-1">
      <summary className="inline-flex min-h-6 cursor-pointer list-none items-center rounded-sm text-xs font-medium text-teal-700 hover:underline hover:underline-offset-4 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show details</span>
        <span className="hidden group-open:inline">Hide details</span>
      </summary>
      <pre className="mt-1 max-w-full whitespace-pre-wrap break-all rounded-md bg-surface-muted p-2 font-mono text-2xs leading-4 text-muted">{JSON.stringify(value, null, 1)}</pre>
    </details>
  );
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; targetType?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const data = await listAudit(actor, { q: sp.q, targetType: sp.targetType || undefined, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Append-only record of administrative and sensitive actions: who did what, to which record, when and why."
      />
      <FilterBar
        basePath="/admin/audit"
        q={sp.q}
        searchLabel="Search action, reason or record id"
        selects={[{ name: "targetType", label: "Record type", value: sp.targetType, options: data.types.map((t) => ({ value: t, label: targetLabel(t) })) }]}
      />
      {data.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" description="Verification decisions, suspensions, refunds and dispute updates are recorded here." />
      ) : (
        <>
          {/* The table comes first in the DOM so the raw action codes are found there on desktop; phones get cards. */}
          <DataTable label="Audit log entries" className="hidden md:block">
            <table className="data-table [&_td]:py-2.5 [&_td]:align-top">
              <thead>
                <tr>
                  <th scope="col">When (UTC)</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="tabular whitespace-nowrap text-[13px] text-muted">{formatDateTime(a.createdAt)}</td>
                    <td className="text-[13px]">
                      <span className="font-medium text-ink">{a.actor.name}</span>
                      <p className="text-xs text-muted">{a.actor.email}</p>
                    </td>
                    <td>
                      <span className="flex items-center gap-2 text-[13px] font-medium text-navy">
                        <span className={cn("size-1.5 shrink-0 rounded-full", DOT[auditTone(a.action)])} aria-hidden />
                        {auditActionLabel(a.action)}
                      </span>
                      <p className="mt-0.5 pl-3.5 font-mono text-2xs text-muted">{a.action}</p>
                    </td>
                    <td className="text-[13px]">
                      {targetLabel(a.targetType)}
                      <p className="max-w-44 truncate font-mono text-2xs text-muted" title={a.targetId}>
                        {a.targetId}
                      </p>
                    </td>
                    <td className="min-w-48 max-w-80 text-[13px] leading-5">
                      {a.reason ?? <span className="text-muted">—</span>}
                      <AuditDetails value={a.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <div className="md:hidden">
            <MobileCardList>
              {data.items.map((a) => (
                <MobileCard
                  key={a.id}
                  title={
                    <span className="flex items-center gap-2">
                      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[auditTone(a.action)])} aria-hidden />
                      {auditActionLabel(a.action)}
                    </span>
                  }
                  meta={
                    <>
                      <span className="tabular">{formatDateTime(a.createdAt)}</span> · {a.actor.name}
                      <span className="block break-all font-mono text-2xs">
                        {targetLabel(a.targetType)} · {a.targetId}
                      </span>
                    </>
                  }
                >
                  {a.reason && <span className="block text-[13px] leading-5 text-ink">{a.reason}</span>}
                </MobileCard>
              ))}
            </MobileCardList>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/audit" params={{ q: sp.q, targetType: sp.targetType }} />
        </>
      )}
    </>
  );
}
