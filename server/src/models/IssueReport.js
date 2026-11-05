import { IssueCategory, IssueStatus } from "@fashinza/shared/enums.js";
import { BOTH, enumOf, makeSchema, model, optDate, optRef, optStr, ref, str } from "./_schema.js";

/** Disputes and problem reports raised by brands or manufacturers. */
const schema = makeSchema(
  {
    reporterId: ref("User"),
    projectId: optRef("Project"),
    orderId: optRef("Order"),
    category: enumOf(IssueCategory, "OTHER"),
    subject: str(),
    description: str(),
    status: enumOf(IssueStatus, "OPEN"),
    adminNote: optStr(),
    resolution: optStr(),
    resolvedAt: optDate(),
  },
  { collection: "issue_report", timestamps: BOTH },
);
schema.index({ status: 1, createdAt: 1 });
schema.index({ reporterId: 1 });
schema.index({ orderId: 1 });

export const IssueReport = model("IssueReport", schema);
export default IssueReport;
