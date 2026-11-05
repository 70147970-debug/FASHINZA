import { CREATED_ONLY, date, decimal, int, makeSchema, model, optMixed, optStr, ref } from "./_schema.js";

const schema = makeSchema(
  {
    quotationId: ref("Quotation"),
    version: int(),
    unitPrice: decimal(2, { required: true }),
    minQuantity: int(),
    productionDays: int(),
    samplingCost: decimal(2),
    notes: optStr(),
    validUntil: date(),
    snapshot: optMixed(),
  },
  { collection: "quotation_revision", timestamps: CREATED_ONLY },
);
schema.index({ quotationId: 1, version: 1 }, { unique: true });

export const QuotationRevision = model("QuotationRevision", schema);
export default QuotationRevision;
