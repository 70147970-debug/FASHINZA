import Link from "next/link";
import {
  AlertTriangle, BadgeCheck, CalendarDays, ClipboardCheck, CreditCard, MapPin, MessagesSquare, Package, RefreshCw, Shirt, Wrench,
} from "lucide-react";
import type { requireOnboardedUser } from "@/server/auth/session";
import type { getOrder } from "@/server/services/orders";
import {
  AnchorNav, DescriptionList, MetaItem, Metric, MetricStrip, PageHeader, Panel, ProgressBar, SandboxBadge, StageStepper, StatusBadge, type Step,
} from "@/components/app/primitives";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { MilestoneTracker, type TrackerMilestone } from "@/components/orders/milestone-tracker";
import {
  CompleteStageButton, ConfirmDeliveryButton, EvidenceForm, LiveRefresh, MessageForm, PayButton, QcDecisionButtons, QcReportForm, RaiseDisputeButton, SampleForm,
  SampleReviewForm, ScheduleEditor, ShipmentForm,
} from "@/components/orders/order-forms";
import { FileThumb, InlineEmpty, shortDate } from "@/components/orders/order-parts";
import { AttachmentList } from "@/components/projects/attachment-list";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DISPUTE_STATUS, ORDER_STATUS, PAYMENT_STATUS, ROLE_LABEL, SAMPLE_STATUS } from "@/lib/labels";
import { STAGE_BY_KEY, daysOverdue, estimateDelivery, stageLabel } from "@/lib/workflow";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Order = Awaited<ReturnType<typeof getOrder>>;
type Actor = Awaited<ReturnType<typeof requireOnboardedUser>>;
type Terms = Record<string, string | number | null>;

const ACTIVITY_PREVIEW = 6;

/** A waiting/handover message in the current-stage action area. */
function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-ink-muted">
      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-subtle" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function JumpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-accent-strong underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

/**
 * Order record page (brand, factory and admin): header, stage stepper, key facts, then the stage that needs
 * action, sampling, QC and messages in the main column, and payments, terms, files, parties, disputes and
 * activity in the side rail.
 */
export function OrderDetail({ order, actor, sp }: { order: Order; actor: Actor; sp: { created?: string; payment?: string } }) {
  const isBrand = actor.id === order.brandId;
  const isFactory = actor.id === order.manufacturerId;
  const closed = ["DELIVERED", "CANCELLED"].includes(order.status);
  const current = order.milestones.find((m) => m.stage === order.currentStage);
  const estimate = closed ? null : estimateDelivery(order.expectedCompletionDate, current);
  const slipped = !!estimate && estimate > order.expectedCompletionDate;
  const pendingSample = order.samples.find((s) => s.status === "SUBMITTED");
  const pendingQc = order.qcReports.find((r) => r.result === "PASS" && r.brandDecision === "PENDING");
  const openRework = order.reworkTasks.filter((r) => r.status === "OPEN");
  const terms = (order.agreedTerms ?? {}) as Terms;
  const paymentsLocked = order.paymentMilestones.some((p) => ["PROCESSING", "PAID", "REFUNDED"].includes(p.status));
  const factoryName = order.manufacturer.manufacturerProfile?.businessName ?? order.manufacturer.name;
  const brandName = order.brand.brandProfile?.companyName ?? order.brand.name;
  const location = order.manufacturer.manufacturerProfile ? `${order.manufacturer.manufacturerProfile.city}, ${order.manufacturer.manufacturerProfile.country}` : null;
  const commentCounts = new Map<string, number>();
  order.messages.forEach((m) => m.milestoneId && commentCounts.set(m.milestoneId, (commentCounts.get(m.milestoneId) ?? 0) + 1));

  const milestones: TrackerMilestone[] = order.milestones.map((m) => ({ ...m, commentCount: commentCounts.get(m.id) ?? 0 }));
  const doneCount = order.milestones.filter((m) => m.status === "COMPLETED").length;
  const currentOverdue = current && !closed ? daysOverdue(current.plannedEnd, current.completedAt) : 0;
  const currentLate = !!current && !closed && (current.isDelayed || currentOverdue > 0);

  const steps: Step[] = order.milestones.map((m) => {
    const isCurrent = !closed && m.stage === order.currentStage;
    const done = m.status === "COMPLETED";
    return {
      key: m.id,
      label: stageLabel(m.stage),
      state: done ? "done" : isCurrent ? "current" : "upcoming",
      hint: done ? shortDate(m.completedAt) : isCurrent ? `Due ${shortDate(m.plannedEnd)}` : undefined,
      attention: isCurrent && currentLate,
    };
  });

  const due = order.paymentMilestones.filter((p) => p.status === "DUE" || p.status === "FAILED");
  const firstPayable = isBrand ? order.paymentMilestones.find((p) => ["DUE", "FAILED", "PROCESSING"].includes(p.status))?.id : undefined;
  const paidTotal = order.paymentMilestones.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const scheduleTotal = order.paymentMilestones.reduce((s, p) => s + Number(p.amount), 0);

  const actionFor = (m: TrackerMilestone) => {
    const def = STAGE_BY_KEY[m.stage];
    if (def.gate === "evidence") {
      if (isFactory) {
        return (
          <>
            <EvidenceForm orderId={order.id} stage={m.stage} requirement={def.requirement} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
              <CompleteStageButton orderId={order.id} stage={m.stage} label={def.label} disabled={m.evidence.length === 0} />
              {m.evidence.length === 0 && <p className="text-xs text-ink-muted">Upload evidence to enable completion.</p>}
            </div>
          </>
        );
      }
      return <Waiting>Waiting for {factoryName} to upload evidence and complete this stage.</Waiting>;
    }
    if (def.gate === "sample") {
      if (isFactory) return pendingSample ? <Waiting>Round {pendingSample.round} is with the brand for review.</Waiting> : <SampleForm orderId={order.id} round={order.samples.length + 1} />;
      if (isBrand) return pendingSample ? <JumpLink href="#sampling">Review sample round {pendingSample.round} below →</JumpLink> : <Waiting>Waiting for the factory to submit a sample.</Waiting>;
      return null;
    }
    if (def.gate === "qc") {
      if (isFactory || actor.role === "ADMIN") {
        return pendingQc ? <Waiting>The passed inspection is waiting for the brand&apos;s decision.</Waiting> : <QcReportForm orderId={order.id} defaultBatch={order.quantity} />;
      }
      if (isBrand) return pendingQc ? <JumpLink href="#quality">Review the inspection report below →</JumpLink> : <Waiting>Waiting for the inspection to be recorded.</Waiting>;
      return null;
    }
    if (def.gate === "shipment") return isFactory ? <ShipmentForm orderId={order.id} /> : <Waiting>Waiting for the factory to ship.</Waiting>;
    if (def.gate === "delivery") {
      return isBrand ? (
        <div className="flex flex-wrap gap-2">
          <ConfirmDeliveryButton orderId={order.id} />
          <RaiseDisputeButton orderId={order.id} />
        </div>
      ) : (
        <Waiting>Waiting for the brand to confirm delivery.</Waiting>
      );
    }
    return null;
  };

  const anchors = [
    { href: "#production", label: "Production" },
    { href: "#sampling", label: "Sampling", count: order.samples.length },
    { href: "#quality", label: "Quality", count: order.qcReports.length },
    { href: "#messages", label: "Messages", count: order.messages.length },
    { href: "#payments", label: "Payments" },
    { href: "#activity", label: "Activity" },
  ];

  return (
    <>
      {!closed && <LiveRefresh />}
      <PageHeader
        eyebrow="Production order"
        title={order.project.name}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/orders" : "/orders", label: "Orders" }]}
        meta={
          <>
            <StatusBadge map={ORDER_STATUS} value={order.status} />
            <Badge tone="outline" className="tabular">{order.reference}</Badge>
          </>
        }
        description={isBrand ? `Produced by ${factoryName}` : isFactory ? `For ${brandName}` : `${brandName} ← ${factoryName}`}
        metaRow={
          <>
            <MetaItem icon={Package}>{formatNumber(order.quantity)} units</MetaItem>
            {location && <MetaItem icon={MapPin}>{location}</MetaItem>}
            <MetaItem icon={CalendarDays}>Ordered {formatDate(order.createdAt)}</MetaItem>
            {!closed && <MetaItem icon={RefreshCw}>Updates every 30 seconds</MetaItem>}
          </>
        }
        actions={actor.role !== "ADMIN" && !closed && <RaiseDisputeButton orderId={order.id} />}
      />

      {sp.created && <Alert tone="success" className="mb-6">Order created from the accepted quotation. Production starts with fabric sourcing; the payment schedule is below.</Alert>}
      {sp.payment === "returned" && <Alert tone="info" className="mb-6">You returned from the sandbox checkout. The payment status updates when the provider&apos;s webhook is received.</Alert>}
      {openRework.length > 0 && (
        <Alert tone="error" className="mb-6" title="Rework in progress">
          <span className="flex items-start gap-1.5"><Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />{openRework[0].description}</span>
        </Alert>
      )}
      {isBrand && due.length > 0 && (
        <Alert tone="warning" className="mb-6" title={due.length === 1 ? "A payment is due" : `${due.length} payments are due`}>
          {due.map((p) => `${p.label} (${formatMoney(p.amount, p.currency)})`).join(", ")}. <a href="#payments" className="font-medium underline underline-offset-4">Go to the payment schedule</a>
        </Alert>
      )}

      <Panel className="mb-6" bodyClassName="p-4 sm:px-6 sm:py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 md:mb-5">
          <h2 className="type-heading text-ink">Production progress</h2>
          <div className="flex min-w-0 items-center gap-3">
            <span className="tabular text-[13px] text-ink-muted">
              <span className="font-medium text-ink">{doneCount}</span> of {steps.length} stages complete
            </span>
            <ProgressBar value={doneCount} max={steps.length} label={`${doneCount} of ${steps.length} stages complete`} className="hidden w-28 sm:block" />
          </div>
        </div>
        <StageStepper stages={steps} label="Production stages" />
      </Panel>

      <MetricStrip label="Order summary" columns={4}>
        <Metric
          label={closed ? "Status" : "Current stage"}
          value={<span className="max-[400px]:text-lg">{closed ? ORDER_STATUS[order.status].label : stageLabel(order.currentStage)}</span>}
          tone={currentLate ? "warning" : undefined}
          hint={current && !closed ? (currentLate && currentOverdue > 0 ? `${currentOverdue} day${currentOverdue === 1 ? "" : "s"} past planned end` : `Planned end ${formatDate(current.plannedEnd)}`) : `${doneCount} of ${steps.length} stages complete`}
        />
        <Metric
          label={closed ? "Delivered" : "Estimated delivery"}
          value={<span className="max-[400px]:text-lg">{closed ? formatDate(order.deliveredAt) : formatDate(estimate)}</span>}
          tone={slipped ? "danger" : undefined}
          icon={CalendarDays}
          hint={
            slipped ? (
              <span className="inline-flex items-center gap-1 font-medium text-danger-strong"><AlertTriangle className="size-3" aria-hidden />Agreed {formatDate(order.expectedCompletionDate)}</span>
            ) : (
              `Agreed ${formatDate(order.expectedCompletionDate)}`
            )
          }
        />
        <Metric
          label="Order value"
          value={<span className="max-[400px]:text-lg">{formatMoney(order.totalAmount, order.currency)}</span>}
          hint={`${formatNumber(order.quantity)} units · ${formatMoney(order.unitPrice, order.currency)} / unit`}
        />
        <Metric
          label="Shipment"
          muted={!order.trackingInfo}
          value={<span className="block break-words font-sans text-[15px] font-medium leading-6 tracking-normal">{order.trackingInfo ?? "Not shipped yet"}</span>}
          hint={order.shippedAt ? `Shipped ${formatDate(order.shippedAt)}` : "Recorded at the logistics stage"}
        />
      </MetricStrip>

      <AnchorNav items={anchors} className="xl:hidden" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel id="production" title="Production milestones" description="Stages complete in order and cannot be skipped.">
            <MilestoneTracker milestones={milestones} currentStage={order.currentStage} closed={closed} actionFor={actionFor} />
          </Panel>

          <Panel
            id="sampling"
            title="Sampling"
            description={order.samples.length ? `${order.samples.length} round${order.samples.length === 1 ? "" : "s"}, newest first.` : undefined}
            bodyClassName={order.samples.length ? "p-0 sm:p-0" : undefined}
          >
            {order.samples.length === 0 ? (
              <InlineEmpty icon={Shirt}>No samples submitted yet.</InlineEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {order.samples.map((s) => (
                  <li key={s.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-medium text-ink">Round {s.round}</h3>
                        <StatusBadge map={SAMPLE_STATUS} value={s.status} />
                      </div>
                      <span className="tabular text-xs text-ink-muted">{formatDateTime(s.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink">{s.description}</p>
                    {s.revisionNotes && <p className="mt-1 text-[13px] leading-5 text-ink-muted"><span className="font-medium text-ink">Changes:</span> {s.revisionNotes}</p>}
                    {s.photos.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {s.photos.map((p) => (
                          <li key={p.id}>
                            <FileThumb fileKey={p.fileKey} fileName={p.fileName} alt={`Sample round ${s.round}: ${p.fileName}`} size="lg" />
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.feedback && (
                      <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-[13px] leading-5 text-ink">
                        <span className="font-medium text-ink">Brand feedback: </span>
                        {s.feedback}
                      </blockquote>
                    )}
                    {s.status === "SUBMITTED" && isBrand && (
                      <div className="mt-4 rounded-md border border-line bg-surface-muted p-4 sm:p-5">
                        <SampleReviewForm orderId={order.id} sampleId={s.id} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            id="quality"
            title="Quality control"
            description="AQL sampling per ISO 2859-1, general inspection level II. Every report is kept, including failed ones."
            bodyClassName={order.qcReports.length ? "p-0 sm:p-0" : undefined}
          >
            {order.qcReports.length === 0 ? (
              <InlineEmpty icon={ClipboardCheck}>No inspections recorded yet.</InlineEmpty>
            ) : (
              <ul className="divide-y divide-line">
                {order.qcReports.map((r) => {
                  const majorOver = r.acceptMajor !== null && r.majorCount > r.acceptMajor;
                  const minorOver = r.acceptMinor !== null && r.minorCount > r.acceptMinor;
                  return (
                    <li key={r.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={r.result === "PASS" ? "success" : "danger"} dot>{r.result}</Badge>
                          {r.result === "PASS" && (
                            <Badge tone={r.brandDecision === "ACCEPTED" ? "success" : r.brandDecision === "REJECTED" ? "danger" : "warning"}>Brand: {r.brandDecision.toLowerCase()}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-ink-muted">Inspected {formatDate(r.inspectionDate)} by {r.inspector.name}</span>
                      </div>
                      <p className="tabular mt-2.5 text-[13px] text-ink-muted">
                        Batch <span className="font-medium text-ink">{formatNumber(r.batchSize)}</span> · inspected <span className="font-medium text-ink">{formatNumber(r.sampleSize)}</span> units
                      </p>
                      <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface">
                        <table className="tabular w-full text-left text-[13px]">
                          <caption className="sr-only">Inspection figures by defect severity</caption>
                          <thead className="border-b border-line-strong">
                            <tr>
                              <th scope="col" className="label-caps px-2.5 py-2 sm:px-3 font-semibold text-ink-muted"><span className="sr-only">Measure</span></th>
                              <th scope="col" className="label-caps px-2.5 py-2 sm:px-3 text-right font-semibold text-ink-muted">Critical</th>
                              <th scope="col" className="label-caps px-2.5 py-2 sm:px-3 text-right font-semibold text-ink-muted">Major</th>
                              <th scope="col" className="label-caps px-2.5 py-2 sm:px-3 text-right font-semibold text-ink-muted">Minor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line-subtle">
                            <tr>
                              <th scope="row" className="px-3 py-2 font-normal text-ink-muted">AQL</th>
                              <td className="px-3 py-2 text-right text-ink-muted">—</td>
                              <td className="px-3 py-2 text-right text-ink">{r.aqlMajor?.toString() ?? "—"}</td>
                              <td className="px-3 py-2 text-right text-ink">{r.aqlMinor?.toString() ?? "—"}</td>
                            </tr>
                            <tr>
                              <th scope="row" className="px-3 py-2 font-normal text-ink-muted">Accept up to</th>
                              <td className="px-3 py-2 text-right text-ink">0</td>
                              <td className="px-3 py-2 text-right text-ink">{r.acceptMajor ?? "—"}</td>
                              <td className="px-3 py-2 text-right text-ink">{r.acceptMinor ?? "—"}</td>
                            </tr>
                            <tr>
                              <th scope="row" className="px-3 py-2 font-medium text-ink">Found</th>
                              <td className={cn("px-3 py-2 text-right font-semibold", r.criticalCount > 0 ? "text-danger-strong" : "text-ink")}>{r.criticalCount}</td>
                              <td className={cn("px-3 py-2 text-right font-semibold", majorOver ? "text-danger-strong" : "text-ink")}>{r.majorCount}</td>
                              <td className={cn("px-3 py-2 text-right font-semibold", minorOver ? "text-danger-strong" : "text-ink")}>{r.minorCount}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      {r.defects.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Defects">
                          {r.defects.map((d) => (
                            <li key={d.id}>
                              <Badge tone={d.severity === "MINOR" ? "neutral" : "danger"}>{d.category} · {d.severity.toLowerCase()} × {d.count}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 space-y-1.5 text-[13px] leading-5">
                        {r.defectDescriptions && <p className="text-danger-strong">{r.defectDescriptions}</p>}
                        {r.correctiveActions && <p className="text-ink"><span className="font-medium text-ink">Corrective actions: </span>{r.correctiveActions}</p>}
                        {r.notes && <p className="text-ink-muted">{r.notes}</p>}
                        {r.brandDecisionNote && <p className="text-ink"><span className="font-medium text-ink">Brand note: </span>{r.brandDecisionNote}</p>}
                      </div>
                      {r.photos.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {r.photos.map((p) => (
                            <li key={p.id}>
                              <FileThumb fileKey={p.fileKey} fileName={p.fileName} alt={`QC photo ${p.fileName}`} />
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.rework && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
                          <Wrench className="size-3.5" aria-hidden />
                          Rework task {r.rework.status.toLowerCase()}{r.rework.resolvedAt ? ` on ${formatDate(r.rework.resolvedAt)}` : ""}
                        </p>
                      )}
                      {r.id === pendingQc?.id && isBrand && (
                        <div className="mt-4 rounded-md border border-line bg-surface-muted p-4 sm:p-5">
                          <p className="mb-3 text-[13px] text-ink-muted">Accepting completes the quality check; rejecting returns production to stitching.</p>
                          <QcDecisionButtons orderId={order.id} reportId={r.id} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel
            id="messages"
            title="Messages"
            description="Shared with the brand, the factory and Fashinza administrators."
            footer={(isBrand || isFactory || actor.role === "ADMIN") ? <div className="w-full py-1"><MessageForm orderId={order.id} milestones={order.milestones.map((m) => ({ id: m.id, stage: m.stage }))} /></div> : undefined}
          >
            {order.messages.length === 0 ? (
              <InlineEmpty icon={MessagesSquare}>No messages yet.</InlineEmpty>
            ) : (
              <ul className="space-y-4">
                {order.messages.map((m) => {
                  const mine = m.authorId === actor.id;
                  const milestone = order.milestones.find((x) => x.id === m.milestoneId);
                  return (
                    <li key={m.id} className={cn("flex max-w-[92%] gap-2.5", mine && "ml-auto flex-row-reverse")}>
                      <Avatar name={m.author.name} size="sm" tone={mine ? "ink" : "accent"} />
                      <div className={cn("min-w-0", mine && "text-right")}>
                        <p className="text-xs text-ink-muted">
                          <span className="font-medium text-ink">{m.author.name}</span> · {ROLE_LABEL[m.author.role]} · {formatDateTime(m.createdAt)}
                          {milestone ? ` · ${stageLabel(milestone.stage)}` : ""}
                        </p>
                        <p className={cn("mt-1 inline-block whitespace-pre-line break-words rounded-lg px-3.5 py-2.5 text-left text-sm leading-6", mine ? "rounded-tr-xs bg-surface-muted text-ink" : "rounded-tl-xs border border-line bg-surface text-ink")}>{m.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            id="payments"
            title="Payment schedule"
            actions={<SandboxBadge />}
            description="Processed by a sandbox provider: no real money moves and Fashinza does not hold funds in escrow."
            bodyClassName="p-0 sm:p-0"
            footer={
              isBrand && !paymentsLocked && !closed ? (
                <details className="group w-full">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center text-sm font-medium text-accent-strong underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                    Change the payment split
                  </summary>
                  <div className="mt-4">
                    <ScheduleEditor
                      orderId={order.id}
                      total={Number(order.totalAmount)}
                      currency={order.currency}
                      items={order.paymentMilestones.map((p) => ({ label: p.label, percentage: Number(p.percentage), triggerStage: p.triggerStage }))}
                    />
                  </div>
                </details>
              ) : undefined
            }
          >
            <div className="border-b border-line px-4 py-4 sm:px-5">
              <p className="label-caps text-ink-muted">Paid to date</p>
              <p className="tabular mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[13px] text-ink-muted">
                <span className="font-display text-[26px] font-normal leading-8 tracking-[-0.02em] text-ink">{formatMoney(paidTotal, order.currency)}</span>
                <span>of {formatMoney(scheduleTotal, order.currency)}</span>
              </p>
              <ProgressBar value={paidTotal} max={scheduleTotal || 1} label="Share of the order value paid" tone="success" className="mt-3" />
            </div>
            <ul className="divide-y divide-line-subtle">
              {order.paymentMilestones.map((p) => {
                const payable = isBrand && ["DUE", "FAILED", "PROCESSING"].includes(p.status);
                return (
                  <li key={p.id} className={cn("px-4 py-3.5 sm:px-5", p.status === "DUE" && "bg-warning-soft/60")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {p.label} · <span className="tabular">{p.percentage.toString()}%</span>
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                          Due after {stageLabel(p.triggerStage).toLowerCase()}
                          {p.dueAt && p.status === "DUE" ? ` · by ${formatDate(p.dueAt)}` : ""}
                          {p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="tabular text-sm font-medium text-ink">{formatMoney(p.amount, p.currency)}</p>
                        <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                      </div>
                    </div>
                    {payable && (
                      <div className="mt-3">
                        <PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} quiet={p.id !== firstPayable} />
                      </div>
                    )}
                    {p.transactions.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs leading-5 text-ink-muted">
                        {p.transactions.map((t) => (
                          <li key={t.id} className="flex items-start gap-1.5">
                            <CreditCard className="mt-[3px] size-3 shrink-0 text-ink-subtle" aria-hidden />
                            <span className="min-w-0">
                              {t.type === "REFUND" ? "Refund" : "Charge"} {t.status.toLowerCase()} · {formatDateTime(t.createdAt)}
                              {t.failureReason ? ` · ${t.failureReason}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Agreed terms" description={`From quotation version ${terms.quotationVersion ?? "—"}.`}>
            <DescriptionList
              layout="rows"
              items={[
                { label: "Quantity", value: <span className="tabular">{formatNumber(Number(terms.quantity ?? order.quantity))}</span> },
                { label: "Production", value: `${terms.productionDays ?? "—"} days` },
                { label: "Making / unit", value: <span className="tabular">{formatMoney(terms.unitPrice as string, order.currency)}</span> },
                { label: "Fabric / unit", value: <span className="tabular">{formatMoney(terms.fabricCostPerUnit as string, order.currency)}</span> },
                { label: "Finishing / unit", value: <span className="tabular">{formatMoney(terms.finishingCostPerUnit as string, order.currency)}</span> },
                { label: "Packaging / unit", value: <span className="tabular">{formatMoney(terms.packagingCostPerUnit as string, order.currency)}</span> },
                { label: "Sampling", value: <span className="tabular">{formatMoney(terms.samplingCost as string, order.currency)}</span> },
                { label: "Logistics", value: <span className="tabular">{formatMoney(terms.logisticsCost as string, order.currency)}</span> },
                { label: "Tax", value: <span className="tabular">{`${terms.taxPercent ?? 0}% · ${formatMoney(terms.taxAmount as string, order.currency)}`}</span> },
                { label: "Total", value: <span className="tabular font-display text-base font-medium text-ink">{formatMoney(terms.totalAmount as string, order.currency)}</span> },
              ]}
            />
            {terms.notes && <p className="mt-4 border-t border-line-subtle pt-3 text-[13px] leading-5 text-ink-muted">{String(terms.notes)}</p>}
          </Panel>

          <Panel
            title="Tech pack"
            description="The highest version is the one to produce against."
            actions={isBrand && !closed ? <Link href={`/projects/${order.projectId}#files`} className="rounded-sm text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline">Upload a new version</Link> : undefined}
          >
            <AttachmentList items={order.project.attachments} projectId={order.projectId} />
          </Panel>

          <Panel title="Parties">
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <Avatar name={brandName} shape="square" tone="ink" />
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted">Brand</p>
                  <p className="break-words text-sm font-medium text-ink">{brandName}</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <Avatar name={factoryName} shape="square" tone="accent" />
                <div className="min-w-0">
                  <p className="text-xs text-ink-muted">Factory{location ? ` · ${location}` : ""}</p>
                  <p className="inline-flex items-center gap-1 break-words text-sm font-medium text-ink">
                    {factoryName}
                    <BadgeCheck className="size-4 shrink-0 text-success" aria-label="Verified" />
                  </p>
                </div>
              </li>
            </ul>
          </Panel>

          {order.issues.length > 0 && (
            <Panel title="Disputes" bodyClassName="p-0 sm:p-0">
              <ul className="divide-y divide-line-subtle">
                {order.issues.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <Link href={`/disputes/${d.id}`} className="min-w-0 truncate rounded-sm text-sm font-medium text-ink hover:underline hover:underline-offset-4">{d.subject}</Link>
                    <StatusBadge map={DISPUTE_STATUS} value={d.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel id="activity" title="Activity" description={order.activities.length ? `${order.activities.length} event${order.activities.length === 1 ? "" : "s"}, newest first.` : undefined}>
            <ActivityTimeline items={order.activities.slice(0, ACTIVITY_PREVIEW)} />
            {order.activities.length > ACTIVITY_PREVIEW && (
              <details className="group mt-5">
                <summary className="flex min-h-8 cursor-pointer list-none items-center text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show {order.activities.length - ACTIVITY_PREVIEW} earlier events</span>
                  <span className="hidden group-open:inline">Hide earlier events</span>
                </summary>
                <div className="mt-4">
                  <ActivityTimeline items={order.activities.slice(ACTIVITY_PREVIEW)} />
                </div>
              </details>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
