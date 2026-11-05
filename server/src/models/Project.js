import { GarmentCategory, ProjectStatus } from "@fashinza/shared/enums.js";
import { BOTH, bool, decimal, enumOf, int, makeSchema, model, optDate, optInt, optStr, ref, str, strArray } from "./_schema.js";

/** Fields other than name and category may be empty while the project is a DRAFT; submission validates the whole project. */
const schema = makeSchema(
  {
    brandId: ref("User"),
    name: str(),
    category: enumOf(GarmentCategory),
    description: optStr(),
    quantity: optInt(),
    maxMoq: optInt(),
    targetUnitPrice: decimal(2),
    currency: { type: String, default: "USD" },
    deadline: optDate(),
    fabricRequirements: optStr(),
    fabrics: strArray(),
    sizes: strArray(),
    colors: optStr(),
    additionalInstructions: optStr(),
    requiredCapabilities: strArray(),
    preferredCountry: optStr(),
    requiredCertifications: strArray(),
    sustainabilityNotes: optStr(),
    sampleRequired: bool(true),
    sampleQuantity: optInt(1),
    sampleSizes: strArray(),
    sampleNotes: optStr(),
    status: enumOf(ProjectStatus, "DRAFT"),
    wizardStep: int(1),
    submittedAt: optDate(),
  },
  { collection: "project", timestamps: BOTH },
);
schema.index({ brandId: 1, status: 1 });
schema.index({ status: 1, category: 1 });

export const Project = model("Project", schema);
export default Project;
