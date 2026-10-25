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

  type Row = { label: string; render: (q: QuoteRow) => React.ReactNode; strong?: boolean };
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Summary",
      rows: [
        { label: "Total (incl. tax)", strong: true, render: (q) => formatMoney(q.totalAmount, q.currency) },
        { label: "Effective price / unit", render: (q) => formatMoney(perUnit(q), q.currency) },
        { label: "Quoted quantity", render: (q) => formatNumber(q.quantity) },
        { label: "Minimum quantity", render: (q) => formatNumber(q.minQuantity) },
        { label: "Production time", render: (q) => `${q.productionDays} days` },
      ],
    },
    {
      title: "Cost breakdown",
      rows: [
        { label: "Making cost / unit", render: (q) => formatMoney(q.unitPrice, q.currency) },
        { label: "Fabric / unit", render: (q) => formatMoney(q.fabricCostPerUnit, q.currency) },
        { label: "Finishing / unit", render: (q) => formatMoney(q.finishingCostPerUnit, q.currency) },
        { label: "Packaging / unit", render: (q) => formatMoney(q.packagingCostPerUnit, q.currency) },
        { label: "Sampling charge", render: (q) => formatMoney(q.samplingCost ?? 0, q.currency) },
        { label: "Logistics estimate", render: (q) => formatMoney(q.logisticsCost, q.currency) },
        { label: "Tax", render: (q) => `${Number(q.taxPercent)}% · ${formatMoney(q.taxAmount, q.currency)}` },
      ],
    },
    { title: "Terms", rows: [{ label: "Valid until", render: (q) => formatDate(q.validUntil) }] },
  ];
  const highlight = (q: QuoteRow) => (q.id === lowest || q.id === fastest ? "bg-teal-50/40" : "");
  const rowHead = "sticky left-0 z-10 border-t border-line-subtle bg-white py-2.5 pl-4 pr-3 text-left text-[13px] font-normal text-muted sm:pl-5";
  const cell = "border-l border-t border-line-subtle px-4 py-2.5";

  return (
    <div className="relative">
      {quotes.length > 1 && <p className="border-b border-line-subtle px-4 py-2 text-xs text-muted md:hidden">Scroll sideways to compare factories.</p>}
      <div className="overflow-x-auto" role="region" aria-label="Quotation comparison, scrollable" tabIndex={0}>
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">Quotation comparison</caption>
          <thead>
            <tr>
              <th scope="col" className="label-caps sticky left-0 z-10 w-40 min-w-36 bg-surface-muted py-3 pl-4 pr-3 align-bottom text-muted sm:w-48 sm:pl-5">Factory</th>
              {quotes.map((q) => {
                const f = q.manufacturer.manufacturerProfile;
                return (
                  <th key={q.id} scope="col" className={`min-w-52 border-l border-line-subtle bg-surface-muted px-4 py-3 align-bottom font-normal`}>
                    <span className="flex items-center gap-1 text-sm font-semibold text-navy">
                      {f?.businessName ?? "Factory"}
                      {f?.verificationStatus === "VERIFIED" && <BadgeCheck className="size-4 shrink-0 text-success" aria-label="Verified" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{f ? `${f.city}, ${f.country}` : ""} · v{q.version}</span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      <StatusBadge map={QUOTATION_STATUS} value={q.status} />
                      {q.id === lowest && <Badge tone="success">Lowest total</Badge>}
                      {q.id === fastest && <Badge tone="accent">Fastest</Badge>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr>
                <th scope="rowgroup" className="label-caps sticky left-0 z-10 border-t border-line bg-white pb-1.5 pl-4 pr-3 pt-4 text-left text-slate-blue sm:pl-5">{g.title}</th>
                <td colSpan={quotes.length} className="border-t border-line" />
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className={rowHead}>{r.label}</th>
                  {quotes.map((q) => (
                    <td key={q.id} className={`tabular ${cell} ${highlight(q)} ${r.strong ? "font-display text-base font-semibold text-navy" : "text-ink"}`}>{r.render(q)}</td>
                  ))}
                </tr>
              ))}
              {g.title === "Terms" && (
                <tr>
                  <th scope="row" className={`${rowHead} align-top`}>Terms</th>
                  {quotes.map((q) => (
                    <td key={q.id} className={`${cell} ${highlight(q)} align-top text-xs leading-5 text-ink`}>
                      {q.notes ?? <span className="text-muted">—</span>}
                      {q.status === "REVISION_REQUESTED" && q.revisionRequest && <p className="mt-2 rounded-md bg-warning-50 px-2 py-1.5 text-warning-700">You asked: {q.revisionRequest}</p>}
                      {q.revisions.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-medium text-teal-700 hover:underline hover:underline-offset-4">History ({q.revisions.length} earlier version{q.revisions.length === 1 ? "" : "s"})</summary>
                          <ul className="mt-1.5 space-y-1 text-muted">
                            {q.revisions.map((r) => {
                              const s = (r.snapshot ?? {}) as { totalAmount?: string; productionDays?: number; quantity?: number };
                              return (
                                <li key={r.version} className="tabular">
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
              )}
            </tbody>
          ))}
          {canDecide && (
            <tbody>
              <tr>
                <th scope="row" className={`${rowHead} border-line bg-surface-muted py-3.5`}>Decision</th>
                {quotes.map((q) => (
                  <td key={q.id} className="border-l border-t border-line bg-surface-muted px-4 py-3.5 align-top">
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
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
