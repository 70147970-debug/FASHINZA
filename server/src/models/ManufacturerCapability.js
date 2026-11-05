import { CapabilityKind } from "@fashinza/shared/enums.js";
import { enumOf, makeSchema, model, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    profileId: ref("ManufacturerProfile"),
    kind: enumOf(CapabilityKind),
    name: str(),
  },
  { collection: "manufacturer_capability" },
);
schema.index({ profileId: 1, kind: 1, name: 1 }, { unique: true });
schema.index({ name: 1 });

export const ManufacturerCapability = model("ManufacturerCapability", schema);
export default ManufacturerCapability;
