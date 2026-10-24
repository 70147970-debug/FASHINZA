"use client";

import { useMemo, useState } from "react";
import { Send, Undo2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateQuotationTotals } from "@/lib/quotation-math";
import { formatMoney, isoDateInDays } from "@/lib/format";
import { saveQuotationAction, withdrawQuotationAction } from "@/app/(app)/opportunities/actions";

export type QuotationDefaults = {
  quantity: number;
  unitPrice: string;
  fabricCostPerUnit: string;
  finishingCostPerUnit: string;
  packagingCostPerUnit: string;
  samplingCost: string;
  logisticsCost: string;
  taxPercent: string;
  minQuantity: number;
  productionDays: number;
  validUntil: string;
  notes: string;
};

const MONEY_FIELDS = [
  { name: "unitPrice", label: "Making cost per unit (CMT)", required: true, hint: "Cut, make and trim per piece." },
  { name: "fabricCostPerUnit", label: "Fabric cost per unit" },
  { name: "finishingCostPerUnit", label: "Finishing cost per unit", hint: "Washing, dyeing, printing, labelling." },
  { name: "packagingCostPerUnit", label: "Packaging cost per unit" },
  { name: "samplingCost", label: "Sampling charge (total)" },
  { name: "logisticsCost", label: "Logistics estimate (total)", hint: "Inland freight, export clearance or shipping as agreed in your terms." },
] as const;

/**
 * Quotation editor. The preview uses the same calculation as the server, but the server always
 * recalculates and stores its own totals — the preview is never trusted.
 */
export function QuotationForm({
  projectId,
  currency,
  defaults,
  hasBeenSent,
}: {
  projectId: string;
  currency: string;
  defaults: QuotationDefaults;
  hasBeenSent: boolean;
}) {
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries(Object.entries(defaults).map(([k, x]) => [k, String(x)])));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
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
  const tomorrow = isoDateInDays(1);

  return (
    <ActionForm action={saveQuotationAction} className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />
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

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-navy">Cost breakdown ({currency})</legend>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MONEY_FIELDS.map((f) => (
            <Field key={f.name} id={f.name} label={f.label} required={"required" in f && f.required} hint={"hint" in f ? f.hint : undefined}>
              <Input name={f.name} inputMode="decimal" placeholder="0.00" value={v[f.name]} onChange={set(f.name)} />
            </Field>
          ))}
          <Field id="taxPercent" label="Applicable tax (%)" hint="Sales tax or VAT charged on the subtotal.">
            <Input name="taxPercent" inputMode="decimal" placeholder="0" value={v.taxPercent} onChange={set("taxPercent")} />
          </Field>
        </div>
      </fieldset>

      <div className="rounded-md border border-line bg-canvas p-4" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
        {preview ? (
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted">Cost per unit</dt><dd className="tabular font-medium">{formatMoney(preview.perUnitCost, currency)}</dd></div>
            <div><dt className="text-xs text-muted">Subtotal</dt><dd className="tabular font-medium">{formatMoney(preview.subtotal, currency)}</dd></div>
            <div><dt className="text-xs text-muted">Tax</dt><dd className="tabular font-medium">{formatMoney(preview.taxAmount, currency)}</dd></div>
            <div><dt className="text-xs text-muted">Total</dt><dd className="tabular font-display text-lg font-semibold text-navy">{formatMoney(preview.totalAmount, currency)}</dd></div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">Enter a quantity and costs to see the total.</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
        <Field id="validUntil" label="Quotation expires on" required>
          <Input name="validUntil" type="date" min={tomorrow} value={v.validUntil} onChange={set("validUntil")} />
        </Field>
        <Field id="notes" label="Additional terms" hint="Incoterms, payment expectations, assumptions or exclusions.">
          <Textarea name="notes" rows={3} defaultValue={defaults.notes} />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        {!hasBeenSent && <SubmitButton variant="outline" name="intent" value="draft" pendingText="Saving…">Save draft</SubmitButton>}
        <SubmitButton variant="accent" name="intent" value="submit" pendingText="Sending…">
          <Send /> {hasBeenSent ? "Send revised quotation" : "Send quotation"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function WithdrawQuotationButton({ quotationId, projectId }: { quotationId: string; projectId: string }) {
  return (
    <ActionDialog
      trigger={<Button type="button" variant="outline"><Undo2 /> Withdraw quotation</Button>}
      title="Withdraw this quotation?"
      description="The brand is told you withdrew. You cannot quote on this project again."
      action={withdrawQuotationAction}
      hidden={{ quotationId, projectId }}
      confirmLabel="Withdraw quotation"
      tone="danger"
    />
  );
}
