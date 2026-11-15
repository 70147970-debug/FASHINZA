import { BOTH, makeSchema, model, optStr, ref, str } from "./_schema.js";
import { socialLinks } from "./_social-links.js";

const schema = makeSchema(
  {
    userId: ref("User"),
    companyName: str(),
    description: optStr(),
    country: str(),
    city: optStr(),
    website: optStr(),
    socialLinks: socialLinks(),
    phone: optStr(),
  },
  { collection: "brand_profile", timestamps: BOTH },
);
schema.index({ userId: 1 }, { unique: true });

export const BrandProfile = model("BrandProfile", schema);
export default BrandProfile;
