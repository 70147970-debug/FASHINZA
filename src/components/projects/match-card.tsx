import { BadgeCheck, MapPin } from "lucide-react";
import type { ScoreBreakdown } from "@/lib/matching";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

const LABELS: Record<string, string> = { capability: "Processes", fabric: "Fabric expertise", capacity: "Capacity", leadTime: "Lead time", location: "Location", performance: "Track record" };

export function ScoreBreakdownView({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <dl className="space-y-2">
      {Object.entries(breakdown).map(([k, b]) => (
        <div key={k}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="font-medium text-ink">{LABELS[k] ?? k}</dt>
            <dd className="tabular text-muted">{(b.score * b.weight).toFixed(1)} / {b.weight}</dd>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-navy-50" aria-hidden>
            <div className="h-full rounded-full bg-teal" style={{ width: `${Math.round(b.score * 100)}%` }} />
          </div>
          <p className="mt-0.5 text-xs text-muted">{b.note}</p>
        </div>
      ))}
    </dl>
  );
}

export type MatchView = {
  id: string;
  score: string;
  breakdown: ScoreBreakdown;
  profile: {
    businessName: string; city: string; country: string; verificationStatus: string; minOrderQuantity: number; maxMonthlyCapacity: number; typicalLeadTimeDays: number;
    certifications: string[];
  } | null;
  quoteStatus?: string;
};

export function MatchCard({ m }: { m: MatchView }) {
  const p = m.profile;
  return (
    <article className="rounded-lg border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-navy">
            {p?.businessName ?? "Factory"}
            {p?.verificationStatus === "VERIFIED" && <BadgeCheck className="size-4 text-success" aria-label="Verified factory" />}
          </h3>
          {p && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" aria-hidden />{p.city}, {p.country}</p>}
        </div>
        <div className="text-right">
          <p className="tabular font-display text-xl font-semibold text-navy">{Number(m.score).toFixed(0)}<span className="text-xs font-normal text-muted">/100</span></p>
          <p className="text-2xs text-muted">match score</p>
        </div>
      </div>
      {p && (
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-canvas p-2 text-xs">
          <div><dt className="text-muted">MOQ</dt><dd className="tabular font-medium">{formatNumber(p.minOrderQuantity)}</dd></div>
          <div><dt className="text-muted">Capacity / mo</dt><dd className="tabular font-medium">{formatNumber(p.maxMonthlyCapacity)}</dd></div>
          <div><dt className="text-muted">Lead time</dt><dd className="tabular font-medium">{p.typicalLeadTimeDays} days</dd></div>
        </dl>
      )}
      {p && p.certifications.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">{p.certifications.map((c) => <Badge key={c} tone="success">{c} · verified</Badge>)}</div>
      )}
      <details className="group mt-3">
        <summary className="cursor-pointer text-xs font-medium text-teal-700 hover:underline">Why this factory matched</summary>
        <div className="mt-3"><ScoreBreakdownView breakdown={m.breakdown} /></div>
      </details>
      {m.quoteStatus && <p className="mt-3 text-xs text-muted">Quotation: {m.quoteStatus}</p>}
    </article>
  );
}
