import { TransactionStatus, TransactionType } from "@fashinza/shared/enums.js";
import { BOTH, decimal, enumOf, makeSchema, model, optRef, optStr, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    paymentMilestoneId: ref("PaymentMilestone"),
    provider: str(),
    providerRef: str(),
    type: enumOf(TransactionType),
    amount: decimal(2, { required: true }),
    currency: str(),
    status: enumOf(TransactionStatus, "PENDING"),
    failureReason: optStr(),
    initiatedById: optRef("User"),
  },
  { collection: "payment_transaction", timestamps: BOTH },
);
schema.index({ providerRef: 1 }, { unique: true });
schema.index({ paymentMilestoneId: 1, createdAt: 1 });

export const PaymentTransaction = model("PaymentTransaction", schema);
export default PaymentTransaction;
