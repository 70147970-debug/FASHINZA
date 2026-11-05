import { MilestoneStage, OrderStatus } from "@fashinza/shared/enums.js";
import { BOTH, date, decimal, enumOf, int, makeSchema, model, optDate, optMixed, optStr, ref, str } from "./_schema.js";

/** projectId and quotationId are unique, so a project can never have two orders. */
const schema = makeSchema(
  {
    reference: str(),
    projectId: ref("Project"),
    quotationId: ref("Quotation"),
    brandId: ref("User"),
    manufacturerId: ref("User"),
    quantity: int(),
    unitPrice: decimal(2, { required: true }),
    totalAmount: decimal(2, { default: 0 }),
    currency: str(),
    agreedTerms: optMixed(),
    status: enumOf(OrderStatus, "IN_PRODUCTION"),
    currentStage: enumOf(MilestoneStage, "FABRIC_SOURCING"),
    expectedCompletionDate: date(),
    trackingInfo: optStr(),
    shippedAt: optDate(),
    deliveredAt: optDate(),
  },
  { collection: "order", timestamps: BOTH },
);
schema.index({ reference: 1 }, { unique: true });
schema.index({ projectId: 1 }, { unique: true });
schema.index({ quotationId: 1 }, { unique: true });
schema.index({ brandId: 1, status: 1 });
schema.index({ manufacturerId: 1, status: 1 });
schema.index({ status: 1, expectedCompletionDate: 1 });

export const Order = model("Order", schema);
export default Order;
