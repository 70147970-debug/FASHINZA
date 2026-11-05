import { int, makeSchema, model, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    reportId: ref("QCReport"),
    fileKey: str(),
    fileName: str(),
    mimeType: str(),
    size: int(),
  },
  { collection: "qc_report_photo" },
);
schema.index({ fileKey: 1 }, { unique: true });
schema.index({ reportId: 1 });

export const QCReportPhoto = model("QCReportPhoto", schema);
export default QCReportPhoto;
