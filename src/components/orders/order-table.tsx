import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DataTable, MobileCard, MobileCardList, ProgressBar, StatusBadge } from "@/components/app/primitives";
import { ORDER_STATUS } from "@/lib/labels";
import { STAGES, stageLabel } from "@/lib/workflow";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MilestoneStage } from "@/generated/prisma/enums";

type Row = {
  id: string;
  reference: string;
  status: string;
  currentStage: MilestoneStage;
  expectedCompletionDate: Date;
  project: { name: string };
  brand: { brandProfile: { companyName: string } | null };
  manufacturer: { manufacturerProfile: { businessName: string } | null };
  milestones: { stage: MilestoneStage; status: string; isDelayed: boolean; completedAt: Date | null }[];
};

function progress(o: Row) {
  return o.milestones.filter((m) => m.status === "COMPLETED").length;
}

function isClosed(o: Row) {
  return ["DELIVERED", "CANCELLED"].includes(o.status);
}

function delayed(o: Row) {
  if (isClosed(o)) return false;
  return o.milestones.some((m) => m.isDelayed && !m.completedAt) || o.expectedCompletionDate < new Date();
}

function DelayedFlag() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-strong">
      <AlertTriangle className="size-3.5" aria-hidden />
      Delayed
    </span>
  );
}

function Stage({ o }: { o: Row }) {
  const done = progress(o);
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[13px] text-ink">{o.status === "DELIVERED" ? "All stages complete" : isClosed(o) ? `Stopped at ${stageLabel(o.currentStage).toLowerCase()}` : stageLabel(o.currentStage)}</span>
      <span className="mt-1.5 flex items-center gap-2">
        <ProgressBar value={done} max={STAGES.length} label={`${done} of ${STAGES.length} stages complete`} tone={delayed(o) ? "warning" : o.status === "DELIVERED" ? "success" : "ink"} className="w-24" />
        <span className="tabular text-xs text-ink-muted">
          {done}/{STAGES.length}
        </span>
      </span>
    </span>
  );
}

/**
 * Orders as a table from tablet width and as stacked cards on phones (only one is in the accessibility tree),
 * with stage progress and delay flags. Delayed open orders get a warning edge so they stand out in long lists.
 */
export function OrderTable({ items, counterpart }: { items: Row[]; counterpart: "brand" | "factory" | "both" }) {
  const party = (o: Row) =>
    counterpart === "brand"
      ? o.brand.brandProfile?.companyName
      : counterpart === "factory"
        ? o.manufacturer.manufacturerProfile?.businessName
        : `${o.brand.brandProfile?.companyName ?? "Brand"} → ${o.manufacturer.manufacturerProfile?.businessName ?? "Factory"}`;

  const cards = (
    <MobileCardList>
      {items.map((o) => (
        <MobileCard
          key={o.id}
          href={`/orders/${o.id}`}
          title={o.project.name}
          badge={<StatusBadge map={ORDER_STATUS} value={o.status} />}
          meta={
            <>
              <span className="tabular">{o.reference}</span> · {party(o)}
            </>
          }
        >
          <span className="flex items-end justify-between gap-3">
            <Stage o={o} />
            <span className="shrink-0 text-right text-xs text-ink-muted">
              <span className="block">Due {formatDate(o.expectedCompletionDate)}</span>
              {delayed(o) && <DelayedFlag />}
            </span>
          </span>
        </MobileCard>
      ))}
    </MobileCardList>
  );

  return (
    <DataTable label="Orders" cards={cards}>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">{counterpart === "brand" ? "Brand" : counterpart === "factory" ? "Factory" : "Parties"}</th>
            <th scope="col">Stage</th>
            <th scope="col">Due</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => {
            const late = delayed(o);
            return (
              <tr key={o.id} className={cn(late && "bg-danger-soft/40")}>
                <td className={cn("relative", late && "shadow-[inset_2px_0_0_var(--color-danger)]")}>
                  <Link href={`/orders/${o.id}`} className="cell-primary rounded-sm">
                    {o.project.name}
                  </Link>
                  <p className="tabular mt-0.5 text-xs text-ink-muted">{o.reference}</p>
                </td>
                <td className="max-w-56 text-[13px]">{party(o)}</td>
                <td>
                  <Stage o={o} />
                </td>
                <td className="whitespace-nowrap">
                  <p className={cn("tabular text-[13px]", late ? "font-medium text-danger-strong" : "text-ink")}>{formatDate(o.expectedCompletionDate)}</p>
                  {late && <DelayedFlag />}
                </td>
                <td>
                  <StatusBadge map={ORDER_STATUS} value={o.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataTable>
  );
}
