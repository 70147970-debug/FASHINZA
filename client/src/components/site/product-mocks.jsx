import { BadgeCheck, Camera, Check, ChevronRight, Factory, MapPin, Minus, Ruler, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar, StageStepper, Timeline } from "@/components/app/primitives";
import { STAGES as ORDER_STAGES } from "@fashinza/shared/workflow.js";
import { ExampleBadge, MockFrame } from "./marketing";
import { cn } from "@fashinza/shared/utils.js";

/*
 * Composed previews of the order, matching and quotation screens for the public website. Every preview shows an
 * "Example data" badge and a caption: the names, figures and dates are illustrative, not real customers,
 * factories or orders. Stage and payment names match the ones brands and factories meet in the app.
 */

const CAPTION = "Illustrative example built from the product's own components. Names, figures and dates are not real.";

function MockCard({ className, children }) {
  return <div className={cn("overflow-hidden rounded-lg border border-line-strong bg-surface", className)}>{children}</div>;
}

/** Simplified app chrome: breadcrumb trail + example badge. */
function MockBar({ trail }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
        <span className="mr-1 inline-flex shrink-0 items-baseline font-display text-[15px] font-medium leading-none tracking-[-0.02em] text-ink" aria-hidden>
          Fashinza
          <span className="ml-px size-[3px] rounded-full bg-accent" />
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

function Fact({ label, value }) {
  return (
    <div className="min-w-0 px-2.5 py-2.5 sm:px-4">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular mt-1 break-words text-[15px] font-medium text-ink sm:text-base">{value}</dd>
    </div>
  );
}

/** One segment per production milestone: done (charcoal), current (forest green), upcoming (hairline). */
function SegmentBar({ done, total }) {
  return (
    <div className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1 rounded-xs", i < done ? "bg-primary" : i === done ? "bg-accent" : "bg-line-strong")} />
      ))}
    </div>
  );
}

/** The example order is in its fourth milestone (stitching). */
const CURRENT_STAGE = 3;

/** Home page: a compact order status — current milestone, progress through the eight milestones, latest updates. */
export function ProductionSnapshotMock() {
  const current = ORDER_STAGES[CURRENT_STAGE];
  return (
    <MockFrame label="Example order status with illustrative data" caption={CAPTION}>
      <MockCard>
        <MockBar trail={["Orders", "FZ-DEMO-0001"]} />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label-caps text-ink-muted">Order · FZ-DEMO-0001</p>
              <p className="mt-1 font-display text-xl font-medium leading-7 tracking-[-0.015em] text-ink">Organic cotton crew-neck tee</p>
              <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-muted">
                <Factory className="size-3.5 shrink-0" aria-hidden /> Example Knit Unit A · 500 pcs
              </p>
            </div>
            <Badge tone="info" dot>
              In production
            </Badge>
          </div>
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-ink">{current.label}</span>
              <span className="tabular text-ink-muted">
                Stage {CURRENT_STAGE + 1} of {ORDER_STAGES.length}
              </span>
            </div>
            <SegmentBar done={CURRENT_STAGE} total={ORDER_STAGES.length} />
            <div className="mt-2 flex justify-between gap-3 text-xs text-ink-muted">
              <span>{ORDER_STAGES[0].label}</span>
              <span className="text-right">{ORDER_STAGES[ORDER_STAGES.length - 1].label}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-line-subtle px-5 py-4 sm:px-6">
          <p className="label-caps mb-3 text-ink-muted">Latest updates</p>
          <Timeline
            items={[
              { id: "a", title: "Stitching started on the line", meta: "Today · Example Knit Unit A", tone: "info", icon: Scissors },
              { id: "b", title: "Cutting completed with 3 evidence photos", meta: "14 Mar", tone: "success", icon: Camera },
              { id: "c", title: "Sample approved by the brand", meta: "10 Mar", tone: "success", icon: Ruler },
            ]}
          />
        </div>
      </MockCard>
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

/** Factory sourcing result with the reasons behind each score. */
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
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                    <MapPin className="size-3" aria-hidden />
                    {m.place}
                  </p>
                </div>
                <p className="tabular shrink-0 text-[1.625rem] font-medium leading-none tracking-[-0.025em] text-ink">
                  {m.score}
                  <span className="ml-0.5 text-xs font-medium text-ink-muted">/100</span>
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

const STAGE_HINTS = ["3 Mar", "10 Mar", "14 Mar", "In progress"];

const STAGES = ORDER_STAGES.map((s, i) => ({
  key: s.stage,
  label: s.label,
  state: i < CURRENT_STAGE ? "done" : i === CURRENT_STAGE ? "current" : "upcoming",
  hint: STAGE_HINTS[i],
}));

/** The app's default schedule: 30% on sample approval, 40% on QC approval, 30% on delivery confirmation. */
const PAYMENTS = [
  { label: "Sample approval · 30%", amount: "USD 960.00", tone: "success", status: "Paid" },
  { label: "QC approval · 40%", amount: "USD 1,280.00", tone: "neutral", status: "Scheduled" },
  { label: "Delivery · 30%", amount: "USD 960.00", tone: "neutral", status: "Scheduled" },
];

/** Production tracking: milestone stepper, AQL inspection plan and milestone payments. */
export function TrackingMock() {
  return (
    <MockFrame label="Example production tracking view with illustrative data" caption={CAPTION}>
      <MockCard>
        <MockBar trail={["Orders", "FZ-DEMO-0001", "Production"]} />
        <div className="border-b border-line-subtle p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-medium tracking-[-0.01em] text-ink">Production milestones</p>
            <span className="text-xs text-ink-muted">Planned delivery 12 Apr</span>
          </div>
          <StageStepper stages={STAGES} label="Example production milestones" />
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
            <p className="font-display text-base font-medium text-ink">Milestone payments</p>
            <ul className="mt-3 divide-y divide-line-subtle text-[13px]">
              {PAYMENTS.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-ink">{p.label}</p>
                    <p className="tabular text-xs text-ink-muted">{p.amount}</p>
                  </div>
                  <Badge tone={p.tone} dot>
                    {p.status}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-ink-muted">Each payment falls due when its milestone is approved.</p>
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
                <p className="mt-0.5">
                  <Badge tone={i === 0 ? "accent" : "neutral"}>{q.tag}</Badge>
                </p>
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
            <Badge tone="accent" dot>
              Receiving quotes
            </Badge>
          </div>
          <dl className="mt-5 grid grid-cols-3 divide-x divide-line border-y border-line">
            <Fact label="Quantity" value="500 pcs" />
            <Fact label="Target" value="USD 6.50" />
            <Fact label="Deadline" value="30 Apr" />
          </dl>
          <div className="mt-5 rounded-md border border-line bg-canvas p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">Your match score</p>
              <p className="tabular text-2xl font-medium tracking-[-0.025em] text-ink">
                88<span className="ml-0.5 text-xs font-medium text-ink-muted">/100</span>
              </p>
            </div>
            <ProgressBar value={88} label="Match score 88 of 100" className="mt-2" />
            <ul className="mt-3 grid gap-1 text-xs leading-5 text-ink">
              {["Makes T-shirts; MOQ 300 within the 500 limit", "Screen printing and cut-and-sew available", "GOTS certificate verified"].map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="border-t border-line-subtle bg-surface-muted px-5 py-3 text-xs leading-5 text-ink-muted">
          Quotation due in 6 days · tech pack v2 attached
        </p>
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
              <li
                key={c}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-accent-line bg-accent-soft px-2.5 text-xs font-medium text-accent-strong"
              >
                <BadgeCheck className="size-3.5" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">Eligible verified factories</p>
            <p className="tabular text-2xl font-medium tracking-[-0.025em] text-ink">
              2<span className="text-sm font-medium text-ink-muted"> of 5</span>
            </p>
          </div>
          <ProgressBar value={2} max={5} label="2 of 5 factories eligible" className="mt-2" />
        </div>
        <div className="border-t border-line-subtle px-5 py-4 sm:px-6">
          <p className="label-caps mb-2 text-ink-muted">Excluded</p>
          <ul className="divide-y divide-line-subtle text-[13px]">
            {[
              { name: "Example Knit Unit C", reason: "GOTS certificate awaiting review", tone: "warning", status: "Pending" },
              { name: "Example Denim Works", reason: "No GOTS certificate uploaded", tone: "danger", status: "Missing" },
              { name: "Example Apparel Co.", reason: "OEKO-TEX certificate rejected on review", tone: "danger", status: "Rejected" },
            ].map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{f.name}</p>
                  <p className="text-xs text-ink-muted">{f.reason}</p>
                </div>
                <Badge tone={f.tone} dot>
                  {f.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </MockCard>
    </MockFrame>
  );
}
