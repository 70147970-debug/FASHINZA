import { Decimal } from "decimal.js";

/**
 * Quotation totals. All money arithmetic uses Decimal (never JS floats) and is
 * rounded half-up to 2 decimal places, matching the Decimal(14,2) columns.
 *
 *   per-unit cost = making (CMT) + fabric + finishing + packaging
 *   subtotal      = per-unit cost × quantity + sampling charge + logistics estimate
 *   tax           = subtotal × tax% / 100
 *   total         = subtotal + tax
 */
export type QuotationCostInput = {
  quantity: number;
  unitPrice: Decimal.Value;
  fabricCostPerUnit?: Decimal.Value;
  finishingCostPerUnit?: Decimal.Value;
  packagingCostPerUnit?: Decimal.Value;
  samplingCost?: Decimal.Value | null;
  logisticsCost?: Decimal.Value;
  taxPercent?: Decimal.Value;
};

export type QuotationTotals = {
  perUnitCost: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  effectiveUnitPrice: string;
};

const d = (v: Decimal.Value | null | undefined) => new Decimal(v ?? 0);
const money = (v: Decimal) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function calculateQuotationTotals(input: QuotationCostInput): QuotationTotals {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new RangeError("Quantity must be a positive whole number.");
  const parts = [input.unitPrice, input.fabricCostPerUnit, input.finishingCostPerUnit, input.packagingCostPerUnit, input.samplingCost, input.logisticsCost, input.taxPercent];
  if (parts.some((p) => d(p).isNegative())) throw new RangeError("Costs cannot be negative.");
  if (d(input.taxPercent).greaterThan(100)) throw new RangeError("Tax cannot exceed 100%.");

  const perUnit = d(input.unitPrice).plus(d(input.fabricCostPerUnit)).plus(d(input.finishingCostPerUnit)).plus(d(input.packagingCostPerUnit));
  const subtotal = money(perUnit.times(input.quantity).plus(d(input.samplingCost)).plus(d(input.logisticsCost)));
  const tax = money(subtotal.times(d(input.taxPercent)).dividedBy(100));
  const total = subtotal.plus(tax);
  return {
    perUnitCost: money(perUnit).toFixed(2),
    subtotal: subtotal.toFixed(2),
    taxAmount: tax.toFixed(2),
    totalAmount: total.toFixed(2),
    effectiveUnitPrice: money(total.dividedBy(input.quantity)).toFixed(2),
  };
}

/** Split an order total across payment milestones; the last share absorbs rounding so the sum is exact. */
export function allocateAmounts(total: Decimal.Value, percentages: Decimal.Value[]): string[] {
  const sum = percentages.reduce<Decimal>((acc, p) => acc.plus(d(p)), new Decimal(0));
  if (!sum.equals(100)) throw new RangeError("Payment percentages must add up to 100.");
  if (percentages.some((p) => d(p).lte(0))) throw new RangeError("Each payment percentage must be greater than zero.");
  const t = d(total);
  let allocated = new Decimal(0);
  return percentages.map((p, i) => {
    const share = i === percentages.length - 1 ? t.minus(allocated) : money(t.times(d(p)).dividedBy(100));
    allocated = allocated.plus(share);
    return share.toFixed(2);
  });
}
