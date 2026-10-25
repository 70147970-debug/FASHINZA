import { AlertTriangle, Check, ChevronDown, MessageSquare } from "lucide-react";
import type { MilestoneStage } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { FileThumb, dateRange } from "@/components/orders/order-parts";
import { MILESTONE_STATUS } from "@/lib/labels";
import { STAGE_BY_KEY, daysOverdue } from "@/lib/workflow";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TrackerMilestone = {
  id: string;
  stage: MilestoneStage;
  status: string;
  responsibleParty: string;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  isDelayed: boolean;
  notes: string | null;
  evidence: { id: string; fileKey: string; fileName: string; mimeType: string; note: string | null; createdAt: Date }[];
  commentCount: number;
};


const party = (p: string) => (p === "BRAND" ? "Brand" : "Manufacturer");

function Evidence({ m, size = "sm" }: { m: TrackerMilestone; size?: "sm" | "md" }) {
  if (m.evidence.length === 0) return null;
  const def = STAGE_BY_KEY[m.stage];
  return (
    <ul className="mt-2.5 flex flex-wrap gap-2" aria-label="Evidence files">
      {m.evidence.map((e) => (
        <li key={e.id}>
          <FileThumb fileKey={e.fileKey} fileName={e.fileName} mimeType={e.mimeType} alt={e.note ?? `Evidence for ${def.label}`} title={e.note ?? e.fileName} size={size} />
        </li>
      ))}
    </ul>
  );
}

function Comments({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <a href="#messages" className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-teal-700 hover:underline">
      <MessageSquare className="size-3.5" aria-hidden />
      {count} comment{count === 1 ? "" : "s"}
    </a>
  );
}

/** Completed stage: one compact row (planned vs actual, late flag, notes, evidence). */
function DoneRow({ m }: { m: TrackerMilestone }) {
  const def = STAGE_BY_KEY[m.stage];
  return (
    <li className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal text-white" aria-hidden>
        <Check className="size-3" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 className="text-sm font-medium text-ink">
            <span className="tabular text-muted">{def.sequence}.</span> {def.label}
          </h3>
          <p className="tabular text-xs text-muted">
            Completed {formatDate(m.completedAt)}
            {m.isDelayed && <span className="font-medium text-warning-700"> · finished late</span>}
          </p>
        </div>
        <p className="tabular mt-0.5 text-xs text-muted">
          Planned {dateRange(m.plannedStart, m.plannedEnd)}
          {m.startedAt && <> · started {formatDate(m.startedAt)}</>}
        </p>
        {m.notes && <p className="mt-1.5 text-[13px] leading-5 text-ink">{m.notes}</p>}
        <Evidence m={m} />
        <Comments count={m.commentCount} />
      </div>
    </li>
  );
}

/** Upcoming stage: muted compact row with the planned window. */
function UpcomingRow({ m }: { m: TrackerMilestone }) {
  const def = STAGE_BY_KEY[m.stage];
  return (
    <li className="flex gap-3 py-3 last:pb-0">
      <span className="tabular mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-line-strong bg-white text-[10px] font-semibold text-muted" aria-hidden>
        {def.sequence}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-sm font-medium text-muted">
          <span className="sr-only">{def.sequence}. </span>
          {def.label}
        </h3>
        <p className="tabular text-xs text-muted">
          {dateRange(m.plannedStart, m.plannedEnd)} · {party(m.responsibleParty)}
        </p>
      </div>
    </li>
  );
}

/** The stage in progress: emphasised card with facts, evidence and the actions for whoever acts next. */
function CurrentStage({ m, action }: { m: TrackerMilestone; action: React.ReactNode }) {
  const def = STAGE_BY_KEY[m.stage];
  const overdue = daysOverdue(m.plannedEnd, m.completedAt);
  const late = m.isDelayed || overdue > 0;
  return (
    <li
      aria-current="step"
      className={cn(
        "relative overflow-hidden rounded-lg border bg-white shadow-card",
        late ? "border-warning-100" : "border-line",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", late ? "bg-warning" : "bg-teal")} aria-hidden />
      <div className="px-4 py-4 sm:px-5">
        <p className={cn("label-caps", late ? "text-warning-700" : "text-teal-700")}>Current stage · {def.sequence} of 8</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="font-display text-lg font-semibold leading-7 text-navy">{def.label}</h3>
          <StatusBadge map={MILESTONE_STATUS} value={m.status} />
          {late && (
            <Badge tone="warning">
              <AlertTriangle className="size-3" aria-hidden />
              {overdue > 0 ? `${overdue} day${overdue === 1 ? "" : "s"} overdue` : "Delayed"}
            </Badge>
          )}
        </div>
        <dl className="tabular mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="min-w-0">
            <dt className="text-xs text-muted">Planned</dt>
            <dd className="mt-0.5 text-ink">
              {dateRange(m.plannedStart, m.plannedEnd)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">Started</dt>
            <dd className="mt-0.5 text-ink">{formatDate(m.startedAt)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">Due</dt>
            <dd className={cn("mt-0.5", late ? "font-medium text-warning-700" : "text-ink")}>{formatDate(m.plannedEnd)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">Responsible</dt>
            <dd className="mt-0.5 text-ink">{party(m.responsibleParty)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[13px] leading-5 text-muted">
          <span className="font-medium text-ink">Required:</span> {def.requirement}
        </p>
        {m.notes && <p className="mt-1.5 text-[13px] leading-5 text-ink">{m.notes}</p>}
        <Evidence m={m} size="md" />
        <Comments count={m.commentCount} />
      </div>
      {action && <div className="space-y-4 border-t border-line bg-surface-muted/60 px-4 py-4 sm:px-5">{action}</div>}
    </li>
  );
}

/**
 * Production milestones. While an order is open the stage in progress comes first (with its actions), the
 * completed stages fold into a "history" disclosure and upcoming stages follow as compact rows. Closed orders
 * show the full history. Only the current stage carries aria-current="step".
 * `actionFor` renders the controls for the current stage (only the server decides who sees which controls;
 * the services enforce them again).
 */
export function MilestoneTracker({
  milestones,
  currentStage,
  closed,
  actionFor,
}: {
  milestones: TrackerMilestone[];
  currentStage: MilestoneStage;
  closed: boolean;
  actionFor: (m: TrackerMilestone) => React.ReactNode;
}) {
  const currentIndex = closed ? -1 : milestones.findIndex((m) => m.stage === currentStage);

  if (currentIndex < 0) {
    return (
      <ol className="divide-y divide-line-subtle">
        {milestones.map((m) => (m.status === "COMPLETED" ? <DoneRow key={m.id} m={m} /> : <UpcomingRow key={m.id} m={m} />))}
      </ol>
    );
  }

  const before = milestones.slice(0, currentIndex);
  const current = milestones[currentIndex];
  const after = milestones.slice(currentIndex + 1);
  const late = before.filter((m) => m.isDelayed).length;

  return (
    <div className="space-y-4">
      {before.length > 0 && (
        <details className="group rounded-md border border-line">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-3.5 py-2.5 text-[13px] transition-colors duration-150 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-teal text-white" aria-hidden>
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="font-medium text-ink">
                {before.length} completed stage{before.length === 1 ? "" : "s"}
              </span>
              {late > 0 && <span className="text-xs text-warning-700">· {late} finished late</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-teal-700">
              <span className="group-open:hidden">Show history</span>
              <span className="hidden group-open:inline">Hide history</span>
              <ChevronDown className="size-4 transition-transform duration-150 group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <ol className="divide-y divide-line-subtle border-t border-line px-3.5 py-3.5">
            {before.map((m) => (m.status === "COMPLETED" ? <DoneRow key={m.id} m={m} /> : <UpcomingRow key={m.id} m={m} />))}
          </ol>
        </details>
      )}
      <ol start={currentIndex + 1} className="space-y-0">
        <CurrentStage m={current} action={actionFor(current)} />
      </ol>

      {after.length > 0 && (
        <div>
          <p className="label-caps mb-1 text-muted">Up next</p>
          <ol start={currentIndex + 2} className="divide-y divide-line-subtle">
            {after.map((m) => (m.status === "COMPLETED" ? <DoneRow key={m.id} m={m} /> : <UpcomingRow key={m.id} m={m} />))}
          </ol>
        </div>
      )}

    </div>
  );
}
