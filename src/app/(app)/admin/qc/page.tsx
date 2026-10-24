import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { qcOverview } from "@/server/services/admin";
import { PageHeader, Panel } from "@/components/app/primitives";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Quality issues" };

export default async function AdminQcPage() {
  const actor = await requireUser(["ADMIN"]);
  const d = await qcOverview(actor);
  return (
    <>
      <PageHeader title="Quality issues" description={`Failed inspections, brand-rejected reports and open rework. ${d.pendingDecisions} passed report${d.pendingDecisions === 1 ? " is" : "s are"} waiting for brand decisions.`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title={`Open rework (${d.openRework.length})`}>
          {d.openRework.length === 0 ? <p className="text-sm text-muted">No open rework.</p> : (
            <ul className="space-y-3 text-sm">
              {d.openRework.map((r) => (
                <li key={r.id}>
                  <Link href={`/orders/${r.order.id}#quality`} className="font-medium text-navy hover:underline">{r.order.reference} · {r.order.project.name}</Link>
                  <p className="text-xs text-muted">Opened {formatDate(r.createdAt)}</p>
                  <p className="mt-0.5 line-clamp-3 text-xs">{r.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Failed inspections">
          {d.failed.length === 0 ? <p className="text-sm text-muted">No failed inspections.</p> : (
            <ul className="space-y-3 text-sm">
              {d.failed.map((r) => (
                <li key={r.id}>
                  <Link href={`/orders/${r.order.id}#quality`} className="font-medium text-navy hover:underline">{r.order.reference} · {r.order.project.name}</Link>
                  <p className="text-xs text-muted">{formatDate(r.inspectionDate)} · {r.criticalCount} critical, {r.majorCount} major, {r.minorCount} minor in {r.sampleSize} units</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Rejected by brand">
          {d.rejectedByBrand.length === 0 ? <p className="text-sm text-muted">No reports rejected by brands.</p> : (
            <ul className="space-y-3 text-sm">
              {d.rejectedByBrand.map((r) => (
                <li key={r.id}>
                  <Link href={`/orders/${r.order.id}#quality`} className="font-medium text-navy hover:underline">{r.order.reference} · {r.order.project.name}</Link>
                  <p className="text-xs text-muted">{formatDate(r.decidedAt)}</p>
                  {r.brandDecisionNote && <p className="mt-0.5 text-xs">{r.brandDecisionNote}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
