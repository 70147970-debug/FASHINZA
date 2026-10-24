import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/primitives";
import { QUOTATION_STATUS } from "@/lib/labels";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { QuotationDecisionButtons } from "./project-buttons";

type Money = { toString(): string; toFixed(n: number): string };
export type QuoteRow = {
  id: string;
  status: string;
  version: number;
  quantity: number;
  unitPrice: Money;
  fabricCostPerUnit: Money;
  finishingCostPerUnit: Money;
  packagingCostPerUnit: Money;
  samplingCost: Money | null;
  logisticsCost: Money;
  taxPercent: Money;
  taxAmount: Money;
  subtotal: Money;
  totalAmount: Money;
  currency: string;
  minQuantity: number;
  productionDays: number;
  validUntil: Date;
  notes: string | null;
  revisionRequest: string | null;
  submittedAt: Date | null;
  manufacturer: { manufacturerProfile: { businessName: string; city: string; country: string; verificationStatus: string } | null };
  revisions: { version: number; createdAt: Date; snapshot: unknown }[];
};

const OPEN = ["SUBMITTED", "REVISION_REQUESTED"];

/**
 * Side-by-side comparison. Columns are quotations so each factory's full cost breakdown reads
 * top to bottom; the lowest total and the shortest production time are highlighted.
 */
export function QuotationCompare({ quotes, projectId, canDecide }: { quotes: QuoteRow[]; projectId: string; canDecide: boolean }) {
  const open = quotes.filter((q) => OPEN.includes(q.status));
  const lowest = open.length > 1 ? open.reduce((a, b) => (Number(a.totalAmount) <= Number(b.totalAmount) ? a : b)).id : null;
  const fastest = open.length > 1 ? open.reduce((a, b) => (a.productionDays <= b.productionDays ? a : b)).id : null;
  const perUnit = (q: QuoteRow) => Number(q.totalAmount) / q.quantity;

  const rows: { label: string; render: (q: QuoteRow) => React.ReactNode; strong?: boolean }[] = [
    { label: "Total (incl. tax)", strong: true, render: (q) => formatMoney(q.totalAmount, q.currency) },
    { label: "Effective price / unit", render: (q) => formatMoney(perUnit(q), q.currency) },
    { label: "Quoted quantity", render: (q) => formatNumber(q.quantity) },
    { label: "Minimum quantity", render: (q) => formatNumber(q.minQuantity) },
    { label: "Production time", render: (q) => `${q.productionDays} days` },
    { label: "Making cost / unit", render: (q) => formatMoney(q.unitPrice, q.currency) },
    { label: "Fabric / unit", render: (q) => formatMoney(q.fabricCostPerUnit, q.currency) },
    { label: "Finishing / unit", render: (q) => formatMoney(q.finishingCostPerUnit, q.currency) },
    { label: "Packaging / unit", render: (q) => formatMoney(q.packagingCostPerUnit, q.currency) },
    { label: "Sampling charge", render: (q) => formatMoney(q.samplingCost ?? 0, q.currency) },
    { label: "Logistics estimate", render: (q) => formatMoney(q.logisticsCost, q.currency) },
    { label: "Tax", render: (q) => `${Number(q.taxPercent)}% · ${formatMoney(q.taxAmount, q.currency)}` },
    { label: "Valid until", render: (q) => formatDate(q.validUntil) },
  ];

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Quotation comparison</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-44 bg-white pb-3 pr-3 align-bottom text-xs font-medium text-muted">Factory</th>
            {quotes.map((q) => {
              const f = q.manufacturer.manufacturerProfile;
              return (
                <th key={q.id} scope="col" className="min-w-48 border-l border-line px-3 pb-3 align-bottom font-normal">
                  <span className="flex items-center gap-1 font-semibold text-navy">
                    {f?.businessName ?? "Factory"}
                    {f?.verificationStatus === "VERIFIED" && <BadgeCheck className="size-4 text-success" aria-label="Verified" />}
                  </span>
                  <span className="block text-xs text-muted">{f ? `${f.city}, ${f.country}` : ""} · v{q.version}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <StatusBadge map={QUOTATION_STATUS} value={q.status} />
                    {q.id === lowest && <Badge tone="success">Lowest total</Badge>}
                    {q.id === fastest && <Badge tone="teal">Fastest</Badge>}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="sticky left-0 z-10 border-t border-line bg-white py-2 pr-3 text-xs font-medium text-muted">{r.label}</th>
              {quotes.map((q) => (
                <td key={q.id} className={`tabular border-l border-t border-line px-3 py-2 ${r.strong ? "font-semibold text-navy" : ""}`}>{r.render(q)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="sticky left-0 z-10 border-t border-line bg-white py-2 pr-3 align-top text-xs font-medium text-muted">Terms</th>
            {quotes.map((q) => (
              <td key={q.id} className="border-l border-t border-line px-3 py-2 align-top text-xs text-ink">
                {q.notes ?? <span className="text-muted">—</span>}
                {q.status === "REVISION_REQUESTED" && q.revisionRequest && <p className="mt-2 text-warning-700">You asked: {q.revisionRequest}</p>}
                {q.revisions.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-teal-700">History ({q.revisions.length} earlier version{q.revisions.length === 1 ? "" : "s"})</summary>
                    <ul className="mt-1 space-y-1 text-muted">
                      {q.revisions.map((r) => {
                        const s = (r.snapshot ?? {}) as { totalAmount?: string; productionDays?: number; quantity?: number };
                        return (
                          <li key={r.version}>
                            v{r.version} · {formatDate(r.createdAt)}: {s.totalAmount ? formatMoney(s.totalAmount, q.currency) : "—"}
                            {s.productionDays ? `, ${s.productionDays} days` : ""}{s.quantity ? `, ${formatNumber(s.quantity)} units` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </td>
            ))}
          </tr>
          {canDecide && (
            <tr>
              <th scope="row" className="sticky left-0 z-10 border-t border-line bg-white py-3 pr-3 text-xs font-medium text-muted">Decision</th>
              {quotes.map((q) => (
                <td key={q.id} className="border-l border-t border-line px-3 py-3 align-top">
                  {OPEN.includes(q.status) ? (
                    <QuotationDecisionButtons
                      quotationId={q.id}
                      projectId={projectId}
                      factory={q.manufacturer.manufacturerProfile?.businessName ?? "this factory"}
                      total={formatMoney(q.totalAmount, q.currency)}
                      canAccept={q.status === "SUBMITTED"}
                    />
                  ) : (
                    <span className="text-xs text-muted">No action</span>
                  )}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
