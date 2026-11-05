import { BOTH, makeSchema, model, optStr, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    userId: ref("User"),
    companyName: str(),
    description: optStr(),
    country: str(),
    city: optStr(),
    website: optStr(),
    phone: optStr(),
  },
  { collection: "brand_profile", timestamps: BOTH },
);
schema.index({ userId: 1 }, { unique: true });

export const BrandProfile = model("BrandProfile", schema);
export default BrandProfile;
