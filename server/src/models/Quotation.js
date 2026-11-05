import { QuotationStatus } from "@fashinza/shared/enums.js";
import { BOTH, date, decimal, enumOf, int, makeSchema, model, optDate, optInt, optStr, ref, str } from "./_schema.js";

/** One quotation per manufacturer per project; revisions keep the history. unitPrice is the per-unit making (CMT) cost. */
const schema = makeSchema(
  {
    projectId: ref("Project"),
    manufacturerId: ref("User"),
    quantity: int(0),
    unitPrice: decimal(2, { required: true }),
    fabricCostPerUnit: decimal(2, { default: 0 }),
    finishingCostPerUnit: decimal(2, { default: 0 }),
    packagingCostPerUnit: decimal(2, { default: 0 }),
    logisticsCost: decimal(2, { default: 0 }),
    taxPercent: decimal(2, { default: 0 }),
    subtotal: decimal(2, { default: 0 }),
    taxAmount: decimal(2, { default: 0 }),
    totalAmount: decimal(2, { default: 0 }),
    currency: str(),
    minQuantity: int(),
    productionDays: int(),
    samplingCost: decimal(2),
    sampleLeadTimeDays: optInt(),
    sampleNotes: optStr(),
    notes: optStr(),
    validUntil: date(),
    status: enumOf(QuotationStatus, "DRAFT"),
    revisionRequest: optStr(),
    version: int(1),
    submittedAt: optDate(),
    decidedAt: optDate(),
  },
  { collection: "quotation", timestamps: BOTH },
);
schema.index({ projectId: 1, manufacturerId: 1 }, { unique: true });
schema.index({ manufacturerId: 1, status: 1 });
schema.index({ projectId: 1, status: 1 });

export const Quotation = model("Quotation", schema);
export default Quotation;
