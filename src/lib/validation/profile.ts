import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const optionalUrl = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => !v || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Enter a full web address starting with http:// or https://.");
const int = (label: string, min: number, max: number) =>
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

const CATEGORY_VALUES = [
  "T_SHIRTS", "SHIRTS", "DRESSES", "DENIM", "TROUSERS", "ACTIVEWEAR", "OUTERWEAR", "KNITWEAR", "HOODIES_SWEATSHIRTS", "KIDSWEAR", "SLEEPWEAR", "ACCESSORIES",
] as const;

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
  })
  .refine((d) => d.production.length > 0, { path: ["production"], message: "Choose at least one production capability." })
  .refine((d) => d.maxMonthlyCapacity >= d.minOrderQuantity, { path: ["maxMonthlyCapacity"], message: "Monthly capacity must be at least your minimum order quantity." });

export type ManufacturerProfileInput = z.infer<typeof manufacturerProfileSchema>;

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
