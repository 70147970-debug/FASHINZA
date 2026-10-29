import { ProgressBar } from "@/components/app/primitives";
import { cn } from "@/lib/utils";

/**
 * A project's place in the overall lifecycle, derived from its status alone (no extra queries):
 * brief → marketplace → order → production → delivery.
 */
const LIFECYCLE = ["DRAFT", "SUBMITTED", "QUOTING", "QUOTATION_ACCEPTED", "IN_PRODUCTION", "QUALITY_CHECK", "READY_TO_SHIP", "SHIPPED", "DELIVERED"] as const;
const PHASE: Record<string, string> = {
  DRAFT: "Briefing",
  SUBMITTED: "Matching",
  QUOTING: "Quoting",
  QUOTATION_ACCEPTED: "Order placed",
  IN_PRODUCTION: "Production",
  QUALITY_CHECK: "Quality check",
  READY_TO_SHIP: "Ready to ship",
  SHIPPED: "In transit",
  DELIVERED: "Complete",
  CANCELLED: "Cancelled",
};

export function lifecycleStep(status: string) {
  const i = LIFECYCLE.indexOf(status as (typeof LIFECYCLE)[number]);
  return { step: i < 0 ? 0 : i, total: LIFECYCLE.length - 1, phase: PHASE[status] ?? status };
}

/** Compact lifecycle bar with its phase label (e.g. "Quoting · 2 of 8"). */
export function ProjectProgress({ status, className }: { status: string; className?: string }) {
  const { step, total, phase } = lifecycleStep(status);
  const cancelled = status === "CANCELLED";
  return (
    <div className={cn("min-w-0", className)}>
      <ProgressBar
        value={cancelled ? 0 : step}
        max={total}
        label={cancelled ? "Project cancelled" : `${phase}: lifecycle step ${step} of ${total}`}
        tone={status === "DELIVERED" ? "success" : "ink"}
      />
      <p className="tabular mt-1.5 flex justify-between gap-2 text-xs leading-4 text-ink-muted">
        <span className="truncate">{phase}</span>
        {!cancelled && <span aria-hidden>{step}/{total}</span>}
      </p>
    </div>
  );
}
