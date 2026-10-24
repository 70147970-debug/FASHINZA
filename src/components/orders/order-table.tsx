import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/app/primitives";
import { ORDER_STATUS } from "@/lib/labels";
import { STAGES, stageLabel } from "@/lib/workflow";
import { formatDate } from "@/lib/format";
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

function delayed(o: Row) {
  if (["DELIVERED", "CANCELLED"].includes(o.status)) return false;
  return o.milestones.some((m) => m.isDelayed && !m.completedAt) || o.expectedCompletionDate < new Date();
}

/** Orders as cards on phones and a table from tablet width, with stage progress. */
export function OrderTable({ items, counterpart }: { items: Row[]; counterpart: "brand" | "factory" | "both" }) {
  const party = (o: Row) =>
    counterpart === "brand" ? o.brand.brandProfile?.companyName : counterpart === "factory" ? o.manufacturer.manufacturerProfile?.businessName : `${o.brand.brandProfile?.companyName ?? "Brand"} → ${o.manufacturer.manufacturerProfile?.businessName ?? "Factory"}`;
  const bar = (o: Row) => (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-navy-50" role="img" aria-label={`${progress(o)} of ${STAGES.length} stages complete`}>
        <div className="h-full rounded-full bg-teal" style={{ width: `${(progress(o) / STAGES.length) * 100}%` }} />
      </div>
      <span className="tabular text-xs text-muted">{progress(o)}/{STAGES.length}</span>
    </div>
  );
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {items.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="block rounded-lg border border-line bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-navy">{o.project.name}</span>
                <StatusBadge map={ORDER_STATUS} value={o.status} />
              </div>
              <p className="mt-1 text-xs text-muted">{o.reference} · {party(o)}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                {bar(o)}
                {delayed(o) && <span className="flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle className="size-3.5" aria-hidden />Delayed</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Order</th>
              <th scope="col" className="px-4 py-3 font-medium">{counterpart === "brand" ? "Brand" : counterpart === "factory" ? "Factory" : "Parties"}</th>
              <th scope="col" className="px-4 py-3 font-medium">Stage</th>
              <th scope="col" className="px-4 py-3 font-medium">Progress</th>
              <th scope="col" className="px-4 py-3 font-medium">Due</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((o) => (
              <tr key={o.id} className="hover:bg-canvas">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-medium text-navy hover:underline">{o.project.name}</Link>
                  <p className="text-xs text-muted">{o.reference}</p>
                </td>
                <td className="px-4 py-3">{party(o)}</td>
                <td className="px-4 py-3">{["DELIVERED", "CANCELLED"].includes(o.status) ? "—" : stageLabel(o.currentStage)}</td>
                <td className="px-4 py-3">{bar(o)}</td>
                <td className="px-4 py-3">
                  {formatDate(o.expectedCompletionDate)}
                  {delayed(o) && <span className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-danger"><AlertTriangle className="size-3" aria-hidden />Delayed</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge map={ORDER_STATUS} value={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
