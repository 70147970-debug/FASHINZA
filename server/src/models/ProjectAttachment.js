import { AttachmentKind } from "@fashinza/shared/enums.js";
import { CREATED_ONLY, enumOf, int, makeSchema, model, optInt, optStr, ref, str } from "./_schema.js";

/** TECH_PACK attachments are versioned per project; the highest version is the current one. */
const schema = makeSchema(
  {
    projectId: ref("Project"),
    uploadedById: ref("User"),
    kind: enumOf(AttachmentKind, "OTHER"),
    version: optInt(),
    notes: optStr(),
    fileKey: str(),
    fileName: str(),
    mimeType: str(),
    size: int(),
  },
  { collection: "project_attachment", timestamps: CREATED_ONLY },
);
schema.index({ fileKey: 1 }, { unique: true });
// PostgreSQL treats NULL versions as distinct, so only numbered versions are unique.
schema.index({ projectId: 1, kind: 1, version: 1 }, { unique: true, partialFilterExpression: { version: { $type: "number" } } });
schema.index({ projectId: 1 });

export const ProjectAttachment = model("ProjectAttachment", schema);
export default ProjectAttachment;
