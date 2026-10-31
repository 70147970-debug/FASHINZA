import Link from "next/link";
import { BadgeCheck, ClipboardCheck, CreditCard, MessagesSquare, Shirt, Wrench } from "lucide-react";
import { DescriptionList, Panel, ProgressBar, SandboxBadge, StatusBadge } from "@/components/app/primitives";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { MessageForm, ScheduleEditor } from "@/components/orders/order-forms";
import { FileThumb, InlineEmpty } from "@/components/orders/order-parts";
import type { Actor, Order, OrderView } from "@/components/orders/order-view";
import { AttachmentList } from "@/components/projects/attachment-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DISPUTE_STATUS, PAYMENT_STATUS, ROLE_LABEL, SAMPLE_STATUS } from "@/lib/labels";
import { stageLabel } from "@/lib/workflow";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * The order page's tab bodies (all but Production). History and reference only: every action control
 * lives in the "Your next step" card (except the payment-split editor and the message form, which are
 * optional, not next steps).
 */

type Terms = Record<string, string | number | null>;

const ToNextStep = ({ children }: { children: React.ReactNode }) => (
  <a href="#next-step" className="rounded-sm font-medium text-accent-strong underline-offset-4 hover:underline">{children}</a>
);

/** Samples & QC: every sampling round and every inspection report, newest first. */
export function SamplesSection({ order, view }: { order: Order; view: OrderView }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
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
                {s.status === "SUBMITTED" && view.isBrand && (
                  <p className="mt-3 text-[13px] text-ink-muted">Awaiting your decision: <ToNextStep>review it in Your next step</ToNextStep>.</p>
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
                          <th scope="col" className="label-caps px-2.5 py-2 font-semibold text-ink-muted sm:px-3"><span className="sr-only">Measure</span></th>
                          <th scope="col" className="label-caps px-2.5 py-2 text-right font-semibold text-ink-muted sm:px-3">Critical</th>
                          <th scope="col" className="label-caps px-2.5 py-2 text-right font-semibold text-ink-muted sm:px-3">Major</th>
                          <th scope="col" className="label-caps px-2.5 py-2 text-right font-semibold text-ink-muted sm:px-3">Minor</th>
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
                  {r.id === view.pendingQc?.id && view.isBrand && (
                    <p className="mt-3 text-[13px] text-ink-muted">Awaiting your decision: <ToNextStep>accept or reject it in Your next step</ToNextStep>.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Payments: schedule, paid to date, transactions and (for the brand, before any money moved) the split editor. */
export function PaymentsSection({ order, view }: { order: Order; view: OrderView }) {
  const paidTotal = order.paymentMilestones.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const scheduleTotal = order.paymentMilestones.reduce((s, p) => s + Number(p.amount), 0);
  return (
    <Panel
      id="payments"
      title="Payment schedule"
      actions={<SandboxBadge />}
      description="Processed by a sandbox provider: no real money moves and Fashinza does not hold funds in escrow."
      bodyClassName="p-0 sm:p-0"
      footer={
        view.isBrand && !view.paymentsLocked && !view.closed ? (
          <details className="group w-full">
            <summary className="flex min-h-10 cursor-pointer list-none items-center text-sm font-medium text-accent-strong underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
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
        <ProgressBar value={paidTotal} max={scheduleTotal || 1} label="Share of the order value paid" tone="success" className="mt-3 max-w-md" />
        {view.payable.length > 0 && (
          <p className="mt-3 text-[13px] text-ink-muted">
            {view.payable.length === 1 ? "One payment is" : `${view.payable.length} payments are`} ready to pay: <ToNextStep>pay in Your next step</ToNextStep>.
          </p>
        )}
      </div>
      <ul className="divide-y divide-line-subtle">
        {order.paymentMilestones.map((p) => (
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
        ))}
      </ul>
    </Panel>
  );
}

/** Messages: the order thread and the composer. */
export function MessagesSection({ order, view, actor }: { order: Order; view: OrderView; actor: Actor }) {
  return (
    <Panel
      id="messages"
      title="Messages"
      description="Shared with the brand, the factory and Fashinza administrators."
      footer={(view.isBrand || view.isFactory || view.isAdmin) ? <div className="w-full py-1"><MessageForm orderId={order.id} milestones={order.milestones.map((m) => ({ id: m.id, stage: m.stage }))} /></div> : undefined}
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
  );
}

/** Terms & files: agreed terms, the tech pack, the parties and any disputes. */
export function DetailsSection({ order, view }: { order: Order; view: OrderView }) {
  const terms = (order.agreedTerms ?? {}) as Terms;
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <Panel id="terms" title="Agreed terms" description={`From quotation version ${terms.quotationVersion ?? "—"}.`}>
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

      <div className="space-y-6">
        <Panel
          id="files"
          title="Tech pack"
          description="The highest version is the one to produce against."
          actions={view.isBrand && !view.closed ? <Link href={`/projects/${order.projectId}?tab=files`} className="rounded-sm text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline">Upload a new version</Link> : undefined}
        >
          <AttachmentList items={order.project.attachments} projectId={order.projectId} />
        </Panel>

        <Panel title="Parties">
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <Avatar name={view.brandName} shape="square" tone="ink" />
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Brand</p>
                <p className="break-words text-sm font-medium text-ink">{view.brandName}</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <Avatar name={view.factoryName} shape="square" tone="accent" />
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Factory{view.location ? ` · ${view.location}` : ""}</p>
                <p className="inline-flex items-center gap-1 break-words text-sm font-medium text-ink">
                  {view.factoryName}
                  <BadgeCheck className="size-4 shrink-0 text-success" aria-label="Verified" />
                </p>
              </div>
            </li>
          </ul>
        </Panel>

        {order.issues.length > 0 && (
          <Panel id="disputes" title="Disputes" bodyClassName="p-0 sm:p-0">
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
      </div>
    </div>
  );
}

/** Activity: the full event log, newest first. */
export function ActivitySection({ order }: { order: Order }) {
  return (
    <Panel id="activity" title="Activity" description={order.activities.length ? `${order.activities.length} event${order.activities.length === 1 ? "" : "s"}, newest first.` : undefined}>
      <ActivityTimeline items={order.activities} />
    </Panel>
  );
}
