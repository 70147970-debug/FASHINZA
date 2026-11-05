import { QCDecision, QCResult } from "@fashinza/shared/enums.js";
import { CREATED_ONLY, date, decimal, enumOf, int, makeSchema, model, optDate, optInt, optStr, ref } from "./_schema.js";

/** Inspection record. Acceptance numbers are stored with the report so later plan changes never alter a historical result. */
const schema = makeSchema(
  {
    orderId: ref("Order"),
    inspectorId: ref("User"),
    inspectionDate: date(),
    batchSize: int(0),
    sampleSize: int(),
    inspectionStandard: { type: String, default: "" },
    aqlMajor: decimal(2),
    aqlMinor: decimal(2),
    acceptMajor: optInt(),
    acceptMinor: optInt(),
    criticalCount: int(0),
    majorCount: int(0),
    minorCount: int(0),
    defectiveCount: int(),
    defectRate: decimal(2, { required: true }),
    defectDescriptions: optStr(),
    correctiveActions: optStr(),
    notes: optStr(),
    result: enumOf(QCResult),
    brandDecision: enumOf(QCDecision, "PENDING"),
    brandDecisionNote: optStr(),
    decidedAt: optDate(),
  },
  { collection: "qc_report", timestamps: CREATED_ONLY },
);
schema.index({ orderId: 1, createdAt: 1 });

export const QCReport = model("QCReport", schema);
export default QCReport;
