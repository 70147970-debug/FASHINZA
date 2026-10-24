import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, CalendarClock, Wrench } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { getOrder } from "@/server/services/orders";
import { isAppError } from "@/server/errors";
import { DetailList, PageHeader, Panel, SandboxBadge, StatusBadge } from "@/components/app/primitives";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { MilestoneTracker, type TrackerMilestone } from "@/components/orders/milestone-tracker";
import {
  CompleteStageButton, ConfirmDeliveryButton, EvidenceForm, LiveRefresh, MessageForm, PayButton, QcDecisionButtons, QcReportForm, RaiseDisputeButton, SampleForm,
  SampleReviewForm, ScheduleEditor, ShipmentForm,
} from "@/components/orders/order-forms";
import { AttachmentList } from "@/components/projects/attachment-list";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DISPUTE_STATUS, ORDER_STATUS, PAYMENT_STATUS, ROLE_LABEL, SAMPLE_STATUS } from "@/lib/labels";
import { STAGE_BY_KEY, estimateDelivery, stageLabel } from "@/lib/workflow";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Order" };

type Terms = Record<string, string | number | null>;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; payment?: string }> }) {
  const actor = await requireOnboardedUser();
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrder(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });

  const isBrand = actor.id === order.brandId;
  const isFactory = actor.id === order.manufacturerId;
  const closed = ["DELIVERED", "CANCELLED"].includes(order.status);
  const current = order.milestones.find((m) => m.stage === order.currentStage);
  const estimate = closed ? null : estimateDelivery(order.expectedCompletionDate, current);
  const slipped = estimate && estimate > order.expectedCompletionDate;
  const pendingSample = order.samples.find((s) => s.status === "SUBMITTED");
  const pendingQc = order.qcReports.find((r) => r.result === "PASS" && r.brandDecision === "PENDING");
  const openRework = order.reworkTasks.filter((r) => r.status === "OPEN");
  const terms = (order.agreedTerms ?? {}) as Terms;
  const paymentsLocked = order.paymentMilestones.some((p) => ["PROCESSING", "PAID", "REFUNDED"].includes(p.status));
  const factoryName = order.manufacturer.manufacturerProfile?.businessName ?? order.manufacturer.name;
  const brandName = order.brand.brandProfile?.companyName ?? order.brand.name;
  const commentCounts = new Map<string, number>();
  order.messages.forEach((m) => m.milestoneId && commentCounts.set(m.milestoneId, (commentCounts.get(m.milestoneId) ?? 0) + 1));

  const milestones: TrackerMilestone[] = order.milestones.map((m) => ({ ...m, commentCount: commentCounts.get(m.id) ?? 0 }));

  const actionFor = (m: TrackerMilestone) => {
    const def = STAGE_BY_KEY[m.stage];
    if (def.gate === "evidence") {
      if (isFactory) {
        return (
          <>
            <EvidenceForm orderId={order.id} stage={m.stage} requirement={def.requirement} />
            <CompleteStageButton orderId={order.id} stage={m.stage} label={def.label} disabled={m.evidence.length === 0} />
            {m.evidence.length === 0 && <p className="text-xs text-muted">Upload evidence to enable completion.</p>}
          </>
        );
      }
      return <p className="text-sm text-muted">Waiting for {factoryName} to upload evidence and complete this stage.</p>;
    }
    if (def.gate === "sample") {
      if (isFactory) return pendingSample ? <p className="text-sm text-muted">Round {pendingSample.round} is with the brand for review.</p> : <SampleForm orderId={order.id} round={order.samples.length + 1} />;
      if (isBrand) return pendingSample ? <a href="#sampling" className="text-sm font-medium text-teal-700 hover:underline">Review sample round {pendingSample.round} below →</a> : <p className="text-sm text-muted">Waiting for the factory to submit a sample.</p>;
      return null;
    }
    if (def.gate === "qc") {
      if (isFactory || actor.role === "ADMIN") {
        return pendingQc ? <p className="text-sm text-muted">The passed inspection is waiting for the brand&apos;s decision.</p> : <QcReportForm orderId={order.id} defaultBatch={order.quantity} />;
      }
      if (isBrand) return pendingQc ? <a href="#quality" className="text-sm font-medium text-teal-700 hover:underline">Review the inspection report below →</a> : <p className="text-sm text-muted">Waiting for the inspection to be recorded.</p>;
      return null;
    }
    if (def.gate === "shipment") return isFactory ? <ShipmentForm orderId={order.id} /> : <p className="text-sm text-muted">Waiting for the factory to ship.</p>;
    if (def.gate === "delivery") return isBrand ? <div className="flex flex-wrap gap-2"><ConfirmDeliveryButton orderId={order.id} /><RaiseDisputeButton orderId={order.id} /></div> : <p className="text-sm text-muted">Waiting for the brand to confirm delivery.</p>;
    return null;
  };

  return (
    <>
      {!closed && <LiveRefresh />}
      <PageHeader
        title={order.project.name}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/orders" : "/orders", label: "Orders" }]}
        meta={<><StatusBadge map={ORDER_STATUS} value={order.status} /><Badge>{order.reference}</Badge></>}
        description={isBrand ? `Produced by ${factoryName}` : isFactory ? `For ${brandName}` : `${brandName} ← ${factoryName}`}
        actions={actor.role !== "ADMIN" && !closed && <RaiseDisputeButton orderId={order.id} />}
      />
      {sp.created && <Alert tone="success" className="mb-6">Order created from the accepted quotation. Production starts with fabric sourcing; the payment schedule is below.</Alert>}
      {sp.payment === "returned" && <Alert tone="info" className="mb-6">You returned from the sandbox checkout. The payment status updates when the provider&apos;s webhook is received.</Alert>}
      {openRework.length > 0 && (
        <Alert tone="error" className="mb-6">
          <span className="flex items-center gap-1 font-medium"><Wrench className="size-4" /> Rework in progress</span> {openRework[0].description}
        </Alert>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <p className="text-xs text-muted">Current stage</p>
          <p className="mt-1 font-display text-lg font-semibold text-navy">{closed ? ORDER_STATUS[order.status].label : stageLabel(order.currentStage)}</p>
          {current && !closed && <p className="text-xs text-muted">Planned end {formatDate(current.plannedEnd)}</p>}
        </div>
        <div className={cn("rounded-lg border bg-white p-4 shadow-card", slipped ? "border-danger/40" : "border-line")}>
          <p className="flex items-center gap-1 text-xs text-muted"><CalendarClock className="size-3.5" aria-hidden />{closed ? "Delivered" : "Estimated delivery"}</p>
          <p className="mt-1 font-display text-lg font-semibold text-navy">{closed ? formatDate(order.deliveredAt) : formatDate(estimate)}</p>
          <p className={cn("text-xs", slipped ? "font-medium text-danger" : "text-muted")}>
            {slipped ? <><AlertTriangle className="mr-1 inline size-3.5" aria-hidden />Agreed {formatDate(order.expectedCompletionDate)}</> : `Agreed ${formatDate(order.expectedCompletionDate)}`}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <p className="text-xs text-muted">Order value</p>
          <p className="tabular mt-1 font-display text-lg font-semibold text-navy">{formatMoney(order.totalAmount, order.currency)}</p>
          <p className="text-xs text-muted">{formatNumber(order.quantity)} units · {formatMoney(order.unitPrice, order.currency)} / unit</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-card">
          <p className="text-xs text-muted">Shipment</p>
          <p className="mt-1 text-sm font-medium text-navy">{order.trackingInfo ?? "Not shipped yet"}</p>
          {order.shippedAt && <p className="text-xs text-muted">Shipped {formatDate(order.shippedAt)}</p>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Panel id="production" title="Production milestones" description="Stages complete in order and cannot be skipped. This page refreshes automatically every 30 seconds.">
            <MilestoneTracker milestones={milestones} currentStage={order.currentStage} closed={closed} actionFor={actionFor} />
          </Panel>

          <Panel id="sampling" title="Sampling">
            {order.samples.length === 0 ? (
              <p className="text-sm text-muted">No samples submitted yet.</p>
            ) : (
              <ul className="space-y-5">
                {order.samples.map((s) => (
                  <li key={s.id} className="rounded-md border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-navy">Round {s.round}</h3>
                      <StatusBadge map={SAMPLE_STATUS} value={s.status} />
                      <span className="text-xs text-muted">{formatDateTime(s.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm">{s.description}</p>
                    {s.revisionNotes && <p className="mt-1 text-sm text-muted">Changes: {s.revisionNotes}</p>}
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {s.photos.map((p) => (
                        <li key={p.id}>
                          <a href={`/api/files/${p.fileKey}`} target="_blank" rel="noopener">
                            {/* eslint-disable-next-line @next/next/no-img-element -- private, authorised file route */}
                            <img src={`/api/files/${p.fileKey}`} alt={`Sample round ${s.round}: ${p.fileName}`} loading="lazy" className="size-24 rounded-md border border-line object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                    {s.feedback && <p className="mt-3 rounded-md bg-canvas p-2 text-sm"><span className="font-medium text-navy">Brand feedback: </span>{s.feedback}</p>}
                    {s.status === "SUBMITTED" && isBrand && <div className="mt-4 border-t border-line pt-4"><SampleReviewForm orderId={order.id} sampleId={s.id} /></div>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="quality" title="Quality control" description="AQL sampling per ISO 2859-1, general inspection level II. Every report is kept, including failed ones.">
            {order.qcReports.length === 0 ? (
              <p className="text-sm text-muted">No inspections recorded yet.</p>
            ) : (
              <ul className="space-y-5">
                {order.qcReports.map((r) => (
                  <li key={r.id} className="rounded-md border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={r.result === "PASS" ? "success" : "danger"}>{r.result}</Badge>
                      {r.result === "PASS" && <Badge tone={r.brandDecision === "ACCEPTED" ? "success" : r.brandDecision === "REJECTED" ? "danger" : "warning"}>Brand: {r.brandDecision.toLowerCase()}</Badge>}
                      <span className="text-xs text-muted">Inspected {formatDate(r.inspectionDate)} by {r.inspector.name}</span>
                    </div>
                    <DetailList
                      columns={4}
                      items={[
                        { label: "Batch / inspected", value: `${formatNumber(r.batchSize)} / ${formatNumber(r.sampleSize)}` },
                        { label: "AQL major / minor", value: `${r.aqlMajor?.toString() ?? "—"} / ${r.aqlMinor?.toString() ?? "—"}` },
                        { label: "Accept limits", value: `${r.acceptMajor ?? "—"} major · ${r.acceptMinor ?? "—"} minor · 0 critical` },
                        { label: "Found", value: `${r.criticalCount} critical · ${r.majorCount} major · ${r.minorCount} minor` },
                      ]}
                    />
                    {r.defects.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1">{r.defects.map((d) => <li key={d.id}><Badge tone={d.severity === "MINOR" ? "neutral" : "danger"}>{d.category} · {d.severity.toLowerCase()} × {d.count}</Badge></li>)}</ul>
                    )}
                    {r.defectDescriptions && <p className="mt-2 text-sm text-danger">{r.defectDescriptions}</p>}
                    {r.correctiveActions && <p className="mt-2 text-sm"><span className="font-medium text-navy">Corrective actions: </span>{r.correctiveActions}</p>}
                    {r.notes && <p className="mt-1 text-sm text-muted">{r.notes}</p>}
                    {r.brandDecisionNote && <p className="mt-1 text-sm"><span className="font-medium text-navy">Brand note: </span>{r.brandDecisionNote}</p>}
                    {r.photos.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {r.photos.map((p) => (
                          <li key={p.id}>
                            <a href={`/api/files/${p.fileKey}`} target="_blank" rel="noopener">
                              {/* eslint-disable-next-line @next/next/no-img-element -- private, authorised file route */}
                              <img src={`/api/files/${p.fileKey}`} alt={`QC photo ${p.fileName}`} loading="lazy" className="size-20 rounded-md border border-line object-cover" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.rework && <p className="mt-3 text-xs text-muted"><Wrench className="mr-1 inline size-3.5" aria-hidden />Rework task {r.rework.status.toLowerCase()}{r.rework.resolvedAt ? ` on ${formatDate(r.rework.resolvedAt)}` : ""}</p>}
                    {r.id === pendingQc?.id && isBrand && <div className="mt-4 border-t border-line pt-4"><QcDecisionButtons orderId={order.id} reportId={r.id} /></div>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel id="messages" title="Messages" description="Shared with the brand, the factory and Fashinza administrators.">
            {order.messages.length === 0 ? (
              <p className="mb-4 text-sm text-muted">No messages yet.</p>
            ) : (
              <ul className="mb-5 space-y-3">
                {order.messages.map((m) => {
                  const mine = m.authorId === actor.id;
                  const milestone = order.milestones.find((x) => x.id === m.milestoneId);
                  return (
                    <li key={m.id} className={cn("max-w-[90%] rounded-lg px-3 py-2 text-sm", mine ? "ml-auto bg-navy text-white" : "bg-canvas text-ink")}>
                      <p className={cn("text-xs", mine ? "text-white/70" : "text-muted")}>
                        {m.author.name} · {ROLE_LABEL[m.author.role]} · {formatDateTime(m.createdAt)}{milestone ? ` · ${stageLabel(milestone.stage)}` : ""}
                      </p>
                      <p className="mt-0.5 whitespace-pre-line break-words">{m.body}</p>
                    </li>
                  );
                })}
              </ul>
            )}
            {(isBrand || isFactory || actor.role === "ADMIN") && <MessageForm orderId={order.id} milestones={order.milestones.map((m) => ({ id: m.id, stage: m.stage }))} />}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel id="payments" title="Payment schedule" actions={<SandboxBadge />} description="Milestone payments are processed by a sandbox provider; no real money moves and Fashinza does not hold funds in escrow.">
            <ul className="divide-y divide-line">
              {order.paymentMilestones.map((p) => (
                <li key={p.id} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy">{p.label} · {p.percentage.toString()}%</p>
                      <p className="text-xs text-muted">Due after {stageLabel(p.triggerStage).toLowerCase()}{p.dueAt && p.status === "DUE" ? ` · by ${formatDate(p.dueAt)}` : ""}{p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-sm font-semibold">{formatMoney(p.amount, p.currency)}</p>
                      <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                    </div>
                  </div>
                  {isBrand && ["DUE", "FAILED", "PROCESSING"].includes(p.status) && (
                    <div className="mt-2"><PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} /></div>
                  )}
                  {p.transactions.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted">
                      {p.transactions.map((t) => (
                        <li key={t.id}>{t.type === "REFUND" ? "Refund" : "Charge"} {t.status.toLowerCase()} · {formatDateTime(t.createdAt)}{t.failureReason ? ` · ${t.failureReason}` : ""}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            {isBrand && !paymentsLocked && !closed && (
              <details className="mt-4 border-t border-line pt-4">
                <summary className="cursor-pointer text-sm font-medium text-teal-700">Change the payment split</summary>
                <div className="mt-4">
                  <ScheduleEditor
                    orderId={order.id}
                    total={Number(order.totalAmount)}
                    currency={order.currency}
                    items={order.paymentMilestones.map((p) => ({ label: p.label, percentage: Number(p.percentage), triggerStage: p.triggerStage }))}
                  />
                </div>
              </details>
            )}
          </Panel>

          <Panel title="Agreed terms" description={`From quotation version ${terms.quotationVersion ?? "—"}.`}>
            <DetailList
              items={[
                { label: "Quantity", value: formatNumber(Number(terms.quantity ?? order.quantity)) },
                { label: "Production", value: `${terms.productionDays ?? "—"} days` },
                { label: "Making / unit", value: formatMoney(terms.unitPrice as string, order.currency) },
                { label: "Fabric / unit", value: formatMoney(terms.fabricCostPerUnit as string, order.currency) },
                { label: "Finishing / unit", value: formatMoney(terms.finishingCostPerUnit as string, order.currency) },
                { label: "Packaging / unit", value: formatMoney(terms.packagingCostPerUnit as string, order.currency) },
                { label: "Sampling", value: formatMoney(terms.samplingCost as string, order.currency) },
                { label: "Logistics", value: formatMoney(terms.logisticsCost as string, order.currency) },
                { label: "Tax", value: `${terms.taxPercent ?? 0}% · ${formatMoney(terms.taxAmount as string, order.currency)}` },
                { label: "Total", value: formatMoney(terms.totalAmount as string, order.currency) },
              ]}
            />
            {terms.notes && <p className="mt-3 text-sm text-muted">{String(terms.notes)}</p>}
          </Panel>

          <Panel title="Tech pack" description="The highest version is the one to produce against.">
            <AttachmentList items={order.project.attachments} projectId={order.projectId} />
            {isBrand && !closed && <Link href={`/projects/${order.projectId}#files`} className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">Upload a new version</Link>}
          </Panel>

          <Panel title="Parties">
            <DetailList
              columns={2}
              items={[
                { label: "Brand", value: brandName },
                { label: "Factory", value: <span className="inline-flex items-center gap-1">{factoryName}<BadgeCheck className="size-4 text-success" aria-label="Verified" /></span> },
                { label: "Factory location", value: order.manufacturer.manufacturerProfile ? `${order.manufacturer.manufacturerProfile.city}, ${order.manufacturer.manufacturerProfile.country}` : "—" },
                { label: "Order created", value: formatDate(order.createdAt) },
              ]}
            />
          </Panel>

          {order.issues.length > 0 && (
            <Panel title="Disputes">
              <ul className="space-y-2 text-sm">
                {order.issues.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <Link href={`/disputes/${d.id}`} className="truncate text-navy hover:underline">{d.subject}</Link>
                    <StatusBadge map={DISPUTE_STATUS} value={d.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Activity">
            <ActivityTimeline items={order.activities} />
          </Panel>
        </div>
      </div>
    </>
  );
}
