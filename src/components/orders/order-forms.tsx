"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, PackageCheck, Plus, Send, ShieldAlert, Trash2, Truck, Upload } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { inspectionPlan, evaluateInspection, SUPPORTED_AQLS, SAMPLING_STANDARD } from "@/lib/aql";
import { DEFECT_CATEGORIES } from "@/lib/validation/operations";
import { STAGES } from "@/lib/workflow";
import { formatMoney, isoDateInDays } from "@/lib/format";
import {
  addEvidenceAction, completeStageAction, confirmDeliveryAction, decideQcAction, postMessageAction, raiseDisputeAction, recordShipmentAction, reviewSampleAction,
  startPaymentAction, submitQcAction, submitSampleAction, updateScheduleAction,
} from "@/app/(app)/orders/actions";

const fileInputCls =
  "block w-full min-w-0 cursor-pointer rounded-md border border-dashed border-line-control bg-surface p-1.5 text-[13px] text-ink-muted transition-colors duration-150 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus file:mr-3 file:h-8 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-line-strong file:bg-surface file:px-3 file:text-[13px] file:font-medium file:text-ink hover:file:bg-surface-hover";

/** Re-fetches server data every 30 s while the tab is visible (polling instead of a socket server). */
export function LiveRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

export function EvidenceForm({ orderId, stage, requirement }: { orderId: string; stage: string; requirement: string }) {
  return (
    <ActionForm action={addEvidenceAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="stage" value={stage} />
      <div>
        <label htmlFor={`ev-${stage}`} className="mb-1.5 block text-sm font-medium text-ink">Evidence <span className="font-normal text-ink-muted">— {requirement.toLowerCase()}</span></label>
        <input id={`ev-${stage}`} name="file" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className={fileInputCls} />
        <FieldError name="file" />
      </div>
      <Field id={`ev-note-${stage}`} name="note" label="Note">
        <Input name="note" maxLength={500} placeholder="What does this show?" />
      </Field>
      <SubmitButton variant="outline" size="sm" pendingText="Uploading…"><Upload /> Add evidence</SubmitButton>
    </ActionForm>
  );
}

export function CompleteStageButton({ orderId, stage, label, disabled }: { orderId: string; stage: string; label: string; disabled?: boolean }) {
  return (
    <ActionDialog
      trigger={<Button variant="accent" size="sm" disabled={disabled}><CheckCircle2 /> Mark {label.toLowerCase()} complete</Button>}
      title={`Complete ${label.toLowerCase()}?`}
      description="The next stage starts immediately and the brand is notified. Completed stages cannot be reopened."
      action={completeStageAction}
      hidden={{ orderId, stage }}
      confirmLabel="Complete stage"
      tone="accent"
    >
      <Field id="complete-note" name="note" label="Completion note">
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
    </ActionDialog>
  );
}

export function SampleForm({ orderId, round }: { orderId: string; round: number }) {
  return (
    <ActionForm action={submitSampleAction} resetOnSuccess className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <Field id="sample-description" name="description" label={`Sample round ${round} description`} required>
        <Textarea name="description" rows={3} placeholder="Size, colourway, fabric lot and anything the brand should check." />
      </Field>
      {round > 1 && (
        <Field id="sample-revision" name="revisionNotes" label="What changed since the last round">
          <Textarea name="revisionNotes" rows={2} />
        </Field>
      )}
      <div>
        <label htmlFor="sample-photos" className="mb-1.5 block text-sm font-medium text-ink">Photos <span className="text-accent-strong" aria-hidden>*</span></label>
        <input id="sample-photos" name="photos" type="file" multiple accept="image/png,image/jpeg,image/webp" className={fileInputCls} />
        <p className="mt-1 text-xs text-ink-muted">Up to 10 PNG, JPEG or WebP images, 10 MB each.</p>
        <FieldError name="photos" />
      </div>
      <SubmitButton variant="accent" pendingText="Submitting…"><Send /> Submit sample</SubmitButton>
    </ActionForm>
  );
}

export function SampleReviewForm({ orderId, sampleId }: { orderId: string; sampleId: string }) {
  const [decision, setDecision] = useState("APPROVED");
  return (
    <ActionForm action={reviewSampleAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="sampleId" value={sampleId} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Your decision</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { v: "APPROVED", l: "Approve", d: "Bulk production can start." },
            { v: "REVISION_REQUESTED", l: "Request revision", d: "The factory sends a new round." },
            { v: "REJECTED", l: "Reject", d: "Sample unacceptable; a new round is needed." },
          ].map((o) => (
            <label key={o.v} className={`cursor-pointer rounded-md border p-3 text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus ${decision === o.v ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:border-line-control"}`}>
              <input type="radio" name="decision" value={o.v} checked={decision === o.v} onChange={() => setDecision(o.v)} className="sr-only" />
              <span className="block font-medium text-ink">{o.l}</span>
              <span className="text-xs text-ink-muted">{o.d}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="sample-feedback" name="feedback" label="Feedback for the factory" required={decision !== "APPROVED"}>
        <Textarea name="feedback" rows={3} />
      </Field>
      <SubmitButton variant={decision === "APPROVED" ? "accent" : "primary"} pendingText="Sending…">Send decision</SubmitButton>
    </ActionForm>
  );
}

type DefectLine = { category: string; severity: "CRITICAL" | "MAJOR" | "MINOR"; count: number };

/** QC report with a live sampling plan. The server recalculates the plan and the result. */
export function QcReportForm({ orderId, defaultBatch }: { orderId: string; defaultBatch: number }) {
  const [batch, setBatch] = useState(String(defaultBatch));
  const [aqlMajor, setAqlMajor] = useState("2.5");
  const [aqlMinor, setAqlMinor] = useState("4");
  const [defects, setDefects] = useState<DefectLine[]>([]);
  const plan = useMemo(() => {
    try {
      return inspectionPlan(Number(batch), Number(aqlMajor), Number(aqlMinor));
    } catch {
      return null;
    }
  }, [batch, aqlMajor, aqlMinor]);
  const counts = { critical: 0, major: 0, minor: 0 };
  defects.forEach((d) => (counts[d.severity.toLowerCase() as keyof typeof counts] += d.count || 0));
  const outcome = plan ? evaluateInspection(plan, counts) : null;
  const today = isoDateInDays(0);

  return (
    <ActionForm action={submitQcAction} className="space-y-5">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="defects" value={JSON.stringify(defects.filter((d) => d.count > 0))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="inspectionDate" label="Inspection date" required>
          <Input name="inspectionDate" type="date" max={today} defaultValue={today} />
        </Field>
        <Field id="batchSize" label="Batch size (units)" required>
          <Input name="batchSize" type="number" inputMode="numeric" min={2} value={batch} onChange={(e) => setBatch(e.target.value)} />
        </Field>
        <Field id="aqlMajor" label="AQL — major defects" required>
          <Select name="aqlMajor" value={aqlMajor} onChange={(e) => setAqlMajor(e.target.value)}>
            {SUPPORTED_AQLS.map((a) => <option key={a} value={String(a)}>{a.toFixed(a < 1 ? 2 : 1)}</option>)}
          </Select>
        </Field>
        <Field id="aqlMinor" label="AQL — minor defects" required>
          <Select name="aqlMinor" value={aqlMinor} onChange={(e) => setAqlMinor(e.target.value)}>
            {SUPPORTED_AQLS.map((a) => <option key={a} value={String(a)}>{a.toFixed(a < 1 ? 2 : 1)}</option>)}
          </Select>
        </Field>
      </div>
      {plan && (
        <div className="rounded-md border border-info-line bg-info-soft p-3.5 text-sm leading-6 text-ink">
          <p className="text-xs font-medium text-info-strong">{SAMPLING_STANDARD}</p>
          <p className="mt-1">
            Inspect at least <strong className="tabular">{plan.sampleSize}</strong> units (code letter {plan.major.codeLetter}
            {plan.minor.codeLetter !== plan.major.codeLetter ? `/${plan.minor.codeLetter}` : ""}). Accept up to <strong>{plan.major.accept}</strong> major and <strong>{plan.minor.accept}</strong> minor defects; critical defects are not accepted.
          </p>
        </div>
      )}
      <Field id="sampleSize" label="Units actually inspected" required hint={plan ? `At least ${plan.sampleSize}.` : undefined}>
        <Input name="sampleSize" type="number" inputMode="numeric" min={1} defaultValue={plan?.sampleSize} key={plan?.sampleSize} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Defects found</legend>
        {defects.length === 0 && <p className="mb-2 text-sm text-ink-muted">No defects recorded. Add a line for each defect type found.</p>}
        <ul className="space-y-2">
          {defects.map((d, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_140px_100px_auto]">
              <label className="sr-only" htmlFor={`d-cat-${i}`}>Category</label>
              <Select id={`d-cat-${i}`} value={d.category} onChange={(e) => setDefects((x) => x.map((y, j) => (j === i ? { ...y, category: e.target.value } : y)))} className="col-span-2 sm:col-span-1">
                {DEFECT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
              <label className="sr-only" htmlFor={`d-sev-${i}`}>Severity</label>
              <Select id={`d-sev-${i}`} value={d.severity} onChange={(e) => setDefects((x) => x.map((y, j) => (j === i ? { ...y, severity: e.target.value as DefectLine["severity"] } : y)))}>
                <option value="CRITICAL">Critical</option>
                <option value="MAJOR">Major</option>
                <option value="MINOR">Minor</option>
              </Select>
              <label className="sr-only" htmlFor={`d-count-${i}`}>Count</label>
              <Input id={`d-count-${i}`} type="number" min={1} value={d.count || ""} onChange={(e) => setDefects((x) => x.map((y, j) => (j === i ? { ...y, count: Number(e.target.value) } : y)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove defect line" onClick={() => setDefects((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setDefects((x) => [...x, { category: DEFECT_CATEGORIES[0], severity: "MAJOR", count: 1 }])}>
          <Plus /> Add defect line
        </Button>
        <FieldError name="defects" />
      </fieldset>

      {outcome && (
        <Alert tone={outcome.result === "PASS" ? "success" : "error"}>
          Expected result: <strong>{outcome.result}</strong> ({counts.critical} critical, {counts.major} major, {counts.minor} minor).
          {outcome.result === "FAIL" && " Submitting creates a rework task and returns production to stitching."}
        </Alert>
      )}

      <Field id="correctiveActions" label="Corrective actions">
        <Textarea name="correctiveActions" rows={2} />
      </Field>
      <Field id="qc-notes" name="notes" label="Inspector notes">
        <Textarea name="notes" rows={2} />
      </Field>
      <div>
        <label htmlFor="qc-photos" className="mb-1.5 block text-sm font-medium text-ink">Photos <span className="font-normal text-ink-muted">(optional)</span></label>
        <input id="qc-photos" name="photos" type="file" multiple accept="image/png,image/jpeg,image/webp" className={fileInputCls} />
        <FieldError name="photos" />
      </div>
      <SubmitButton variant="accent" pendingText="Recording…">Record inspection</SubmitButton>
    </ActionForm>
  );
}

export function QcDecisionButtons({ orderId, reportId }: { orderId: string; reportId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionDialog
        trigger={<Button variant="accent" size="sm"><CheckCircle2 /> Accept report</Button>}
        title="Accept this inspection?"
        description="Quality check completes, the post-production payment milestone becomes due and the factory can ship."
        action={decideQcAction}
        hidden={{ orderId, reportId, decision: "ACCEPTED" }}
        confirmLabel="Accept report"
        tone="accent"
      >
        <Field id="qc-accept-note" name="note" label="Note"><Textarea name="note" rows={2} /></Field>
      </ActionDialog>
      <ActionDialog
        trigger={<Button variant="outline" size="sm">Reject and request rework</Button>}
        title="Reject this inspection?"
        description="A rework task is created and production returns to stitching, followed by a new inspection."
        action={decideQcAction}
        hidden={{ orderId, reportId, decision: "REJECTED" }}
        confirmLabel="Reject report"
        tone="danger"
      >
        <Field id="qc-reject-note" name="note" label="Reason" required><Textarea name="note" rows={3} /></Field>
      </ActionDialog>
    </div>
  );
}

export function ShipmentForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={recordShipmentAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="orderId" value={orderId} />
      <Field id="carrier" label="Carrier or forwarder" required><Input name="carrier" /></Field>
      <Field id="trackingNumber" label="Tracking / B/L number" required><Input name="trackingNumber" /></Field>
      <SubmitButton variant="accent" pendingText="Saving…"><Truck /> Record shipment</SubmitButton>
    </ActionForm>
  );
}

export function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="accent"><PackageCheck /> Confirm delivery</Button>}
      title="Confirm the goods arrived?"
      description="This completes the order and makes the final payment milestone due. If something is wrong, raise a dispute instead."
      action={confirmDeliveryAction}
      hidden={{ orderId }}
      confirmLabel="Confirm delivery"
      tone="accent"
    >
      <Field id="delivery-note" name="note" label="Receiving note"><Textarea name="note" rows={2} /></Field>
    </ActionDialog>
  );
}

export function MessageForm({ orderId, milestones }: { orderId: string; milestones: { id: string; stage: string }[] }) {
  return (
    <ActionForm action={postMessageAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Field id="msg-body" name="body" label="Message" required>
        <Textarea name="body" rows={3} maxLength={4000} />
      </Field>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-64">
          <label htmlFor="msg-milestone" className="mb-1.5 block text-sm font-medium text-ink">About <span className="font-normal text-ink-muted">(optional)</span></label>
          <Select id="msg-milestone" name="milestoneId" defaultValue="">
            <option value="">Whole order</option>
            {milestones.map((m) => <option key={m.id} value={m.id}>{STAGES.find((s) => s.stage === m.stage)?.label}</option>)}
          </Select>
        </div>
        <SubmitButton pendingText="Sending…"><Send /> Send</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** `quiet` renders an outline button, so a list with several payable milestones keeps a single terracotta action. */
export function PayButton({ paymentMilestoneId, label, amount, quiet }: { paymentMilestoneId: string; label: string; amount: string; quiet?: boolean }) {
  return (
    <ActionForm action={startPaymentAction}>
      <input type="hidden" name="paymentMilestoneId" value={paymentMilestoneId} />
      <SubmitButton variant={quiet ? "outline" : "accent"} size="sm" pendingText="Opening checkout…" aria-label={`Pay ${label}, ${amount}`}><CreditCard /> Pay {amount}</SubmitButton>
    </ActionForm>
  );
}

type ScheduleItem = { label: string; percentage: number; triggerStage: string };

export function ScheduleEditor({ orderId, items, total, currency }: { orderId: string; items: ScheduleItem[]; total: number; currency: string }) {
  const [rows, setRows] = useState<ScheduleItem[]>(items);
  const sum = rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0);
  return (
    <ActionForm action={updateScheduleAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="items" value={JSON.stringify(rows.map((r) => ({ ...r, percentage: Number(r.percentage) })))} />
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_80px_auto] gap-2 sm:grid-cols-[1fr_180px_90px_auto]">
            <label className="sr-only" htmlFor={`ps-label-${i}`}>Label</label>
            <Input id={`ps-label-${i}`} value={r.label} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} className="col-span-3 sm:col-span-1" />
            <label className="sr-only" htmlFor={`ps-stage-${i}`}>Due when</label>
            <Select id={`ps-stage-${i}`} value={r.triggerStage} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, triggerStage: e.target.value } : y)))}>
              {STAGES.map((s) => <option key={s.stage} value={s.stage}>After {s.label.toLowerCase()}</option>)}
            </Select>
            <label className="sr-only" htmlFor={`ps-pct-${i}`}>Percentage</label>
            <Input id={`ps-pct-${i}`} type="number" min={1} max={100} step="0.01" value={r.percentage} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, percentage: e.target.value as unknown as number } : y)))} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove payment" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" disabled={rows.length >= 8} onClick={() => setRows((x) => [...x, { label: "Additional payment", percentage: 0, triggerStage: "DELIVERY" }])}><Plus /> Add payment</Button>
        <p className={`tabular text-sm font-medium ${Math.abs(sum - 100) < 1e-9 ? "text-success-strong" : "text-danger-strong"}`}>
          Total {sum.toFixed(2)}% {Math.abs(sum - 100) < 1e-9 ? `· ${formatMoney(total, currency)}` : "· must equal 100%"}
        </p>
      </div>
      <SubmitButton variant="outline" disabled={Math.abs(sum - 100) > 1e-9} pendingText="Saving…">Save schedule</SubmitButton>
    </ActionForm>
  );
}

export function RaiseDisputeButton({ orderId, projectId }: { orderId?: string; projectId?: string }) {
  return (
    <ActionDialog
      trigger={<Button variant="outline"><ShieldAlert /> Raise a dispute</Button>}
      title="Raise a dispute"
      description="The Fashinza team reviews disputes with the full order history. The other party is notified."
      action={raiseDisputeAction}
      hidden={{ ...(orderId ? { orderId } : {}), ...(projectId ? { projectId } : {}) }}
      confirmLabel="Submit dispute"
    >
      <Field id="d-category" name="category" label="Category" required>
        <Select name="category" defaultValue="">
          <option value="" disabled>Choose one</option>
          <option value="QUALITY">Quality</option>
          <option value="DELIVERY">Delivery or delay</option>
          <option value="PAYMENT">Payment</option>
          <option value="COMMUNICATION">Communication</option>
          <option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field id="d-subject" name="subject" label="Subject" required><Input name="subject" maxLength={150} /></Field>
      <Field id="d-description" name="description" label="What happened?" required><Textarea name="description" rows={5} /></Field>
    </ActionDialog>
  );
}
