import { DocumentStatus, DocumentType } from "@fashinza/shared/enums.js";
import { CREATED_ONLY, enumOf, int, makeSchema, model, optDate, optStr, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    profileId: ref("ManufacturerProfile"),
    type: enumOf(DocumentType),
    certificationName: optStr(),
    fileKey: str(),
    fileName: str(),
    mimeType: str(),
    size: int(),
    status: enumOf(DocumentStatus, "PENDING"),
    reviewNote: optStr(),
    reviewedAt: optDate(),
  },
  { collection: "manufacturer_document", timestamps: CREATED_ONLY },
);
schema.index({ fileKey: 1 }, { unique: true });
schema.index({ profileId: 1, status: 1 });

export const ManufacturerDocument = model("ManufacturerDocument", schema);
export default ManufacturerDocument;
