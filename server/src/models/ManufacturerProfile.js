import { GarmentCategory, VerificationStatus } from "@fashinza/shared/enums.js";
import { BOTH, enumOf, int, makeSchema, model, optDate, optStr, ref, str } from "./_schema.js";

const schema = makeSchema(
  {
    userId: ref("User"),
    businessName: str(),
    description: str(),
    country: str(),
    city: str(),
    categories: { type: [{ type: String, enum: GarmentCategory }], default: [] },
    minOrderQuantity: int(),
    maxMonthlyCapacity: int(),
    typicalLeadTimeDays: int(45),
    contactName: str(),
    contactEmail: str(),
    contactPhone: optStr(),
    website: optStr(),
    verificationStatus: enumOf(VerificationStatus, "UNSUBMITTED"),
    verificationNote: optStr(),
    verificationRequestedAt: optDate(),
    verifiedAt: optDate(),
  },
  { collection: "manufacturer_profile", timestamps: BOTH },
);
schema.index({ userId: 1 }, { unique: true });
schema.index({ verificationStatus: 1 });
schema.index({ country: 1 });

export const ManufacturerProfile = model("ManufacturerProfile", schema);
export default ManufacturerProfile;
