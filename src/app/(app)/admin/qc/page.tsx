import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardX, ScanSearch, ThumbsDown, Wrench } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { qcOverview } from "@/server/services/admin";
import { Metric, MetricStrip, PageHeader, Panel } from "@/components/app/primitives";
import { InlineEmpty } from "@/components/orders/order-parts";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Quality issues" };

/** Lists show the latest 25 records (see qcOverview); the count says so when the cap is reached. */
const CAP = 25;
const capped = (n: number) => (n >= CAP ? `${CAP}+` : n);

function OrderLink({ order }: { order: { id: string; reference: string; project: { name: string } } }) {
  return (
    <Link href={`/orders/${order.id}#quality`} className="rounded-sm text-sm font-medium text-navy underline-offset-4 hover:underline">
      {order.project.name}
      <span className="tabular font-normal text-muted"> · {order.reference}</span>
    </Link>
  );
}

function Count({ n, label, bad }: { n: number; label: string; bad: boolean }) {
  return (
    <span className={cn("tabular", n > 0 && bad ? "font-semibold text-danger-700" : n > 0 ? "font-medium text-ink" : "text-muted")}>
      {n} {label}
    </span>
  );
}

export default async function AdminQcPage() {
  const actor = await requireUser(["ADMIN"]);
  const d = await qcOverview(actor);
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Quality issues"
        description={`Failed inspections, brand-rejected reports and open rework. ${d.pendingDecisions} passed report${d.pendingDecisions === 1 ? " is" : "s are"} waiting for brand decisions.`}
      />

      <MetricStrip label="Quality summary" columns={4}>
        <Metric label="Open rework" value={d.openRework.length} href="#rework" icon={Wrench} tone={d.openRework.length ? "warning" : undefined} hint="Batches being reworked" />
        <Metric label="Failed inspections" value={capped(d.failed.length)} href="#failed" icon={ClipboardX} tone={d.failed.length ? "danger" : undefined} hint="Over the AQL accept limits" />
        <Metric label="Rejected by brand" value={capped(d.rejectedByBrand.length)} href="#rejected" icon={ThumbsDown} hint="Passed reports the brand declined" />
        <Metric label="Awaiting brand decision" value={d.pendingDecisions} icon={ScanSearch} hint="Passed reports not yet accepted" />
      </MetricStrip>

      <div className="space-y-6">
        <Panel id="rework" title="Open rework" description="Oldest first. Production returns to stitching until the batch is re-inspected." bodyClassName={d.openRework.length ? "p-0 sm:p-0" : undefined}>
          {d.openRework.length === 0 ? (
            <InlineEmpty icon={Wrench}>No open rework. A rework task opens when a brand rejects a passed inspection.</InlineEmpty>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {d.openRework.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-start sm:gap-6 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <OrderLink order={r.order} />
                    <p className="mt-1 line-clamp-3 text-[13px] leading-5 text-ink">{r.description}</p>
                  </div>
                  <p className="tabular shrink-0 text-xs text-muted">Opened {formatDate(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel id="failed" title="Failed inspections" description={`Latest ${CAP}, newest first.`} bodyClassName={d.failed.length ? "p-0 sm:p-0" : undefined}>
            {d.failed.length === 0 ? (
              <InlineEmpty icon={ClipboardX}>No failed inspections.</InlineEmpty>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {d.failed.map((r) => (
                  <li key={r.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <OrderLink order={r.order} />
                      <span className="tabular text-xs text-muted">{formatDate(r.inspectionDate)}</span>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      <Count n={r.criticalCount} label="critical" bad />
                      <Count n={r.majorCount} label="major" bad />
                      <Count n={r.minorCount} label="minor" bad={false} />
                      <span className="tabular text-muted">in {formatNumber(r.sampleSize)} units inspected</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="rejected" title="Rejected by brand" description={`Latest ${CAP}, newest first.`} bodyClassName={d.rejectedByBrand.length ? "p-0 sm:p-0" : undefined}>
            {d.rejectedByBrand.length === 0 ? (
              <InlineEmpty icon={ThumbsDown}>No reports rejected by brands.</InlineEmpty>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {d.rejectedByBrand.map((r) => (
                  <li key={r.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <OrderLink order={r.order} />
                      <span className="tabular text-xs text-muted">{formatDate(r.decidedAt)}</span>
                    </div>
                    {r.brandDecisionNote && (
                      <blockquote className="mt-1.5 border-l-2 border-line-strong pl-3 text-[13px] leading-5 text-ink">{r.brandDecisionNote}</blockquote>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
