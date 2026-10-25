import { BadgeCheck, ChevronDown, MapPin } from "lucide-react";
import type { ScoreBreakdown } from "@/lib/matching";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = { capability: "Processes", fabric: "Fabric expertise", capacity: "Capacity", leadTime: "Lead time", location: "Location", performance: "Track record" };

/** Per-criterion score bars with the rule's explanation (points earned / weight). */
export function ScoreBreakdownView({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <dl className="space-y-3.5">
      {Object.entries(breakdown).map(([k, b]) => {
        const pct = Math.round(b.score * 100);
        return (
          <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2">
            <dt className="text-[13px] font-medium text-ink">{LABELS[k] ?? k}</dt>
            <dd className="tabular text-xs text-muted">
              <span className="font-semibold text-navy">{(b.score * b.weight).toFixed(1)}</span> / {b.weight}
            </dd>
            <dd className="col-span-2">
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
                <span className={cn("block h-full rounded-full", pct >= 50 ? "bg-teal" : pct > 0 ? "bg-warning" : "bg-neutral-300")} style={{ width: `${pct}%` }} />
              </span>
              <span className="mt-1 block text-xs leading-4 text-muted">{b.note}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const RING = {
  sm: { outer: "size-9", inner: "size-7", text: "text-xs" },
  md: { outer: "size-12", inner: "size-[2.375rem]", text: "text-[15px]" },
  lg: { outer: "size-16", inner: "size-[3.25rem]", text: "text-lg" },
};

/** Circular score (0–100) drawn with a conic gradient from the theme tokens. */
export function ScoreRing({ score, size = "md" }: { score: number; size?: keyof typeof RING }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const r = RING[size];
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-full", r.outer)}
      style={{ background: `conic-gradient(var(--color-teal) ${pct}%, var(--color-neutral-100) 0)` }}
      role="img"
      aria-label={`Match score ${pct} out of 100`}
    >
      <span className={cn("grid place-items-center rounded-full bg-white", r.inner)}>
        <span className={cn("tabular font-display font-semibold leading-none text-navy", r.text)}>{pct}</span>
      </span>
    </span>
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
  const name = p?.businessName ?? "Factory";
  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar name={name} shape="square" tone="neutral" size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-5 text-navy">
            {name}
            {p?.verificationStatus === "VERIFIED" && <BadgeCheck className="size-4 text-success" aria-label="Verified factory" />}
          </h3>
          {p && (
            <p className="mt-0.5 flex items-center gap-1 text-xs leading-5 text-muted">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{p.city}, {p.country}</span>
            </p>
          )}
        </div>
        <ScoreRing score={Number(m.score)} />
      </div>
      {p && (
        <dl className="mt-4 grid grid-cols-3 divide-x divide-line-subtle border-y border-line-subtle py-2.5 text-xs">
          <div className="min-w-0 pr-2"><dt className="text-muted">MOQ</dt><dd className="tabular mt-0.5 text-[13px] font-medium text-ink">{formatNumber(p.minOrderQuantity)}</dd></div>
          <div className="min-w-0 px-2"><dt className="text-muted">Capacity / mo</dt><dd className="tabular mt-0.5 text-[13px] font-medium text-ink">{formatNumber(p.maxMonthlyCapacity)}</dd></div>
          <div className="min-w-0 pl-2"><dt className="text-muted">Lead time</dt><dd className="tabular mt-0.5 text-[13px] font-medium text-ink">{p.typicalLeadTimeDays} days</dd></div>
        </dl>
      )}
      {p && p.certifications.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">{p.certifications.map((c) => <Badge key={c} tone="success">{c} · verified</Badge>)}</div>
      )}
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm text-[13px] font-medium text-teal-700 hover:underline hover:underline-offset-4 [&::-webkit-details-marker]:hidden">
          Why this factory matched
          <ChevronDown className="size-3.5 transition-transform duration-150 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-3 rounded-md bg-surface-muted p-3"><ScoreBreakdownView breakdown={m.breakdown} /></div>
      </details>
      {m.quoteStatus && (
        <p className="mt-auto pt-3 text-xs text-muted">
          Quotation: <span className="font-medium text-ink">{m.quoteStatus}</span>
        </p>
      )}
    </article>
  );
}
