import { z } from "zod";
import { MACHINERY_LIMITS } from "../constants.js";

/** @param {number} max */
const optionalText = (max) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optionalUrl = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Enter a full web address starting with http:// or https://.");
/** @param {string} label @param {number} min @param {number} max */
const int = (label, min, max) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number({ required_error: `Enter the ${label}.`, invalid_type_error: `Enter the ${label} as a number.` }).int().min(min, `The ${label} must be at least ${min}.`).max(max),
  );

export const brandProfileSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name.").max(150),
  country: z.string().trim().min(2, "Enter your country.").max(80),
  city: optionalText(80),
  website: optionalUrl,
  phone: optionalText(40),
  description: optionalText(2000),
});

const CATEGORY_VALUES = /** @type {const} */ ([
  "T_SHIRTS", "SHIRTS", "DRESSES", "DENIM", "TROUSERS", "ACTIVEWEAR", "OUTERWEAR", "KNITWEAR", "HOODIES_SWEATSHIRTS", "KIDSWEAR", "SLEEPWEAR", "ACCESSORIES",
]);

/**
 * One machinery row from the profile form. A row left completely empty is ignored; a half-filled row is
 * an error on the missing part. Errors are keyed `machinery.<row>.type` / `machinery.<row>.quantity`.
 */
const machineRow = z
  .object({
    type: z.string().trim().max(80, "Keep the machine type under 80 characters.").default(""),
    quantity: z.union([z.string(), z.number()]).optional().transform((v) => (v === undefined ? "" : String(v).trim())),
  })
  .superRefine((r, ctx) => {
    if (!r.type && !r.quantity) return;
    if (r.type.length < 2) ctx.addIssue({ code: "custom", path: ["type"], message: "Enter the machine type." });
    const n = Number(r.quantity);
    if (!r.quantity) ctx.addIssue({ code: "custom", path: ["quantity"], message: "Enter how many." });
    else if (!Number.isInteger(n) || n < 1 || n > MACHINERY_LIMITS.quantity) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: `Enter a whole number from 1 to ${MACHINERY_LIMITS.quantity.toLocaleString("en-GB")}.` });
    }
  });

export const machinerySchema = z
  .array(machineRow)
  .max(MACHINERY_LIMITS.rows, `List up to ${MACHINERY_LIMITS.rows} machine types.`)
  .default([])
  .superRefine((rows, ctx) => {
    /** @type {Map<string, number>} */
    const seen = new Map();
    rows.forEach((r, i) => {
      const key = r.type.toLowerCase().replace(/\s+/g, " ");
      if (!key) return;
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i, "type"], message: "Already listed above. Add the quantities together in one row." });
      else seen.set(key, i);
    });
  })
  .transform((rows) => rows.filter((r) => r.type && r.quantity).map((r) => ({ type: r.type.replace(/\s+/g, " "), quantity: Number(r.quantity) })));

export const manufacturerProfileSchema = z
  .object({
    businessName: z.string().trim().min(2, "Enter your factory or business name.").max(150),
    description: z.string().trim().min(30, "Describe your factory in at least 30 characters.").max(3000),
    country: z.string().trim().min(2, "Enter your country.").max(80),
    city: z.string().trim().min(2, "Enter your city.").max(80),
    categories: z.array(z.enum(CATEGORY_VALUES)).min(1, "Choose at least one product category."),
    production: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    fabrics: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    finishing: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    minOrderQuantity: int("minimum order quantity", 1, 1_000_000),
    maxMonthlyCapacity: int("monthly capacity", 1, 10_000_000),
    typicalLeadTimeDays: int("typical lead time", 7, 365),
    contactName: z.string().trim().min(2, "Enter a contact name.").max(100),
    contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    contactPhone: optionalText(40),
    website: optionalUrl,
    machinery: machinerySchema,
  })
  .refine((d) => d.production.length > 0, { path: ["production"], message: "Choose at least one production capability." })
  .refine((d) => d.maxMonthlyCapacity >= d.minOrderQuantity, { path: ["maxMonthlyCapacity"], message: "Monthly capacity must be at least your minimum order quantity." });

/** @typedef {z.infer<typeof manufacturerProfileSchema>} ManufacturerProfileInput */
/** @typedef {ManufacturerProfileInput["machinery"]} MachineryInput */

export const documentSchema = z
  .object({
    type: z.enum(["CERTIFICATION", "BUSINESS_REGISTRATION", "OTHER"], { errorMap: () => ({ message: "Choose a document type." }) }),
    certificationName: optionalText(80),
  })
  .refine((d) => d.type !== "CERTIFICATION" || !!d.certificationName, { path: ["certificationName"], message: "Choose which certification this is." });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128)
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
