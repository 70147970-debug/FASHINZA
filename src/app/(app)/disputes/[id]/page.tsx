import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/server/auth/session";
import { getDispute } from "@/server/services/disputes";
import { isAppError } from "@/server/errors";
import { DetailList, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { Alert } from "@/components/ui/alert";
import { DisputeUpdateForm } from "@/components/admin/admin-forms";
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ROLE_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Dispute" };

export default async function DisputePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const actor = await requireOnboardedUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getDispute(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={d.subject}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/disputes" : "/disputes", label: "Disputes" }]}
        meta={<StatusBadge map={DISPUTE_STATUS} value={d.status} />}
      />
      {sp.created && <Alert tone="success" className="mb-6">Dispute submitted. The Fashinza team and the other party have been notified.</Alert>}
      <div className="space-y-6">
        <Panel>
          <DetailList
            items={[
              { label: "Category", value: DISPUTE_CATEGORY[d.category] },
              { label: "Raised by", value: `${d.reporter.name} (${ROLE_LABEL[d.reporter.role]})` },
              { label: "Order", value: d.order ? <Link href={`/orders/${d.order.id}`} className="text-teal-700 hover:underline">{d.order.reference}</Link> : "—" },
              { label: "Project", value: d.project ? <Link href={`/projects/${d.project.id}`} className="text-teal-700 hover:underline">{d.project.name}</Link> : "—" },
              { label: "Opened", value: formatDateTime(d.createdAt) },
              { label: "Last update", value: formatDateTime(d.updatedAt) },
            ]}
          />
          <p className="mt-5 whitespace-pre-line border-t border-line pt-4 text-sm">{d.description}</p>
        </Panel>
        {(d.adminNote || d.resolution) && (
          <Panel title="Fashinza review">
            {d.adminNote && <p className="text-sm"><span className="font-medium text-navy">Note: </span>{d.adminNote}</p>}
            {d.resolution && <p className="mt-2 text-sm"><span className="font-medium text-navy">Resolution: </span>{d.resolution}</p>}
            {d.resolvedAt && <p className="mt-2 text-xs text-muted">Resolved {formatDateTime(d.resolvedAt)}</p>}
          </Panel>
        )}
        {actor.role === "ADMIN" && d.status !== "CLOSED" && (
          <Panel title="Update dispute" description="Every change is recorded in the audit log and the parties are notified.">
            <DisputeUpdateForm id={d.id} status={d.status} adminNote={d.adminNote ?? ""} resolution={d.resolution ?? ""} />
          </Panel>
        )}
      </div>
    </div>
  );
}
