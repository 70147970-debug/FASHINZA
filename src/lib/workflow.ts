import type { MilestoneStage, ResponsibleParty } from "@/generated/prisma/enums";

/**
 * Production stages in their fixed order.
 *
 * gate:
 *  - "evidence": the manufacturer completes the stage after uploading at least one evidence file.
 *  - "sample":   completes automatically when the brand approves a sample.
 *  - "qc":       completes automatically when the brand accepts a passing QC report.
 *  - "shipment": the manufacturer completes it by recording shipment and tracking details.
 *  - "delivery": the brand completes it by confirming delivery.
 */
export type StageGate = "evidence" | "sample" | "qc" | "shipment" | "delivery";

export type StageDefinition = {
  stage: MilestoneStage;
  label: string;
  party: ResponsibleParty;
  gate: StageGate;
  /** Share of the production duration used to plan this stage's dates. */
  weight: number;
  requirement: string;
};

export const STAGES: StageDefinition[] = [
  { stage: "FABRIC_SOURCING", label: "Fabric sourcing", party: "MANUFACTURER", gate: "evidence", weight: 0.15, requirement: "Fabric receipt, invoice or swatch photo" },
  { stage: "SAMPLING", label: "Sampling", party: "MANUFACTURER", gate: "sample", weight: 0.15, requirement: "A sample approved by the brand" },
  { stage: "CUTTING", label: "Cutting", party: "MANUFACTURER", gate: "evidence", weight: 0.1, requirement: "Photo of cut panels" },
  { stage: "STITCHING", label: "Stitching", party: "MANUFACTURER", gate: "evidence", weight: 0.3, requirement: "Photo of stitched garments on the line" },
  { stage: "FINISHING", label: "Finishing", party: "MANUFACTURER", gate: "evidence", weight: 0.1, requirement: "Photo of finished, labelled or packed garments" },
  { stage: "QUALITY_CONTROL", label: "Quality check", party: "MANUFACTURER", gate: "qc", weight: 0.05, requirement: "A passing QC report accepted by the brand" },
  { stage: "SHIPPING", label: "Logistics", party: "MANUFACTURER", gate: "shipment", weight: 0.15, requirement: "Carrier and tracking details" },
  { stage: "DELIVERY", label: "Delivery confirmation", party: "BRAND", gate: "delivery", weight: 0, requirement: "Brand confirms the goods were received" },
];

export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s, i) => [s.stage, { ...s, sequence: i + 1 }])) as Record<
  MilestoneStage,
  StageDefinition & { sequence: number }
>;

export function stageLabel(stage: MilestoneStage) {
  return STAGE_BY_KEY[stage].label;
}

export function nextStage(stage: MilestoneStage): MilestoneStage | null {
  const i = STAGES.findIndex((s) => s.stage === stage);
  return STAGES[i + 1]?.stage ?? null;
}

/** Where production restarts after a failed inspection. */
export const REWORK_STAGE: MilestoneStage = "STITCHING";

const DAY = 24 * 60 * 60 * 1000;

/** Planned start/end per stage, spreading the production duration by stage weight. */
export function planMilestoneDates(start: Date, totalDays: number) {
  let cursor = start.getTime();
  return STAGES.map((s) => {
    const plannedStart = new Date(cursor);
    cursor += Math.round(totalDays * s.weight) * DAY;
    return { stage: s.stage, plannedStart, plannedEnd: new Date(cursor) };
  });
}

/** Whole days a milestone is past its planned end (0 when on time or completed). */
export function daysOverdue(plannedEnd: Date | null, completedAt: Date | null, now = new Date()) {
  if (!plannedEnd || completedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - plannedEnd.getTime()) / DAY));
}

/**
 * Estimated delivery: the agreed date, pushed back by however many days the current
 * stage is overdue (the remaining stages are assumed to take their planned time).
 */
export function estimateDelivery(expected: Date, current: { plannedEnd: Date | null; completedAt: Date | null } | undefined, now = new Date()) {
  const slip = current ? daysOverdue(current.plannedEnd, current.completedAt, now) : 0;
  return new Date(expected.getTime() + slip * DAY);
}

export type PaymentScheduleItem = { label: string; percentage: number; triggerStage: MilestoneStage };

/** Illustrative default from the project proposal; brands can change it before the first payment. */
export const DEFAULT_PAYMENT_SCHEDULE: PaymentScheduleItem[] = [
  { label: "Sample approval", percentage: 30, triggerStage: "SAMPLING" },
  { label: "Post-production QC approval", percentage: 40, triggerStage: "QUALITY_CONTROL" },
  { label: "Delivery confirmation", percentage: 30, triggerStage: "DELIVERY" },
];

export const PAYMENT_DUE_DAYS = 7;
