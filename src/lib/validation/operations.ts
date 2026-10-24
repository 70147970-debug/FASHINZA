import { z } from "zod";
import { SUPPORTED_AQLS } from "@/lib/aql";

const int = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number({ required_error: `Enter the ${label}.`, invalid_type_error: `Enter the ${label} as a number.` }).int(`Enter the ${label} as a whole number.`).min(min, `The ${label} must be at least ${min}.`).max(max),
  );
const aql = (label: string) =>
  z.preprocess((v) => Number(v), z.number().refine((n) => (SUPPORTED_AQLS as readonly number[]).includes(n), `Choose a supported AQL for ${label} defects.`));

export const sampleSchema = z.object({
  description: z.string().trim().min(10, "Describe the sample in at least 10 characters.").max(2000),
  revisionNotes: z.string().trim().max(2000).optional().transform((v) => v || undefined),
});

export const sampleReviewSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"], { errorMap: () => ({ message: "Choose a decision." }) }),
    feedback: z.string().trim().max(2000).optional().transform((v) => v || undefined),
  })
  .refine((d) => d.decision === "APPROVED" || (d.feedback && d.feedback.length >= 5), {
    path: ["feedback"],
    message: "Explain what needs to change (at least 5 characters).",
  });

export const DEFECT_CATEGORIES = [
  "Stitching", "Measurements", "Fabric flaw", "Colour / shade", "Print / embroidery", "Stains / soiling", "Trims & accessories", "Labelling", "Packaging", "Other",
];

export const defectLineSchema = z.object({
  category: z.string().trim().min(1).max(60),
  severity: z.enum(["CRITICAL", "MAJOR", "MINOR"]),
  count: z.number().int().min(1).max(100_000),
});

export const qcReportSchema = z
  .object({
    inspectionDate: z.coerce.date({ errorMap: () => ({ message: "Enter the inspection date." }) }),
    batchSize: int("batch size", 2, 10_000_000),
    sampleSize: int("number of units inspected", 1, 10_000_000),
    aqlMajor: aql("major"),
    aqlMinor: aql("minor"),
    defects: z.array(defectLineSchema).max(50).default([]),
    correctiveActions: z.string().trim().max(3000).optional().transform((v) => v || undefined),
    notes: z.string().trim().max(3000).optional().transform((v) => v || undefined),
  })
  .refine((d) => d.sampleSize <= d.batchSize, { path: ["sampleSize"], message: "Units inspected cannot exceed the batch size." })
  .refine((d) => d.inspectionDate <= new Date(Date.now() + 24 * 60 * 60 * 1000), { path: ["inspectionDate"], message: "The inspection date cannot be in the future." });

export type QcReportInput = z.infer<typeof qcReportSchema>;

export const evidenceNoteSchema = z.object({ note: z.string().trim().max(500).optional().transform((v) => v || undefined) });

export const shipmentSchema = z.object({
  carrier: z.string().trim().min(2, "Enter the carrier or forwarder.").max(100),
  trackingNumber: z.string().trim().min(3, "Enter the tracking or bill-of-lading number.").max(100),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message.").max(4000, "Keep messages under 4,000 characters."),
  milestoneId: z.string().trim().optional().transform((v) => v || undefined),
});

export const disputeSchema = z.object({
  orderId: z.string().trim().optional().transform((v) => v || undefined),
  projectId: z.string().trim().optional().transform((v) => v || undefined),
  category: z.enum(["QUALITY", "DELIVERY", "PAYMENT", "COMMUNICATION", "OTHER"], { errorMap: () => ({ message: "Choose a category." }) }),
  subject: z.string().trim().min(5, "Enter a subject (at least 5 characters).").max(150),
  description: z.string().trim().min(20, "Describe the problem in at least 20 characters.").max(5000),
});

export const disputeUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  adminNote: z.string().trim().max(3000).optional().transform((v) => v || undefined),
  resolution: z.string().trim().max(3000).optional().transform((v) => v || undefined),
}).refine((d) => !["RESOLVED", "CLOSED"].includes(d.status) || (d.resolution && d.resolution.length >= 5), {
  path: ["resolution"],
  message: "Record the resolution before resolving or closing.",
});

export const paymentScheduleSchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(80),
        percentage: z.number().gt(0, "Each share must be above 0%.").max(100),
        triggerStage: z.enum(["FABRIC_SOURCING", "SAMPLING", "CUTTING", "STITCHING", "FINISHING", "QUALITY_CONTROL", "SHIPPING", "DELIVERY"]),
      }),
    )
    .min(1)
    .max(8)
    .refine((items) => Math.abs(items.reduce((s, i) => s + i.percentage, 0) - 100) < 1e-9, "Shares must add up to 100%."),
});

export const reasonSchema = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(1000) });
