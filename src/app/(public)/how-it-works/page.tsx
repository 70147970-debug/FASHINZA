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
  "Ready to ship": "info",
  Shipped: "info",
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
          <nav aria-label="On this page" className="border-t border-line-strong lg:ml-auto lg:max-w-md">
            <p className="label-caps py-4 text-ink-muted">On this page</p>
            <ol className="border-t border-line">
              {DETAIL.map((d, i) => (
                <li key={d.title} className="border-b border-line">
                  <a href={`#step-${i + 1}`} className="group flex min-h-14 items-center gap-5 py-3 text-ink transition-colors duration-150 hover:text-accent-strong">
                    <span className="tabular w-7 font-display text-lg italic text-ink-muted" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 font-display text-lg font-medium tracking-[-0.01em]">{d.title.replace(/^\d+\.\s*/, "")}</span>
                    <ArrowRight className="size-4 text-ink-subtle transition-colors duration-150 group-hover:text-accent" aria-hidden />
                  </a>
                </li>
              ))}
              <li className="border-b border-line">
                <a href="#status-title" className="group flex min-h-14 items-center gap-5 py-3 text-ink transition-colors duration-150 hover:text-accent-strong">
                  <span className="w-7 font-display text-lg italic text-ink-muted" aria-hidden>—</span>
                  <span className="flex-1 font-display text-lg font-medium tracking-[-0.01em]">Project statuses</span>
                  <ArrowRight className="size-4 text-ink-subtle transition-colors duration-150 group-hover:text-accent" aria-hidden />
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
        <SectionHeading id="flow-title" index="01" eyebrow="Overview" title="The production workflow at a glance" />
        <WorkflowDiagram />
      </Section>

      <Section tone="surface" labelledBy="detail-title">
        <SectionHeading
          id="detail-title"
          index="02"
          eyebrow="In detail"
          title="What happens at each step"
          description="The rules below are enforced by the platform, not left to convention."
          split
        />
        <ol className="border-t border-line-strong">
          {DETAIL.map((d, i) => (
            <li
              key={d.title}
              id={`step-${i + 1}`}
              className="grid scroll-mt-24 gap-5 border-b border-line py-8 lg:grid-cols-12 lg:gap-10 lg:py-12"
            >
              <div className="flex items-start gap-5 lg:col-span-5">
                <span className="tabular font-display text-[2.5rem] font-light leading-none tracking-[-0.03em] text-accent-strong lg:text-[3.25rem]" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="max-w-xs pt-1.5 font-display text-[1.375rem] font-medium leading-7 tracking-[-0.015em] text-ink lg:pt-2.5 lg:text-[1.625rem] lg:leading-8">{d.title.replace(/^\d+\.\s*/, "")}</h3>
              </div>
              <ul className="space-y-3 lg:col-span-7">
                {d.points.map((p) => (
                  <li key={p} className="relative pl-5 text-[0.9375rem] leading-7 text-ink before:absolute before:left-0.5 before:top-[0.7rem] before:h-px before:w-2.5 before:bg-accent">
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="status-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading
            id="status-title"
            index="03"
            eyebrow="Statuses"
            title="Project statuses"
            description="Statuses only move forward through permitted steps, checked on the server. A project can also be cancelled before production starts."
            className="lg:sticky lg:top-24 lg:col-span-5 lg:mb-0 lg:self-start"
          />
          <ol className="border-t border-line-strong lg:col-span-7">
            {STATUSES.map(([s, m], i) => (
              <li key={s} className="grid gap-2 border-b border-line py-4 sm:grid-cols-[2.25rem_10.5rem_minmax(0,1fr)] sm:items-start sm:gap-4">
                <span className="tabular hidden font-display text-[0.9375rem] italic text-ink-muted sm:block" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <span><Badge tone={STATUS_TONE[s]} dot>{s}</Badge></span>
                <span className="text-sm leading-6 text-ink-muted">{m}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
