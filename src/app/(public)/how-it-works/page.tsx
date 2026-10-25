import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CtaBand, PageHero, Section, SectionHeading, WorkflowDiagram } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "How It Works",
  description: "The Fashinza workflow: submit requirements, get matched with compatible manufacturers, compare quotations, and track production and quality control.",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  Draft: "neutral",
  Submitted: "accent",
  "Receiving quotes": "accent",
  "Quotation accepted": "success",
  "In production": "info",
  "Quality check": "warning",
  "Ready to ship": "accent",
  Shipped: "accent",
  Delivered: "success",
};

const STATUSES = [
  ["Draft", "The brand is still writing the project. Only the brand can see it."],
  ["Submitted", "The project is complete and matching has run. Only invited, verified manufacturers can see it."],
  ["Receiving quotes", "At least one verified manufacturer was invited or has sent a quotation."],
  ["Quotation accepted", "The brand accepted one quotation; the others are closed and an order is created."],
  ["In production", "The manufacturer is working through the production milestones."],
  ["Quality check", "An AQL inspection is recorded; a failed batch returns to stitching for rework."],
  ["Ready to ship", "The brand accepted the passing inspection; the factory prepares the shipment."],
  ["Shipped", "The order has left the factory."],
  ["Delivered", "The brand confirms the order arrived."],
];

const DETAIL = [
  {
    title: "1. The brand submits requirements",
    points: [
      "Garment category, description, target quantity and target unit price with currency.",
      "Preferred production deadline, fabric requirements, sizes and colours.",
      "Optional required capabilities, preferred manufacturing country and required certifications.",
      "A tech pack (PDF or image, up to 10 MB) is required to submit. New uploads become new versions; earlier versions are kept.",
      "Projects can be saved as drafts at any step and finished later.",
    ],
  },
  {
    title: "2. Compatible manufacturers are matched",
    points: [
      "Only verified manufacturers are considered. Those that fail a mandatory requirement — wrong category, a minimum order above your limit, a lead time longer than your deadline allows, too little free capacity, or a missing verified certification — are excluded.",
      "The remaining manufacturers receive a score from documented weights (processes, fabric, capacity, lead time, location and track record), with the reasons listed next to it.",
      "Matching is rule-based and shows compatibility only. It is not a guarantee of quality or on-time delivery.",
    ],
  },
  {
    title: "3. Manufacturers send quotations",
    points: [
      "Each quotation breaks down making, fabric, finishing and packaging cost per unit, plus sampling, logistics and tax. Fashinza calculates the total.",
      "A manufacturer holds one quotation per project and can revise it; earlier versions stay in the history.",
      "The brand compares all quotations side by side, can ask for a revision, and accepts one. Expired quotations cannot be accepted, and the others are closed automatically.",
    ],
  },
  {
    title: "4. Production and quality control are tracked",
    points: [
      "Accepting a quotation creates an order with eight milestones: fabric sourcing, sampling, cutting, stitching, finishing, quality control, shipping and delivery.",
      "Milestones must be completed in order, each with its required evidence. Sampling completes when the brand approves a sample; overdue stages are flagged and the delivery estimate is adjusted.",
      "Quality control uses ISO 2859-1 AQL sampling plans. A failed batch creates a rework task and returns production to stitching; a passed batch needs the brand's acceptance.",
      "A milestone payment schedule (30% / 40% / 30% by default) becomes due as stages complete. This build uses a clearly labelled sandbox payment provider.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="A clear process from first brief to delivered order"
        description="Brands, manufacturers and administrators work in the same workflow, and every important change is recorded in the project history."
        aside={
          <nav aria-label="On this page" className="rounded-lg border border-line bg-surface-muted p-5 sm:p-6">
            <p className="label-caps mb-3 text-muted">On this page</p>
            <ol className="divide-y divide-line">
              {DETAIL.map((d, i) => (
                <li key={d.title}>
                  <a href={`#step-${i + 1}`} className="group flex min-h-12 items-center gap-4 py-3 text-[0.9375rem] font-medium text-navy">
                    <span className="tabular grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-white font-display text-sm font-semibold">{i + 1}</span>
                    <span className="flex-1">{d.title.replace(/^\d+\.\s*/, "")}</span>
                    <ArrowRight className="size-4 text-subtle transition-colors duration-150 group-hover:text-teal-700" aria-hidden />
                  </a>
                </li>
              ))}
              <li>
                <a href="#status-title" className="group flex min-h-12 items-center gap-4 py-3 text-[0.9375rem] font-medium text-navy">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-line-strong bg-white text-xs text-muted" aria-hidden>…</span>
                  <span className="flex-1">Project statuses</span>
                  <ArrowRight className="size-4 text-subtle transition-colors duration-150 group-hover:text-teal-700" aria-hidden />
                </a>
              </li>
            </ol>
          </nav>
        }
      >
        <Button asChild variant="accent" size="lg"><Link href="/register?role=brand">Start a Project</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/register?role=manufacturer">Join as a Manufacturer</Link></Button>
      </PageHero>

      <Section labelledBy="flow-title">
        <SectionHeading id="flow-title" eyebrow="Overview" title="The production workflow at a glance" />
        <WorkflowDiagram />
      </Section>

      <Section tone="white" labelledBy="detail-title">
        <SectionHeading
          id="detail-title"
          eyebrow="In detail"
          title="What happens at each step"
          description="The rules below are enforced by the platform, not left to convention."
        />
        <ol className="border-t border-line">
          {DETAIL.map((d, i) => (
            <li
              key={d.title}
              id={`step-${i + 1}`}
              className="grid scroll-mt-24 gap-4 border-b border-line py-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16 lg:py-10"
            >
              <div className="flex items-start gap-4">
                <span className="tabular font-display text-[2rem] font-semibold leading-none text-teal-700" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="pt-1 font-display text-xl font-semibold text-navy">{d.title.replace(/^\d+\.\s*/, "")}</h3>
              </div>
              <ul className="space-y-3">
                {d.points.map((p) => (
                  <li key={p} className="relative pl-5 text-[0.9375rem] leading-7 text-ink before:absolute before:left-0.5 before:top-[0.7rem] before:size-1.5 before:rounded-full before:bg-teal">
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="status-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
          <SectionHeading
            id="status-title"
            eyebrow="Statuses"
            title="Project statuses"
            description="Statuses only move forward through permitted steps, checked on the server. A project can also be cancelled before production starts."
            className="lg:sticky lg:top-24 lg:self-start"
          />
          <ol className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
            {STATUSES.map(([s, m], i) => (
              <li key={s} className="grid gap-2 border-b border-line-subtle px-5 py-4 last:border-b-0 sm:grid-cols-[2rem_11rem_minmax(0,1fr)] sm:items-start sm:gap-4">
                <span className="tabular hidden pt-0.5 text-xs text-subtle sm:block" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <span><Badge tone={STATUS_TONE[s]} dot>{s}</Badge></span>
                <span className="text-sm leading-6 text-muted">{m}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
