import { ReworkStatus } from "@fashinza/shared/enums.js";
import { CREATED_ONLY, enumOf, makeSchema, model, optDate, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    orderId: ref("Order"),
    qcReportId: ref("QCReport"),
    description: str(),
    status: enumOf(ReworkStatus, "OPEN"),
    resolvedAt: optDate(),
  },
  { collection: "rework_task", timestamps: CREATED_ONLY },
);
schema.index({ qcReportId: 1 }, { unique: true });
schema.index({ orderId: 1, status: 1 });

export const ReworkTask = model("ReworkTask", schema);
export default ReworkTask;
