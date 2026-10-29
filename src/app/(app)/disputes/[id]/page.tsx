import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CircleCheck, Flag, Hash, Hourglass, MessageSquareText, Tag } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { getDispute } from "@/server/services/disputes";
import { isAppError } from "@/server/errors";
import { DescriptionList, MetaItem, PageHeader, Panel, StatusBadge, Timeline } from "@/components/app/primitives";
import { Alert } from "@/components/ui/alert";
import { DisputeUpdateForm } from "@/components/admin/admin-forms";
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ROLE_LABEL } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Dispute" };

export default async function DisputePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const actor = await requireOnboardedUser();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getDispute(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const projectHref = d.project ? `${actor.role === "MANUFACTURER" ? "/opportunities" : "/projects"}/${d.project.id}` : undefined;
  const reviewed = !!(d.adminNote || d.resolution);
  const settled = d.status === "RESOLVED" || d.status === "CLOSED";

  const history = [
    { id: "opened", title: "Dispute raised", meta: `${formatDateTime(d.createdAt)} · ${d.reporter.name}`, icon: Flag, tone: "warning" as const },
    ...(d.status === "IN_REVIEW" || (reviewed && !settled)
      ? [{ id: "review", title: "Fashinza is reviewing", meta: formatDateTime(d.updatedAt), icon: Hourglass, tone: "info" as const }]
      : []),
    ...(settled
      ? [{ id: "settled", title: d.status === "CLOSED" ? "Dispute closed" : "Dispute resolved", meta: formatDateTime(d.resolvedAt ?? d.updatedAt), icon: CircleCheck, tone: "success" as const }]
      : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Dispute"
        title={d.subject}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/disputes" : "/disputes", label: "Disputes" }]}
        meta={<StatusBadge map={DISPUTE_STATUS} value={d.status} />}
        metaRow={
          <>
            <MetaItem icon={Tag}>{DISPUTE_CATEGORY[d.category]}</MetaItem>
            {d.order && <MetaItem icon={Hash}>{d.order.reference}</MetaItem>}
            <MetaItem icon={CalendarDays}>Opened {formatDate(d.createdAt)}</MetaItem>
          </>
        }
      />
      {sp.created && <Alert tone="success" className="mb-6">Dispute submitted. The Fashinza team and the other party have been notified.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="What happened" description={`Raised by ${d.reporter.name} (${ROLE_LABEL[d.reporter.role]})`}>
            <p className="whitespace-pre-line break-words text-sm leading-6 text-ink">{d.description}</p>
          </Panel>

          <Panel title="Fashinza review">
            {reviewed ? (
              <dl className="space-y-4 text-sm">
                {d.adminNote && (
                  <div>
                    <dt className="label-caps text-ink-muted">Note</dt>
                    <dd className="mt-1 whitespace-pre-line break-words leading-6 text-ink">{d.adminNote}</dd>
                  </div>
                )}
                {d.resolution && (
                  <div className="rounded-md border border-success-line bg-success-soft p-3">
                    <dt className="label-caps text-success-strong">Resolution</dt>
                    <dd className="mt-1 whitespace-pre-line break-words leading-6 text-ink">{d.resolution}</dd>
                    {d.resolvedAt && <p className="mt-2 text-xs text-ink-muted">Resolved {formatDateTime(d.resolvedAt)}</p>}
                  </div>
                )}
              </dl>
            ) : (
              <p className="flex items-start gap-3 text-sm leading-6 text-ink-muted">
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-canvas text-ink-muted">
                  <MessageSquareText className="size-4" aria-hidden />
                </span>
                The Fashinza team reviews the dispute with the full order history. Their notes and the resolution will appear here, and both parties are notified.
              </p>
            )}
          </Panel>

          {actor.role === "ADMIN" && d.status !== "CLOSED" && (
            <Panel title="Update dispute" description="Every change is recorded in the audit log and the parties are notified.">
              <DisputeUpdateForm id={d.id} status={d.status} adminNote={d.adminNote ?? ""} resolution={d.resolution ?? ""} />
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Details">
            <DescriptionList
              layout="rows"
              items={[
                { label: "Category", value: DISPUTE_CATEGORY[d.category] },
                { label: "Raised by", value: `${d.reporter.name} (${ROLE_LABEL[d.reporter.role]})` },
                { label: "Order", value: d.order ? <Link href={`/orders/${d.order.id}`} className="tabular text-accent-strong underline-offset-4 hover:underline">{d.order.reference}</Link> : "—" },
                { label: "Project", value: d.project && projectHref ? <Link href={projectHref} className="text-accent-strong underline-offset-4 hover:underline">{d.project.name}</Link> : "—" },
                { label: "Opened", value: formatDateTime(d.createdAt) },
                { label: "Last update", value: formatDateTime(d.updatedAt) },
              ]}
            />
          </Panel>
          <Panel title="History">
            <Timeline items={history} />
          </Panel>
        </div>
      </div>
    </>
  );
}
