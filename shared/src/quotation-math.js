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

/**
 * @typedef {object} QuotationCostInput
 * @property {number} quantity
 * @property {Decimal.Value} unitPrice
 * @property {Decimal.Value} [fabricCostPerUnit]
 * @property {Decimal.Value} [finishingCostPerUnit]
 * @property {Decimal.Value} [packagingCostPerUnit]
 * @property {Decimal.Value | null} [samplingCost]
 * @property {Decimal.Value} [logisticsCost]
 * @property {Decimal.Value} [taxPercent]
 */

/**
 * @typedef {object} QuotationTotals
 * @property {string} perUnitCost
 * @property {string} subtotal
 * @property {string} taxAmount
 * @property {string} totalAmount
 * @property {string} effectiveUnitPrice
 */

/** @param {Decimal.Value | null | undefined} v */
const d = (v) => new Decimal(v ?? 0);
/** @param {Decimal} v */
const money = (v) => v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** @param {QuotationCostInput} input @returns {QuotationTotals} */
export function calculateQuotationTotals(input) {
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

/**
 * Split an order total across payment milestones; the last share absorbs rounding so the sum is exact.
 * @param {Decimal.Value} total @param {Decimal.Value[]} percentages @returns {string[]}
 */
export function allocateAmounts(total, percentages) {
  const sum = percentages.reduce((acc, p) => acc.plus(d(p)), new Decimal(0));
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
