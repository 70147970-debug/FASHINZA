import { AlertTriangle, CheckCircle2, Circle, Clock, FileText, Hourglass, MessageSquare } from "lucide-react";
import type { MilestoneStage } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/app/primitives";
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

/**
 * Vertical production timeline. `actionFor` renders the controls for the current stage
 * (only the server decides who sees which controls; the services enforce them again).
 */
export function MilestoneTracker({ milestones, currentStage, closed, actionFor }: { milestones: TrackerMilestone[]; currentStage: MilestoneStage; closed: boolean; actionFor: (m: TrackerMilestone) => React.ReactNode }) {
  return (
    <ol className="space-y-0">
      {milestones.map((m, i) => {
        const def = STAGE_BY_KEY[m.stage];
        const isCurrent = !closed && m.stage === currentStage;
        const overdue = daysOverdue(m.plannedEnd, m.completedAt);
        const done = m.status === "COMPLETED";
        const Icon = done ? CheckCircle2 : isCurrent ? (m.status === "AWAITING_APPROVAL" ? Hourglass : Clock) : Circle;
        const action = isCurrent ? actionFor(m) : null;
        return (
          <li key={m.id} className="relative flex gap-3 pb-6 last:pb-0" aria-current={isCurrent ? "step" : undefined}>
            {i < milestones.length - 1 && <span className={cn("absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-0.5", done ? "bg-success/40" : "bg-line")} aria-hidden />}
            <Icon className={cn("relative mt-0.5 size-6 shrink-0 bg-white", done ? "text-success" : isCurrent ? "text-teal" : "text-line")} aria-hidden />
            <div className={cn("min-w-0 flex-1", isCurrent && "rounded-lg border border-teal/30 bg-teal-50/40 p-4")}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={cn("text-sm font-semibold", done || isCurrent ? "text-navy" : "text-muted")}>{def.sequence}. {def.label}</h3>
                <StatusBadge map={MILESTONE_STATUS} value={m.status} />
                {(m.isDelayed || overdue > 0) && !done && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle className="size-3.5" aria-hidden />{overdue > 0 ? `${overdue} day${overdue === 1 ? "" : "s"} overdue` : "Delayed"}</span>
                )}
                {done && m.isDelayed && <span className="text-xs text-muted">(finished late)</span>}
              </div>
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                <div><dt className="inline">Planned: </dt><dd className="inline">{formatDate(m.plannedStart)} – {formatDate(m.plannedEnd)}</dd></div>
                {m.startedAt && <div><dt className="inline">Started: </dt><dd className="inline">{formatDate(m.startedAt)}</dd></div>}
                {m.completedAt && <div><dt className="inline">Completed: </dt><dd className="inline">{formatDate(m.completedAt)}</dd></div>}
                <div><dt className="inline">Responsible: </dt><dd className="inline">{m.responsibleParty === "BRAND" ? "Brand" : "Manufacturer"}</dd></div>
              </dl>
              <p className="mt-1 text-xs text-muted">Required: {def.requirement}</p>
              {m.notes && <p className="mt-1 text-sm text-ink">{m.notes}</p>}
              {m.evidence.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {m.evidence.map((e) => (
                    <li key={e.id}>
                      <a href={`/api/files/${e.fileKey}`} target="_blank" rel="noopener" className="group block" title={e.note ?? e.fileName}>
                        {e.mimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- private, authorised file route; not optimisable by next/image
                          <img src={`/api/files/${e.fileKey}`} alt={e.note ?? `Evidence for ${def.label}`} loading="lazy" className="size-16 rounded-md border border-line object-cover group-hover:opacity-90" />
                        ) : (
                          <span className="flex h-16 w-28 items-center gap-1 rounded-md border border-line bg-white px-2 text-xs text-navy"><FileText className="size-4 shrink-0" aria-hidden /><span className="truncate">{e.fileName}</span></span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {m.commentCount > 0 && (
                <a href="#messages" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"><MessageSquare className="size-3.5" aria-hidden />{m.commentCount} comment{m.commentCount === 1 ? "" : "s"}</a>
              )}
              {action && <div className="mt-4 space-y-4 border-t border-teal/20 pt-4">{action}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
