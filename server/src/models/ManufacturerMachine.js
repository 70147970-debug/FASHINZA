import { int, makeSchema, model, ref, str } from "./_schema.js";

/** Machinery a factory lists on its profile, e.g. "Single-needle lockstitch" × 40. Not used for match scores. */
const schema = makeSchema(
  {
    profileId: ref("ManufacturerProfile"),
    type: str(),
    quantity: int(),
    sortOrder: int(0),
  },
  { collection: "manufacturer_machine" },
);
schema.index({ profileId: 1, type: 1 }, { unique: true });

export const ManufacturerMachine = model("ManufacturerMachine", schema);
export default ManufacturerMachine;
