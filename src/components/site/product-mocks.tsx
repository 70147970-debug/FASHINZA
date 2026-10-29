import { BadgeCheck, Camera, Check, ChevronRight, CircleDollarSign, Factory, MapPin, Minus, Ruler, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar, StageStepper, Timeline, type Step } from "@/components/app/primitives";
import { ExampleBadge, MockFrame } from "./marketing";
import { cn } from "@/lib/utils";

/*
 * Composed product-UI mocks for the marketing site. Every mock shows an "Example data" badge and a caption:
 * the names, figures and dates are illustrative, not real customers or orders.
 */

const CAPTION = "Illustrative example built from the product's own components. Names, figures and dates are not real.";

function MockCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("overflow-hidden rounded-lg border border-line-strong bg-surface", className)}>{children}</div>;
}

/** Fake app chrome: breadcrumb trail + example badge. */
function MockBar({ trail }: { trail: string[] }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
        <span className="mr-1 inline-flex shrink-0 items-baseline font-display text-[15px] font-medium leading-none tracking-[-0.02em] text-ink" aria-hidden>
          Fashinza<span className="ml-px size-[3px] rounded-full bg-accent" />
        </span>
        {trail.map((t, i) => (
          <span key={t} className={cn("flex min-w-0 items-center gap-1.5", i > 0 && "max-sm:hidden")}>
            <ChevronRight className="size-3 shrink-0 text-ink-subtle" aria-hidden />
            <span className={cn("truncate", i === trail.length - 1 && "text-ink")}>{t}</span>
          </span>
        ))}
      </div>
      <ExampleBadge />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 px-2.5 py-2.5 sm:px-4">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular mt-1 break-words font-display text-[15px] font-medium text-ink sm:text-base">{value}</dd>
    </div>
  );
}

/** 8 segments: done (ink), current (terracotta), upcoming (hairline). */
function SegmentBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1 rounded-xs", i < done ? "bg-primary" : i === done ? "bg-accent" : "bg-line-strong")} />
      ))}
    </div>
  );
}

/** Homepage hero: an order overview. */
export function OrderOverviewMock() {
  return (
    <MockFrame label="Example order overview with illustrative data" caption={CAPTION}>
      <div className="relative lg:pb-12 lg:pr-8">
        <MockCard>
          <MockBar trail={["Orders", "FZ-DEMO-0001"]} />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="label-caps text-ink-muted">Order · FZ-DEMO-0001</p>
                <p className="mt-1 font-display text-xl font-medium leading-7 tracking-[-0.015em] text-ink">Organic cotton crew-neck tee</p>
                <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-muted">
                  <Factory className="size-3.5" aria-hidden /> Example Knit Unit A · Lahore
                </p>
              </div>
              <Badge tone="info" dot>In production</Badge>
            </div>
            <dl className="mt-5 grid grid-cols-3 divide-x divide-line border-y border-line">
              <Fact label="Quantity" value="500 pcs" />
              <Fact label="Unit price" value="USD 6.40" />
              <Fact label="Due" value="12 Apr" />
            </dl>
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-medium text-ink">Stitching</span>
                <span className="tabular text-ink-muted">Stage 4 of 8</span>
              </div>
              <SegmentBar done={3} total={8} />
              <div className="mt-2 flex justify-between text-xs text-ink-muted">
                <span>Fabric sourcing</span>
                <span>Delivery</span>
              </div>
            </div>
          </div>
          <div className="border-t border-line-subtle px-5 py-4 sm:px-6">
            <p className="label-caps mb-3 text-ink-muted">Recent activity</p>
            <Timeline
              items={[
                { id: "a", title: "Stitching started", meta: "Today · Example Knit Unit A", tone: "info", icon: Scissors },
                { id: "b", title: "Cutting completed with 3 evidence photos", meta: "14 Mar", tone: "success", icon: Camera },
                { id: "c", title: "Sample approved by the brand", meta: "10 Mar", tone: "success", icon: Ruler },
              ]}
            />
          </div>
        </MockCard>
        <div className="absolute bottom-0 right-0 hidden w-64 rounded-lg border border-line-strong bg-surface-raised p-4 shadow-pop lg:block">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <CircleDollarSign className="size-3.5 text-accent" aria-hidden /> Next payment
            </p>
            <Badge tone="warning" dot>Due</Badge>
          </div>
          <p className="tabular mt-2 font-display text-2xl font-[450] tracking-[-0.02em] text-ink">USD 1,280.00</p>
          <p className="text-xs text-ink-muted">Production milestone · 40%</p>
        </div>
      </div>
    </MockFrame>
  );
}

const MATCHES = [
  {
    name: "Example Knit Unit A",
    place: "Lahore, PK",
    score: 91,
    notes: [
      { ok: true, text: "2 of 2 required processes" },
      { ok: true, text: "GOTS verified" },
      { ok: true, text: "35-day lead time, 90 days available" },
    ],
  },
  {
    name: "Example Knit Unit B",
    place: "Dhaka, BD",
    score: 74,
    notes: [
      { ok: false, text: "1 of 2 required processes (no screen printing)" },
      { ok: true, text: "GOTS verified" },
      { ok: false, text: "Outside preferred country" },
    ],
  },
];

/** Factory matching result with reasons. */
export function MatchMock() {
  return (
    <MockFrame label="Example factory matching result with illustrative data" caption={CAPTION}>
      <MockCard>
        <MockBar trail={["Projects", "Organic tees", "Matches"]} />
        <div className="border-b border-line-subtle px-5 py-4">
          <p className="text-xs text-ink-muted">500 organic cotton tees · GOTS required</p>
          <p className="mt-0.5 font-display text-lg font-medium tracking-[-0.01em] text-ink">2 verified factories matched</p>
        </div>
        <ul className="divide-y divide-line-subtle">
          {MATCHES.map((m) => (
            <li key={m.name} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span className="truncate">{m.name}</span>
                    <BadgeCheck className="size-4 shrink-0 text-success" aria-label="Verified" />
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted"><MapPin className="size-3" aria-hidden />{m.place}</p>
                </div>
                <p className="tabular shrink-0 font-display text-[1.75rem] font-[450] leading-none tracking-[-0.02em] text-ink">
                  {m.score}<span className="ml-0.5 text-xs font-medium text-ink-muted">/100</span>
                </p>
              </div>
              <ProgressBar value={m.score} label={`Compatibility ${m.score} of 100`} className="mt-3" tone={m.score >= 85 ? "accent" : "ink"} />
              <ul className="mt-3 grid gap-1 text-xs leading-5">
                {m.notes.map((n) => (
                  <li key={n.text} className="flex items-start gap-1.5">
                    {n.ok ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-label="Meets" />
                    ) : (
                      <Minus className="mt-0.5 size-3.5 shrink-0 text-warning" aria-label="Partly meets" />
                    )}
                    <span className={n.ok ? "text-ink" : "text-ink-muted"}>{n.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="border-t border-line-subtle bg-surface-muted px-5 py-3 text-xs leading-5 text-ink-muted">
          3 other factories excluded: MOQ above the order (1), lead time too long (1), no verified GOTS (1).
        </p>
      </MockCard>
    </MockFrame>
  );
}

const STAGES: Step[] = [
  { key: "fabric", label: "Fabric sourcing", state: "done", hint: "3 Mar" },
  { key: "sampling", label: "Sampling", state: "done", hint: "10 Mar" },
  { key: "cutting", label: "Cutting", state: "done", hint: "14 Mar" },
  { key: "stitching", label: "Stitching", state: "current", hint: "In progress" },
  { key: "finishing", label: "Finishing", state: "upcoming" },
  { key: "qc", label: "Quality control", state: "upcoming" },
  { key: "shipping", label: "Shipping", state: "upcoming" },
  { key: "delivery", label: "Delivery", state: "upcoming" },
];

const PAYMENTS = [
  { label: "Deposit · 30%", amount: "USD 960.00", tone: "success" as const, status: "Paid" },
  { label: "Production · 40%", amount: "USD 1,280.00", tone: "warning" as const, status: "Due" },
  { label: "Balance · 30%", amount: "USD 960.00", tone: "neutral" as const, status: "Scheduled" },
];

/** Production tracking: stage stepper, AQL inspection plan and milestone payments. */
export function TrackingMock() {
  return (
    <MockFrame label="Example production tracking view with illustrative data" caption={CAPTION}>
      <MockCard>
        <MockBar trail={["Orders", "FZ-DEMO-0001", "Production"]} />
        <div className="border-b border-line-subtle p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-medium tracking-[-0.01em] text-ink">Production stages</p>
            <span className="text-xs text-ink-muted">Planned delivery 12 Apr</span>
          </div>
          <StageStepper stages={STAGES} label="Example production stages" />
        </div>
        <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-line-subtle">
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-base font-medium text-ink">Inspection plan</p>
              <Badge tone="outline">ISO 2859-1</Badge>
            </div>
            <dl className="mt-3 divide-y divide-line-subtle text-[13px]">
              {[
                ["Lot size", "500 pcs"],
                ["Inspection level", "General II"],
                ["Sample size", "50 pcs"],
                ["Major defects, AQL 2.5", "Accept ≤ 3"],
                ["Minor defects, AQL 4.0", "Accept ≤ 5"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 py-2">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="tabular text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="border-t border-line-subtle p-5 sm:border-t-0 sm:p-6">
            <p className="font-display text-base font-medium text-ink">Payment schedule</p>
            <ul className="mt-3 divide-y divide-line-subtle text-[13px]">
              {PAYMENTS.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-ink">{p.label}</p>
                    <p className="tabular text-xs text-ink-muted">{p.amount}</p>
                  </div>
                  <Badge tone={p.tone} dot>{p.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </MockCard>
    </MockFrame>
  );
}

const QUOTES = [
  { name: "Example Knit Unit A", unit: "6.40", moq: "300", lead: "35 days", tag: "Best fit" },
  { name: "Example Apparel Co.", unit: "5.95", moq: "1,000", lead: "42 days", tag: "Lowest price" },
  { name: "Example Knit Unit B", unit: "6.85", moq: "250", lead: "30 days", tag: "Fastest" },
];

/** For brands: quotations compared side by side. */
export function QuoteCompareMock() {
  return (
    <MockFrame label="Example quotation comparison with illustrative data" caption={CAPTION}>
      <MockCard>
        <MockBar trail={["Projects", "Organic tees", "Quotations"]} />
        <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
          <p className="font-display text-base font-medium text-ink">Compare quotations</p>
          <span className="text-xs text-ink-muted">3 received</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-line-strong px-5 py-2 sm:grid-cols-[minmax(0,1fr)_5rem_4.5rem_4.5rem]">
          <span className="label-caps text-ink-muted">Factory</span>
          <span className="label-caps text-right text-ink-muted">Unit (USD)</span>
          <span className="label-caps text-right text-ink-muted max-sm:hidden">MOQ</span>
          <span className="label-caps text-right text-ink-muted max-sm:hidden">Lead</span>
        </div>
        <ul className="divide-y divide-line-subtle">
          {QUOTES.map((q, i) => (
            <li
              key={q.name}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-5 py-3 text-[13px] sm:grid-cols-[minmax(0,1fr)_5rem_4.5rem_4.5rem]",
                i === 0 && "bg-accent-soft/60",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{q.name}</p>
                <p className="mt-0.5"><Badge tone={i === 0 ? "accent" : "neutral"}>{q.tag}</Badge></p>
              </div>
              <span className="tabular text-right font-medium text-ink">{q.unit}</span>
              <span className="tabular text-right text-ink max-sm:hidden">{q.moq}</span>
              <span className="tabular text-right text-ink max-sm:hidden">{q.lead}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line-subtle bg-surface-muted px-5 py-3 text-xs leading-5 text-ink-muted">
          Accepting one quotation creates the order; the others are closed automatically.
        </p>
      </MockCard>
    </MockFrame>
  );
}

/** For manufacturers: a matched opportunity. */
export function OpportunityMock() {
  return (
    <MockFrame label="Example matched opportunity with illustrative data" caption={CAPTION}>
      <MockCard>
        <MockBar trail={["Opportunities", "Organic tees"]} />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-caps text-ink-muted">T-shirts · Example Brand Studio</p>
              <p className="mt-1 font-display text-xl font-medium leading-7 tracking-[-0.015em] text-ink">Organic cotton crew-neck tee</p>
            </div>
            <Badge tone="accent" dot>Receiving quotes</Badge>
          </div>
          <dl className="mt-5 grid grid-cols-3 divide-x divide-line border-y border-line">
            <Fact label="Quantity" value="500 pcs" />
            <Fact label="Target" value="USD 6.50" />
            <Fact label="Deadline" value="30 Apr" />
          </dl>
          <div className="mt-5 rounded-md border border-line bg-canvas p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">Your match score</p>
              <p className="tabular font-display text-2xl font-[450] tracking-[-0.02em] text-ink">88<span className="ml-0.5 text-xs font-medium text-ink-muted">/100</span></p>
            </div>
            <ProgressBar value={88} label="Match score 88 of 100" className="mt-2" />
            <ul className="mt-3 grid gap-1 text-xs leading-5 text-ink">
              {["Makes T-shirts; MOQ 300 within the 500 limit", "Screen printing and cut-and-sew available", "GOTS certificate verified"].map((t) => (
                <li key={t} className="flex items-start gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="border-t border-line-subtle bg-surface-muted px-5 py-3 text-xs leading-5 text-ink-muted">Quotation due in 6 days · tech pack v2 attached</p>
      </MockCard>
    </MockFrame>
  );
}

/** Sustainability: certifications as hard requirements in a project. */
export function CertificationMock() {
  return (
    <MockFrame label="Example certification requirement with illustrative data" caption={CAPTION}>
      <MockCard>
        <MockBar trail={["Projects", "Organic tees", "Requirements"]} />
        <div className="p-5 sm:p-6">
          <p className="label-caps text-ink-muted">Required certifications</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {["GOTS", "OEKO-TEX Standard 100"].map((c) => (
              <li key={c} className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-accent-line bg-accent-soft px-2.5 text-xs font-medium text-accent-strong">
                <BadgeCheck className="size-3.5" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">Eligible verified factories</p>
            <p className="tabular font-display text-2xl font-[450] tracking-[-0.02em] text-ink">2<span className="text-sm font-medium text-ink-muted"> of 5</span></p>
          </div>
          <ProgressBar value={2} max={5} label="2 of 5 factories eligible" className="mt-2" />
        </div>
        <div className="border-t border-line-subtle px-5 py-4 sm:px-6">
          <p className="label-caps mb-2 text-ink-muted">Excluded</p>
          <ul className="divide-y divide-line-subtle text-[13px]">
            {[
              { name: "Example Knit Unit C", reason: "GOTS certificate awaiting review", tone: "warning" as const, status: "Pending" },
              { name: "Example Denim Works", reason: "No GOTS certificate uploaded", tone: "danger" as const, status: "Missing" },
              { name: "Example Apparel Co.", reason: "OEKO-TEX certificate expired", tone: "danger" as const, status: "Expired" },
            ].map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{f.name}</p>
                  <p className="text-xs text-ink-muted">{f.reason}</p>
                </div>
                <Badge tone={f.tone} dot>{f.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </MockCard>
    </MockFrame>
  );
}
