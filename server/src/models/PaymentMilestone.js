import { MilestoneStage, PaymentMilestoneStatus } from "@fashinza/shared/enums.js";
import { BOTH, decimal, enumOf, int, makeSchema, model, optDate, ref, str } from "./_schema.js";

/** Milestone payment schedule; only a verified provider webhook can mark a payment as paid. */
const schema = makeSchema(
  {
    orderId: ref("Order"),
    sequence: int(),
    label: str(),
    percentage: decimal(2, { required: true }),
    amount: decimal(2, { required: true }),
    currency: str(),
    triggerStage: enumOf(MilestoneStage),
    status: enumOf(PaymentMilestoneStatus, "SCHEDULED"),
    dueAt: optDate(),
    paidAt: optDate(),
  },
  { collection: "payment_milestone", timestamps: BOTH },
);
schema.index({ orderId: 1, sequence: 1 }, { unique: true });
schema.index({ status: 1 });

export const PaymentMilestone = model("PaymentMilestone", schema);
export default PaymentMilestone;
