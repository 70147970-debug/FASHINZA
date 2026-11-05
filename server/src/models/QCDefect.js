import { DefectSeverity } from "@fashinza/shared/enums.js";
import { enumOf, int, makeSchema, model, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    reportId: ref("QCReport"),
    category: str(),
    severity: enumOf(DefectSeverity),
    count: int(),
  },
  { collection: "qc_defect" },
);
schema.index({ reportId: 1 });

export const QCDefect = model("QCDefect", schema);
export default QCDefect;
