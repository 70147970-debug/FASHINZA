import { MilestoneStage, MilestoneStatus, ResponsibleParty } from "@fashinza/shared/enums.js";
import { UPDATED_ONLY, bool, enumOf, int, makeSchema, model, optDate, optRef, optStr, ref } from "./_schema.js";

const schema = makeSchema(
  {
    orderId: ref("Order"),
    stage: enumOf(MilestoneStage),
    sequence: int(),
    status: enumOf(MilestoneStatus, "NOT_STARTED"),
    responsibleParty: enumOf(ResponsibleParty, "MANUFACTURER"),
    evidenceRequired: bool(false),
    plannedStart: optDate(),
    plannedEnd: optDate(),
    startedAt: optDate(),
    completedAt: optDate(),
    responsibleUserId: optRef("User"),
    notes: optStr(),
    isDelayed: bool(false),
    delayReason: optStr(),
  },
  { collection: "production_milestone", timestamps: UPDATED_ONLY },
);
schema.index({ orderId: 1, stage: 1 }, { unique: true });
schema.index({ orderId: 1, sequence: 1 }, { unique: true });
schema.index({ status: 1, plannedEnd: 1 });

export const ProductionMilestone = model("ProductionMilestone", schema);
export default ProductionMilestone;
