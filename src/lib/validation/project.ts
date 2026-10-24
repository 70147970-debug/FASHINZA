import { z } from "zod";
import { CURRENCIES } from "@/lib/constants";

const CATEGORY_VALUES = [
  "T_SHIRTS", "SHIRTS", "DRESSES", "DENIM", "TROUSERS", "ACTIVEWEAR", "OUTERWEAR", "KNITWEAR", "HOODIES_SWEATSHIRTS", "KIDSWEAR", "SLEEPWEAR", "ACCESSORIES",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number({ invalid_type_error: `Enter ${label} as a number.` }).int(`Enter ${label} as a whole number.`).min(min, `${label[0].toUpperCase() + label.slice(1)} must be at least ${min}.`).max(max).optional(),
  );
const list = z.array(z.string().trim().min(1).max(80)).max(30).default([]);

export const MIN_LEAD_DAYS = 14;

/** Fields per wizard step. Drafts accept partial data; only name and category are needed to save. */
export const projectDraftSchema = z.object({
  name: z.string().trim().min(3, "Enter a project name (at least 3 characters).").max(120),
  category: z.enum(CATEGORY_VALUES, { errorMap: () => ({ message: "Choose a product category." }) }),
  description: optionalText(5000),
  fabricRequirements: optionalText(1000),
  fabrics: list,
  colors: optionalText(300),
  sizes: list,
  requiredCapabilities: list,
  additionalInstructions: optionalText(3000),
  quantity: optionalInt("the quantity", 1, 1_000_000),
  maxMoq: optionalInt("the MOQ limit", 1, 1_000_000),
  targetUnitPrice: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : String(v)),
    z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter a price such as 4.50.").optional(),
  ),
  currency: z.enum(CURRENCIES).default("USD"),
  deadline: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.date({ invalid_type_error: "Enter a valid date." }).optional(),
  ),
  preferredCountry: optionalText(80),
  requiredCertifications: list,
  sustainabilityNotes: optionalText(2000),
});

export type ProjectDraftInput = z.infer<typeof projectDraftSchema>;

/** Everything a factory needs to quote. Checked when the brand submits the project. */
export const projectSubmitSchema = projectDraftSchema
  .extend({
    description: z.string().trim().min(20, "Describe the product in at least 20 characters.").max(5000),
    fabricRequirements: z.string().trim().min(3, "Describe the fabric type and composition.").max(1000),
    colors: z.string().trim().min(1, "List at least one colour.").max(300),
    sizes: z.array(z.string().trim().min(1)).min(1, "Choose at least one size."),
    quantity: z.number({ required_error: "Enter the estimated quantity." }).int().min(1).max(1_000_000),
    deadline: z.date({ required_error: "Choose a desired delivery date." }),
  })
  .superRefine((d, ctx) => {
    const earliest = new Date(Date.now() + MIN_LEAD_DAYS * 24 * 60 * 60 * 1000);
    if (d.deadline < earliest) ctx.addIssue({ code: "custom", path: ["deadline"], message: `Choose a delivery date at least ${MIN_LEAD_DAYS} days from today.` });
    if (d.maxMoq !== undefined && d.maxMoq > d.quantity) ctx.addIssue({ code: "custom", path: ["maxMoq"], message: "The MOQ limit cannot be higher than the order quantity." });
  });

export const PROJECT_STEPS = [
  { step: 1, title: "Basics", fields: ["name", "category", "description"] },
  { step: 2, title: "Specifications", fields: ["fabricRequirements", "fabrics", "colors", "sizes", "requiredCapabilities", "additionalInstructions"] },
  { step: 3, title: "Quantity & budget", fields: ["quantity", "maxMoq", "targetUnitPrice", "currency", "deadline", "preferredCountry"] },
  { step: 4, title: "Sustainability", fields: ["requiredCertifications", "sustainabilityNotes"] },
  { step: 5, title: "Tech pack & files", fields: [] },
  { step: 6, title: "Review & submit", fields: [] },
] as const;

export const ARRAY_FIELDS = ["fabrics", "sizes", "requiredCapabilities", "requiredCertifications"] as const;

export const SIZE_OPTIONS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "Kids 2-4", "Kids 5-8", "Kids 9-12", "One size"];
