import { SampleStatus } from "@fashinza/shared/enums.js";
import { CREATED_ONLY, enumOf, int, makeSchema, model, optDate, optRef, optStr, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    orderId: ref("Order"),
    round: int(),
    description: str(),
    revisionNotes: optStr(),
    status: enumOf(SampleStatus, "SUBMITTED"),
    feedback: optStr(),
    submittedById: ref("User"),
    reviewedById: optRef("User"),
    reviewedAt: optDate(),
  },
  { collection: "sample", timestamps: CREATED_ONLY },
);
schema.index({ orderId: 1, round: 1 }, { unique: true });

export const Sample = model("Sample", schema);
export default Sample;
