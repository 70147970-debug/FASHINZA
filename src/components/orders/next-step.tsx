import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { StatusBadge } from "@/components/app/primitives";
import {
  CompleteStageButton, ConfirmDeliveryButton, EvidenceForm, PayButton, QcDecisionButtons, QcReportForm, SampleForm, SampleReviewForm, ShipmentForm,
} from "@/components/orders/order-forms";
import { FileThumb } from "@/components/orders/order-parts";
import type { Order, OrderView } from "@/components/orders/order-view";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS } from "@/lib/labels";
import { STAGE_BY_KEY, stageLabel } from "@/lib/workflow";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Task = {
  key: string;
  title: string;
  /** Right of the title: due date, overdue flag. */
  meta?: React.ReactNode;
  /** One sentence under the title. */
  lead?: React.ReactNode;
  body: React.ReactNode;
};

function TabLink({ tab, children }: { tab: string; children: React.ReactNode }) {
  return (
    <a href={`?tab=${tab}`} className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

function Well({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-md border border-line bg-surface-muted/60 p-4 sm:p-5", className)}>{children}</div>;
}

function OverdueBadge({ days }: { days: number }) {
  return (
    <Badge tone="warning">
      <AlertTriangle className="size-3" aria-hidden />
      {days > 0 ? `${days} day${days === 1 ? "" : "s"} overdue` : "Delayed"}
    </Badge>
  );
}

/**
 * "Your next step": the one place on the order page where the viewer acts. It names what THIS viewer has to
 * do now (the control for the current stage gate, due payments for the brand, the open rework) or, when
 * nothing is required of them, who the order is waiting for and by when.
 */
export function NextStepCard({ order, view }: { order: Order; view: OrderView }) {
  const { isBrand, isFactory, isAdmin, closed, current, gate, pendingSample, pendingQc, openRework, factoryName, brandName, currentLate, currentOverdue, payable, firstPayable } = view;
  const tasks: Task[] = [];
  let waiting: React.ReactNode = null;

  const dueMeta = current ? (
    <span className="flex flex-wrap items-center gap-2">
      <span className={cn("tabular text-[13px]", currentLate ? "font-medium text-warning-strong" : "text-ink-muted")}>Due {formatDate(current.plannedEnd)}</span>
      {currentLate && <OverdueBadge days={currentOverdue} />}
    </span>
  ) : undefined;
  const plannedBy = current ? (
    <>
      {" "}— planned by <span className="tabular font-medium text-ink">{formatDate(current.plannedEnd)}</span>.
      {currentLate && <> <OverdueBadge days={currentOverdue} /></>}
    </>
  ) : (
    "."
  );

  if (!closed && current) {
    const def = STAGE_BY_KEY[current.stage];
    const label = def.label.toLowerCase();

    if (gate === "evidence") {
      if (isFactory) {
        tasks.push({
          key: "stage",
          title: `Complete ${label}`,
          meta: dueMeta,
          lead: <>Upload evidence ({def.requirement.toLowerCase()}), then mark the stage complete.</>,
          body: (
            <>
              {current.evidence.length > 0 && (
                <div>
                  <p className="label-caps mb-2 text-ink-muted">Uploaded so far</p>
                  <ul className="flex flex-wrap gap-2" aria-label="Evidence files">
                    {current.evidence.map((e) => (
                      <li key={e.id}>
                        <FileThumb fileKey={e.fileKey} fileName={e.fileName} mimeType={e.mimeType} alt={e.note ?? `Evidence for ${def.label}`} title={e.note ?? e.fileName} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <EvidenceForm orderId={order.id} stage={current.stage} requirement={def.requirement} />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
                <CompleteStageButton orderId={order.id} stage={current.stage} label={def.label} disabled={current.evidence.length === 0} />
                {current.evidence.length === 0 && <p className="text-xs text-ink-muted">Upload evidence to enable completion.</p>}
              </div>
            </>
          ),
        });
      } else {
        waiting = <>Waiting for {factoryName} to upload {label} evidence and complete the stage{plannedBy}</>;
      }
    } else if (gate === "sample") {
      const round = order.samples.length + 1;
      const previous = order.samples[0];
      if (isFactory && !pendingSample) {
        tasks.push({
          key: "stage",
          title: `Submit sample round ${round}`,
          meta: dueMeta,
          lead: "Describe the sample and add photos. The brand approves it or asks for changes.",
          body: (
            <>
              {previous?.feedback && (
                <blockquote className="border-l-2 border-line-strong pl-3 text-[13px] leading-5 text-ink">
                  <span className="font-medium">Brand feedback on round {previous.round}: </span>
                  {previous.feedback}
                </blockquote>
              )}
              <SampleForm orderId={order.id} round={round} />
            </>
          ),
        });
      } else if (isFactory && pendingSample) {
        waiting = <>Sample round {pendingSample.round} is with the brand for review. Waiting for {brandName} to approve it or ask for changes{plannedBy}</>;
      } else if (isBrand && pendingSample) {
        const s = pendingSample;
        tasks.push({
          key: "stage",
          title: `Review sample round ${s.round}`,
          meta: dueMeta,
          lead: <>Approve it to start bulk production, or ask {factoryName} for another round.</>,
          body: (
            <>
              <div>
                <p className="text-sm leading-6 text-ink">{s.description}</p>
                {s.revisionNotes && <p className="mt-1 text-[13px] leading-5 text-ink-muted"><span className="font-medium text-ink">Changes:</span> {s.revisionNotes}</p>}
                {s.photos.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Sample round ${s.round} photos`}>
                    {s.photos.map((p) => (
                      <li key={p.id}>
                        <FileThumb fileKey={p.fileKey} fileName={p.fileName} alt={`Sample round ${s.round}: ${p.fileName}`} size="lg" />
                      </li>
                    ))}
                  </ul>
                )}
                {s.round > 1 && <p className="mt-3"><TabLink tab="samples">Earlier rounds in Samples &amp; QC</TabLink></p>}
              </div>
              <Well>
                <SampleReviewForm orderId={order.id} sampleId={s.id} />
              </Well>
            </>
          ),
        });
      } else if (isBrand) {
        waiting = <>Waiting for {factoryName} to submit sample round {round}{plannedBy}</>;
      } else {
        waiting = pendingSample ? (
          <>Waiting for {brandName} to review sample round {pendingSample.round}{plannedBy}</>
        ) : (
          <>Waiting for {factoryName} to submit sample round {round}{plannedBy}</>
        );
      }
    } else if (gate === "qc") {
      if ((isFactory || isAdmin) && !pendingQc) {
        tasks.push({
          key: "stage",
          title: "Record the quality inspection",
          meta: dueMeta,
          lead: "AQL sampling per ISO 2859-1, general inspection level II. A failed inspection sends production back to stitching.",
          body: <QcReportForm orderId={order.id} defaultBatch={order.quantity} />,
        });
      } else if ((isFactory || isAdmin) && pendingQc) {
        waiting = <>The passed inspection is waiting for the brand&apos;s decision.</>;
      } else if (isBrand && pendingQc) {
        const r = pendingQc;
        const rows = [
          { label: "Critical", found: r.criticalCount, accept: 0 as number | null, over: r.criticalCount > 0 },
          { label: "Major", found: r.majorCount, accept: r.acceptMajor, over: r.acceptMajor !== null && r.majorCount > r.acceptMajor },
          { label: "Minor", found: r.minorCount, accept: r.acceptMinor, over: r.acceptMinor !== null && r.minorCount > r.acceptMinor },
        ];
        tasks.push({
          key: "stage",
          title: "Decide on the inspection report",
          meta: dueMeta,
          lead: <>The inspection passed. Accepting completes the quality check; rejecting returns production to stitching.</>,
          body: (
            <>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success" dot>{r.result}</Badge>
                  <span className="text-xs text-ink-muted">Inspected {formatDate(r.inspectionDate)} by {r.inspector.name}</span>
                </div>
                <p className="tabular mt-2 text-[13px] text-ink-muted">
                  Batch <span className="font-medium text-ink">{formatNumber(r.batchSize)}</span> · inspected <span className="font-medium text-ink">{formatNumber(r.sampleSize)}</span> units
                </p>
                <dl className="tabular mt-3 grid grid-cols-3 overflow-hidden rounded-md border border-line bg-surface text-[13px]">
                  {rows.map((x) => (
                    <div key={x.label} className="min-w-0 border-l border-line px-3 py-2.5 first:border-l-0">
                      <dt className="label-caps text-ink-muted">{x.label}</dt>
                      <dd className="mt-1">
                        <span className={cn("font-display text-lg font-medium", x.over ? "text-danger-strong" : "text-ink")}>{x.found}</span>
                        <span className="text-xs text-ink-muted"> / {x.accept ?? "—"} allowed</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                {r.defects.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Defects">
                    {r.defects.map((d) => (
                      <li key={d.id}>
                        <Badge tone={d.severity === "MINOR" ? "neutral" : "danger"}>{d.category} · {d.severity.toLowerCase()} × {d.count}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {r.notes && <p className="mt-3 text-[13px] leading-5 text-ink-muted">{r.notes}</p>}
                <p className="mt-3"><TabLink tab="samples">Full report and photos in Samples &amp; QC</TabLink></p>
              </div>
              <Well>
                <QcDecisionButtons orderId={order.id} reportId={r.id} />
              </Well>
            </>
          ),
        });
      } else {
        waiting = <>Waiting for {factoryName} to record the quality inspection{plannedBy}</>;
      }
    } else if (gate === "shipment") {
      if (isFactory) {
        tasks.push({
          key: "stage",
          title: "Ship the order",
          meta: dueMeta,
          lead: "Record the carrier and tracking number. The brand is notified and confirms delivery.",
          body: <ShipmentForm orderId={order.id} />,
        });
      } else {
        waiting = <>Waiting for {factoryName} to ship and record the tracking details{plannedBy}</>;
      }
    } else if (gate === "delivery") {
      if (isBrand) {
        tasks.push({
          key: "stage",
          title: "Confirm the goods arrived",
          meta: dueMeta,
          lead: "Check the shipment against the order, then confirm. Confirming completes the order; if something is wrong, use Raise a dispute at the top of the page instead.",
          body: <ConfirmDeliveryButton orderId={order.id} />,
        });
      } else {
        waiting = <>Waiting for {brandName} to confirm delivery{plannedBy}</>;
      }
    }
  }

  if (payable.length > 0) {
    const dueCount = payable.filter((p) => p.status !== "PROCESSING").length;
    tasks.push({
      key: "payments",
      title: dueCount === 0 ? "Payment in progress" : payable.length === 1 ? `Payment due: ${payable[0].label}` : `${payable.length} payments due`,
      lead: <>Paid through a sandbox provider: no real money moves. <TabLink tab="payments">Schedule and receipts</TabLink></>,
      body: (
        <ul className="divide-y divide-line-subtle rounded-md border border-line">
          {payable.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-3.5 py-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {p.label} · <span className="tabular">{p.percentage.toString()}%</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs leading-5 text-ink-muted">
                  <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                  {p.dueAt && p.status === "DUE" ? <span className="tabular">by {formatDate(p.dueAt)}</span> : null}
                  {p.status === "PROCESSING" ? <span>Checkout started; pay again if it did not finish.</span> : null}
                </p>
              </div>
              <div className="w-full sm:w-auto">
                <PayButton paymentMilestoneId={p.id} label={p.label} amount={formatMoney(p.amount, p.currency)} quiet={p.id !== firstPayable} />
              </div>
            </li>
          ))}
        </ul>
      ),
    });
  }

  const hasTasks = tasks.length > 0;

  return (
    <section
      id="next-step"
      aria-labelledby="next-step-title"
      className={cn("mb-6 min-w-0 scroll-mt-24 overflow-hidden rounded-lg border bg-surface", hasTasks ? "border-accent-line" : "border-line")}
    >
      <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-4 py-3 sm:px-5", hasTasks ? "border-accent-line bg-accent-soft/50" : "border-line")}>
        <h2 id="next-step-title" className={cn("eyebrow flex items-center gap-2 font-sans", hasTasks ? "text-accent-strong" : "text-ink-muted")}>
          <span className={cn("size-1.5 rounded-full", hasTasks ? "bg-accent" : "bg-ink-subtle")} aria-hidden />
          Your next step
        </h2>
        {tasks.length > 1 && <span className="text-xs text-ink-muted">{tasks.length} things need you</span>}
      </div>

      {openRework.length > 0 && (
        <div className="px-4 pt-4 sm:px-5">
          <Alert tone="error" title="Rework in progress">
            <span className="flex items-start gap-1.5"><Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />{openRework[0].description}</span>
          </Alert>
        </div>
      )}

      {tasks.map((t, i) => (
        <div key={t.key} className={cn("px-4 py-5 sm:px-5", i > 0 && "border-t border-line")}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <h3 className="font-display text-xl font-medium leading-7 tracking-[-0.01em] text-ink">{t.title}</h3>
            {t.meta}
          </div>
          {t.lead && <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">{t.lead}</p>}
          <div className="mt-4 space-y-4">{t.body}</div>
        </div>
      ))}

      {closed && !hasTasks && (
        <p className="flex items-start gap-2.5 px-4 py-4 text-sm leading-6 text-ink sm:px-5">
          <CheckCircle2 className={cn("mt-1 size-4 shrink-0", order.status === "DELIVERED" ? "text-success" : "text-ink-subtle")} aria-hidden />
          <span>
            {order.status === "DELIVERED" ? "This order is complete. Nothing more is needed from you." : "This order was cancelled. Nothing more is needed from you."}
            <span className="text-ink-muted"> The full record stays in the tabs below.</span>
          </span>
        </p>
      )}

      {waiting && (
        <p className={cn("flex items-start gap-2.5 px-4 py-4 text-sm leading-6 sm:px-5", hasTasks ? "border-t border-line bg-surface-muted/50 text-ink-muted" : "text-ink")}>
          <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-subtle" aria-hidden />
          <span className="min-w-0">
            {hasTasks && <span className="font-medium text-ink">{current ? stageLabel(current.stage) : "Production"}: </span>}
            {!hasTasks && <span className="text-ink-muted">Nothing needed from you right now. </span>}
            {waiting}
          </span>
        </p>
      )}
    </section>
  );
}
