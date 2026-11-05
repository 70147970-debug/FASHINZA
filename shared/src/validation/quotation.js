import { z } from "zod";

/** @param {string} label @param {boolean} [required] */
const money = (label, required = false) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? (required ? undefined : "0") : String(v).trim()),
    z.string({ required_error: `Enter the ${label}.` }).regex(/^\d{1,9}(\.\d{1,2})?$/, `Enter the ${label} as an amount such as 4.50.`),
  );
/** @param {string} label @param {number} min @param {number} max */
const int = (label, min, max) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number({ required_error: `Enter the ${label}.`, invalid_type_error: `Enter the ${label} as a number.` }).int(`Enter the ${label} as a whole number.`).min(min, `The ${label} must be at least ${min}.`).max(max),
  );

export const MAX_SAMPLE_LEAD_DAYS = 120;

/** @param {string} label @param {number} min @param {number} max */
const optionalInt = (label, min, max) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z
      .number({ invalid_type_error: `Enter the ${label} as a number.` })
      .int(`Enter the ${label} as a whole number.`)
      .min(min, `The ${label} must be at least ${min}.`)
      .max(max, `The ${label} cannot be more than ${max}.`)
      .optional(),
  );

export const quotationSchema = z
  .object({
    quantity: int("quoted quantity", 1, 1_000_000),
    unitPrice: money("making cost per unit", true),
    fabricCostPerUnit: money("fabric cost per unit"),
    finishingCostPerUnit: money("finishing cost per unit"),
    packagingCostPerUnit: money("packaging cost per unit"),
    samplingCost: money("sampling charge"),
    logisticsCost: money("logistics estimate"),
    taxPercent: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? "0" : String(v).trim()),
      z.string().regex(/^\d{1,2}(\.\d{1,2})?$|^100$/, "Enter tax as a percentage between 0 and 100."),
    ),
    minQuantity: int("minimum quantity", 1, 1_000_000),
    productionDays: int("production duration", 7, 365),
    validUntil: z.coerce.date({ errorMap: () => ({ message: "Choose the date this quotation expires." }) }),
    notes: z.string().trim().max(3000).optional().transform((v) => v || undefined),
    /** Sample proposal. Required by the service when the brand asked for samples and the quotation is sent. */
    sampleLeadTimeDays: optionalInt("sample lead time", 1, MAX_SAMPLE_LEAD_DAYS),
    sampleNotes: z.string().trim().max(1000, "Keep the sample notes under 1,000 characters.").optional().transform((v) => v || undefined),
  })
  .superRefine((d, ctx) => {
    if (d.minQuantity > d.quantity) ctx.addIssue({ code: "custom", path: ["minQuantity"], message: "Minimum quantity cannot exceed the quoted quantity." });
    if (Number(d.unitPrice) <= 0) ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "The making cost per unit must be greater than zero." });
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.validUntil < tomorrow) ctx.addIssue({ code: "custom", path: ["validUntil"], message: "The expiry date must be in the future." });
  });

/** @typedef {z.infer<typeof quotationSchema>} QuotationInput */

export const decisionNoteSchema = z.object({
  note: z.string().trim().min(5, "Explain your decision in at least 5 characters.").max(2000),
});
