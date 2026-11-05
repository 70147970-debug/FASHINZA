import { CREATED_ONLY, makeSchema, model, optRef, ref, str } from "./_schema.js";

/** Order-linked messages; milestoneId is set for comments on a specific production milestone. */
const schema = makeSchema(
  {
    orderId: ref("Order"),
    milestoneId: optRef("ProductionMilestone"),
    authorId: ref("User"),
    body: str(),
  },
  { collection: "message", timestamps: CREATED_ONLY },
);
schema.index({ orderId: 1, createdAt: 1 });

export const Message = model("Message", schema);
export default Message;
