import { CREATED_ONLY, int, makeSchema, model, optStr, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    milestoneId: ref("ProductionMilestone"),
    uploadedById: ref("User"),
    fileKey: str(),
    fileName: str(),
    mimeType: str(),
    size: int(),
    note: optStr(),
  },
  { collection: "milestone_evidence", timestamps: CREATED_ONLY },
);
schema.index({ fileKey: 1 }, { unique: true });
schema.index({ milestoneId: 1 });

export const MilestoneEvidence = model("MilestoneEvidence", schema);
export default MilestoneEvidence;
