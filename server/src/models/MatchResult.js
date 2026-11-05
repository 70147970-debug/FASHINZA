import { CREATED_ONLY, decimal, makeSchema, mixed, model, optDate, ref, str, strArray } from "./_schema.js";

/** Output of the rule-based matching engine; a row is what lets a manufacturer see and quote on a project. */
const schema = makeSchema(
  {
    projectId: ref("Project"),
    manufacturerId: ref("User"),
    score: decimal(2, { required: true }),
    breakdown: mixed(),
    reasons: strArray(),
    algorithm: str(),
    invitedAt: optDate(),
  },
  { collection: "match_result", timestamps: CREATED_ONLY },
);
schema.index({ projectId: 1, manufacturerId: 1 }, { unique: true });
schema.index({ manufacturerId: 1, createdAt: 1 });

export const MatchResult = model("MatchResult", schema);
export default MatchResult;
