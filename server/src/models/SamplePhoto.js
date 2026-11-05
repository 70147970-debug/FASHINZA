import { int, makeSchema, model, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    sampleId: ref("Sample"),
    fileKey: str(),
    fileName: str(),
    mimeType: str(),
    size: int(),
  },
  { collection: "sample_photo" },
);
schema.index({ fileKey: 1 }, { unique: true });
schema.index({ sampleId: 1 });

export const SamplePhoto = model("SamplePhoto", schema);
export default SamplePhoto;
