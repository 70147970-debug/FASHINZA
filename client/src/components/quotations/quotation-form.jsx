import { useMemo, useState } from "react";
import { Send, Trash2, Undo2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateQuotationTotals } from "@fashinza/shared/quotation-math.js";
import { formatMoney, formatNumber, isoDateInDays } from "@fashinza/shared/format.js";
import { MAX_SAMPLE_LEAD_DAYS } from "@fashinza/shared/validation/quotation.js";

/**
 * @typedef {object} QuotationDefaults
 * @property {number} quantity
 * @property {string} unitPrice
 * @property {string} fabricCostPerUnit
 * @property {string} finishingCostPerUnit
 * @property {string} packagingCostPerUnit
 * @property {string} samplingCost
 * @property {string} logisticsCost
 * @property {string} taxPercent
 * @property {number} minQuantity
 * @property {number} productionDays
 * @property {string} validUntil
 * @property {string} notes
 * @property {number | ""} sampleLeadTimeDays
 * @property {string} sampleNotes
 */

/** What the brand asked for on the brief, shown above the factory's sample proposal. */
/** @typedef {{ required: boolean, summary: string, notes: string | null }} SampleRequest */

const MONEY_FIELDS = [
  { name: "unitPrice", label: "Making cost per unit (CMT)", required: true, hint: "Cut, make and trim per piece." },
  { name: "fabricCostPerUnit", label: "Fabric cost per unit" },
  { name: "finishingCostPerUnit", label: "Finishing cost per unit", hint: "Washing, dyeing, printing, labelling." },
  { name: "packagingCostPerUnit", label: "Packaging cost per unit" },
  { name: "logisticsCost", label: "Logistics estimate (total)", hint: "Inland freight, export clearance or shipping as agreed in your terms." },
];

/**
 * Quotation editor. The preview uses the same calculation as the server, but the server always
 * recalculates and stores its own totals — the preview is never trusted.
 * Posts to `POST /api/opportunities/:projectId/quotation` (`intent` comes from the pressed button).
 */
export function QuotationForm({ projectId, currency, defaults, hasBeenSent, sampleRequest }) {
  const [v, setV] = useState(Object.fromEntries(Object.entries(defaults).map(([k, x]) => [k, String(x)])));
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const preview = useMemo(() => {
    try {
      return calculateQuotationTotals({
        quantity: Number(v.quantity),
        unitPrice: v.unitPrice || 0,
        fabricCostPerUnit: v.fabricCostPerUnit || 0,
        finishingCostPerUnit: v.finishingCostPerUnit || 0,
        packagingCostPerUnit: v.packagingCostPerUnit || 0,
        samplingCost: v.samplingCost || 0,
        logisticsCost: v.logisticsCost || 0,
        taxPercent: v.taxPercent || 0,
      });
    } catch {
      return null;
    }
  }, [v]);
  const production = useMemo(() => {
    try {
      return calculateQuotationTotals({
        quantity: Number(v.quantity),
        unitPrice: v.unitPrice || 0,
        fabricCostPerUnit: v.fabricCostPerUnit || 0,
        finishingCostPerUnit: v.finishingCostPerUnit || 0,
        packagingCostPerUnit: v.packagingCostPerUnit || 0,
      }).subtotal;
    } catch {
      return null;
    }
  }, [v]);
  const tomorrow = isoDateInDays(1);
  const money = (x) => formatMoney(x || 0, currency);

  return (
    <ActionForm action={`/api/opportunities/${projectId}/quotation`} className="space-y-7">
      <input type="hidden" name="projectId" value={projectId} />
      <Section title="Volume and timing">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="quantity" label="Quoted quantity" required>
            <Input name="quantity" type="number" inputMode="numeric" min={1} value={v.quantity} onChange={set("quantity")} />
          </Field>
          <Field id="minQuantity" label="Minimum quantity" required hint="The lowest quantity you would accept at these prices.">
            <Input name="minQuantity" type="number" inputMode="numeric" min={1} value={v.minQuantity} onChange={set("minQuantity")} />
          </Field>
          <Field id="productionDays" label="Production duration (days)" required hint="From order to ready for shipment.">
            <Input name="productionDays" type="number" inputMode="numeric" min={7} value={v.productionDays} onChange={set("productionDays")} />
          </Field>
        </div>
      </Section>

      <Section
        title={`Cost breakdown (${currency})`}
        description="Per-unit costs are multiplied by the quoted quantity; logistics is a total. The sampling charge is in the sample proposal below."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {MONEY_FIELDS.map((f) => (
            <Field key={f.name} id={f.name} label={f.label} required={"required" in f && f.required} hint={"hint" in f ? f.hint : undefined}>
              <Input name={f.name} inputMode="decimal" placeholder="0.00" value={v[f.name]} onChange={set(f.name)} className="tabular" />
            </Field>
          ))}
          <Field id="taxPercent" label="Applicable tax (%)" hint="Sales tax or VAT charged on the subtotal.">
            <Input name="taxPercent" inputMode="decimal" placeholder="0" value={v.taxPercent} onChange={set("taxPercent")} className="tabular" />
          </Field>
        </div>
      </Section>

      <Section
        title="Sample proposal"
        description={
          sampleRequest.required
            ? "The brand asked for samples before bulk production. Tell them when and how you will make them."
            : "The brand did not ask for samples. One pre-production sample is still approved on the order before cutting."
        }
      >
        <div className="rounded-md border border-line bg-surface-muted px-3.5 py-3 text-[13px] leading-5">
          <p>
            <span className="text-ink-muted">Brand&apos;s request: </span>
            <span className="font-medium text-ink">{sampleRequest.summary}</span>
          </p>
          {sampleRequest.required && sampleRequest.notes && <p className="mt-1 whitespace-pre-line break-words text-ink">{sampleRequest.notes}</p>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="sampleLeadTimeDays"
            label="Sample lead time (days)"
            required={sampleRequest.required}
            hint={`Days from order confirmation to sending the sample, up to ${MAX_SAMPLE_LEAD_DAYS}.`}
          >
            <Input
              name="sampleLeadTimeDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_SAMPLE_LEAD_DAYS}
              value={v.sampleLeadTimeDays}
              onChange={set("sampleLeadTimeDays")}
              className="tabular"
            />
          </Field>
          <Field id="samplingCost" label="Sampling charge (total)" hint="Added once to the subtotal. Leave empty if sampling is free.">
            <Input name="samplingCost" inputMode="decimal" placeholder="0.00" value={v.samplingCost} onChange={set("samplingCost")} className="tabular" />
          </Field>
        </div>
        <Field id="sampleNotes" label="How you will make the sample" hint="Fabric and trims used, rounds of fit comments included, courier and who pays it.">
          <Textarea name="sampleNotes" rows={3} maxLength={1000} defaultValue={defaults.sampleNotes} />
        </Field>
      </Section>

      {/* Live breakdown: same calculation as the server, which recalculates and stores its own totals. */}
      <section aria-label="Quotation preview" className="overflow-hidden rounded-lg border border-line-strong bg-surface-muted" aria-live="polite">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <p className="eyebrow text-accent-strong">Preview</p>
          <p className="text-xs text-ink-muted">Calculated as you type</p>
        </div>
        {preview ? (
          <>
            <dl className="divide-y divide-line px-4 text-sm sm:px-5">
              <Line label="Cost per unit" value={money(preview.perUnitCost)} />
              <Line label={`Production · ${formatNumber(Number(v.quantity))} units`} value={production ? money(production) : "—"} />
              <Line label="Sampling charge" value={money(v.samplingCost)} />
              <Line label="Logistics estimate" value={money(v.logisticsCost)} />
              <Line label="Subtotal" value={money(preview.subtotal)} strong />
              <Line label={`Tax${Number(v.taxPercent) ? ` (${Number(v.taxPercent)}%)` : ""}`} value={money(preview.taxAmount)} />
            </dl>
            <dl className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t border-line-strong bg-surface px-4 py-4 sm:px-5">
              <div>
                <dt className="label-caps text-ink-muted">Total</dt>
                <dd className="tabular mt-1 text-xs text-ink-muted">{money(preview.effectiveUnitPrice)} effective per unit</dd>
              </div>
              <dd className="type-metric text-ink">{money(preview.totalAmount)}</dd>
            </dl>
          </>
        ) : (
          <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">Enter a quantity and costs to see the total.</p>
        )}
      </section>

      <Section title="Validity and terms">
        <div className="grid gap-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <Field id="validUntil" label="Quotation expires on" required>
            <Input name="validUntil" type="date" min={tomorrow} value={v.validUntil} onChange={set("validUntil")} />
          </Field>
          <Field id="notes" label="Additional terms" hint="Incoterms, payment expectations, assumptions or exclusions.">
            <Textarea name="notes" rows={3} defaultValue={defaults.notes} />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
        <p className="mr-auto hidden text-xs text-ink-muted sm:block">The brand sees every line of your breakdown.</p>
        {!hasBeenSent && (
          <SubmitButton variant="outline" name="intent" value="draft" pendingText="Saving…">
            Save draft
          </SubmitButton>
        )}
        <SubmitButton variant="accent" name="intent" value="submit" pendingText="Sending…">
          <Send /> {hasBeenSent ? "Send revised quotation" : "Send quotation"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function Section({ title, description, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="type-heading text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Line({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={strong ? "font-medium text-ink" : "text-ink-muted"}>{label}</dt>
      <dd className={`tabular text-right ${strong ? "font-semibold text-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

/**
 * Low-emphasis exit from quoting, rendered in the quote panel's footer (outside the quotation form, away from
 * Send). A draft was never seen by the brand, so its wording says the draft is discarded and nobody is told.
 */
export function WithdrawQuotationButton({ quotationId, projectId, isDraft = false }) {
  const action = `/api/quotations/${quotationId}/withdraw`;
  return isDraft ? (
    <ActionDialog
      trigger={
        <Button type="button" variant="ghost" size="sm">
          <Trash2 /> Discard draft
        </Button>
      }
      title="Discard and stop quoting?"
      description="Your draft is discarded and you cannot quote on this project again. The brand is not notified."
      action={action}
      hidden={{ quotationId, projectId }}
      confirmLabel="Discard and stop quoting"
      tone="danger"
    />
  ) : (
    <ActionDialog
      trigger={
        <Button type="button" variant="ghost" size="sm">
          <Undo2 /> Withdraw quotation
        </Button>
      }
      title="Withdraw this quotation?"
      description="The brand is told you withdrew. You cannot quote on this project again."
      action={action}
      hidden={{ quotationId, projectId }}
      confirmLabel="Withdraw quotation"
      tone="danger"
    />
  );
}
