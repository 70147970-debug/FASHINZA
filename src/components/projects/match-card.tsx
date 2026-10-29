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
            <dd className="tabular text-xs text-ink-muted">
              <span className="font-semibold text-ink">{(b.score * b.weight).toFixed(1)}</span> / {b.weight}
            </dd>
            <dd className="col-span-2">
              <span className="mt-1.5 block h-1 overflow-hidden rounded-xs bg-line" aria-hidden>
                <span className={cn("block h-full rounded-xs", pct >= 50 ? "bg-accent" : "bg-warning")} style={{ width: `${pct}%` }} />
              </span>
              <span className="mt-1 block text-xs leading-4 text-ink-muted">{b.note}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

const RING = {
  sm: { box: 36, stroke: 2.5, text: "text-[13px]" },
  md: { box: 48, stroke: 3, text: "text-base" },
  lg: { box: 68, stroke: 3, text: "text-[22px]" },
};

/** Circular score (0–100): a thin terracotta arc on a hairline track, Fraunces numeral in the middle. */
export function ScoreRing({ score, size = "md" }: { score: number; size?: keyof typeof RING }) {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const { box, stroke, text } = RING[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: box, height: box }}
      role="img"
      aria-label={`Match score ${pct} out of 100`}
    >
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
          className="stroke-accent"
        />
      </svg>
      <span className={cn("tabular relative font-display font-medium leading-none tracking-[-0.02em] text-ink", text)}>{pct}</span>
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
    <article className="flex min-w-0 flex-col rounded-lg border border-line bg-surface p-5 transition-colors duration-150 hover:border-line-strong">
      <div className="flex items-start gap-3">
        <Avatar name={name} shape="square" tone="neutral" size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-1.5 font-display text-[17px] font-medium leading-6 text-ink">
            {name}
            {p?.verificationStatus === "VERIFIED" && <BadgeCheck className="size-4 text-success" aria-label="Verified factory" />}
          </h3>
          {p && (
            <p className="mt-0.5 flex items-center gap-1 text-xs leading-5 text-ink-muted">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{p.city}, {p.country}</span>
            </p>
          )}
        </div>
        <ScoreRing score={Number(m.score)} />
      </div>
      {p && (
        <dl className="mt-4 grid grid-cols-3 divide-x divide-line-subtle border-y border-line py-3 text-xs">
          <div className="min-w-0 pr-2"><dt className="text-ink-muted">MOQ</dt><dd className="tabular mt-0.5 text-[13px] font-medium text-ink">{formatNumber(p.minOrderQuantity)}</dd></div>
          <div className="min-w-0 px-2"><dt className="text-ink-muted">Capacity / mo</dt><dd className="tabular mt-0.5 text-[13px] font-medium text-ink">{formatNumber(p.maxMonthlyCapacity)}</dd></div>
          <div className="min-w-0 pl-2"><dt className="text-ink-muted">Lead time</dt><dd className="tabular mt-0.5 text-[13px] font-medium text-ink">{p.typicalLeadTimeDays} days</dd></div>
        </dl>
      )}
      {p && p.certifications.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">{p.certifications.map((c) => <Badge key={c} tone="success">{c} · verified</Badge>)}</div>
      )}
      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm text-[13px] font-medium text-accent-strong hover:underline hover:underline-offset-4 [&::-webkit-details-marker]:hidden">
          Why this factory matched
          <ChevronDown className="size-3.5 transition-transform duration-150 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-3 rounded-md border border-line-subtle bg-surface-muted p-3.5"><ScoreBreakdownView breakdown={m.breakdown} /></div>
      </details>
      {m.quoteStatus && (
        <p className="mt-auto pt-3 text-xs text-ink-muted">
          Quotation: <span className="font-medium text-ink">{m.quoteStatus}</span>
        </p>
      )}
    </article>
  );
}
