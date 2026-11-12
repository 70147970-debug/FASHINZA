import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { CtaBand, JourneyDiagram, PageHero, Section, SectionHeading } from "@/components/site/marketing";
import { TrackingMock } from "@/components/site/product-mocks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/ui/photo";
import { PROJECT_STATUS } from "@fashinza/shared/labels.js";
import { PageMeta } from "@/components/meta";
import { VideoDemo } from "@/components/site/video-demo";

const STATUSES = [
  ["DRAFT", "The brand is still writing the brief. Only the brand can see it."],
  ["SUBMITTED", "The brief is complete and matching has run. Only invited, verified manufacturers can see it."],
  ["QUOTING", "At least one verified manufacturer was invited or has sent a quotation."],
  ["QUOTATION_ACCEPTED", "The brand accepted one quotation; the others are closed and an order is created."],
  ["IN_PRODUCTION", "The manufacturer is working through the production milestones."],
  ["QUALITY_CHECK", "An AQL inspection is recorded; a failed batch returns to stitching for rework."],
  ["READY_TO_SHIP", "The brand accepted the passing inspection; the factory prepares the shipment."],
  ["SHIPPED", "The order has left the factory with carrier and tracking details."],
  ["DELIVERED", "The brand confirms the goods arrived."],
];

/** Detail sections, numbered by the journey steps (1–9) they cover. */
const DETAIL = [
  {
    steps: "1",
    title: "Design brief",
    points: [
      "Choose the garment category, describe the style, and set the quantity, target unit price and currency.",
      "Add the production deadline, fabrics, colours and sizes, the highest minimum order quantity (MOQ) you can accept, any processes you need (such as embroidery or screen printing), a preferred manufacturing country and required certifications.",
      "A tech pack (PDF or image, up to 10 MB) is required to submit. Add design sketches, reference images and documents such as measurement charts; a new tech pack becomes a new version and earlier versions are kept.",
      "Briefs are saved as drafts at every step, so you can finish later.",
    ],
  },
  {
    steps: "2",
    title: "Factory sourcing",
    points: [
      "Only verified manufacturers are considered. A factory is left out if it does not make your category, its MOQ is above your limit, its lead time cannot meet your deadline, it lacks free monthly capacity, or it is missing a verified certification you require.",
      "The remaining factories are ranked on production processes, fabric experience, capacity, lead time, location and their record on Fashinza, and the reasons are listed beside every score.",
      "Matching follows published rules and shows compatibility only. It is not a promise of quality or on-time delivery.",
    ],
  },
  {
    steps: "3",
    title: "Quotations",
    points: [
      "Each quotation breaks down making, fabric, finishing and packaging cost per garment, plus sampling, logistics and tax. Fashinza calculates the total.",
      "A manufacturer holds one quotation per project and can revise it; earlier versions stay in its history.",
      "The brand compares quotations side by side on price, MOQ, production time and sampling cost, can ask for a revision, and accepts one. Expired quotations cannot be accepted, and the others close automatically.",
    ],
  },
  {
    steps: "4",
    title: "Sample development",
    points: [
      "Accepting a quotation creates the order. Its first milestones are fabric sourcing, evidenced by a fabric receipt, invoice or swatch photo, and sampling.",
      "The manufacturer submits sample rounds with photos. The brand approves a sample or asks for changes, and every round is kept.",
      "Bulk production cannot begin until a sample has been approved.",
    ],
  },
  {
    steps: "5–7",
    title: "Cutting, stitching and finishing",
    points: [
      "The manufacturer completes each stage with photo evidence: cut panels, then garments on the line, then finished, labelled or packed garments.",
      "Stages complete in order. Planned and actual dates sit side by side, overdue stages are flagged, and the delivery estimate moves with them.",
      "The brand is notified as each stage completes, so nobody has to ask for an update.",
    ],
  },
  {
    steps: "8",
    title: "Quality inspection",
    points: [
      "Inspections follow ISO 2859-1 AQL sampling plans (general inspection level II): the lot size sets how many garments are inspected and how many major and minor defects are acceptable.",
      "Defects are recorded by type and severity, and the pass or fail result is calculated from the plan.",
      "A failed batch opens a rework task and returns production to stitching. A passed batch needs the brand's acceptance before it ships.",
    ],
  },
  {
    steps: "9",
    title: "Delivery",
    points: [
      "The manufacturer records the carrier and tracking details when the goods ship, and the brand confirms delivery to complete the order.",
      "Milestone payments (by default 30% on sample approval, 40% on QC approval and 30% on delivery) fall due as their milestones are approved.",
      "Payments are simulated for now, so no real money moves.",
    ],
  },
];

const stepWord = (steps) => (steps.includes("–") ? "Steps" : "Step");
/** Anchors follow the journey numbers (#step-5 opens "Steps 5–7"), so other pages can link to a step. */
const anchor = (steps) => `step-${steps.split("–")[0]}`;

export default function UserGuidePage() {
  return (
    <>
      <PageMeta
        title="User Guide"
        description="A video demo and step-by-step guide to the Fashinza manufacturing journey: design brief, factory sourcing, quotations, sample development, cutting, stitching, finishing, quality inspection and delivery."
      />
      <PageHero
        eyebrow="User guide"
        title="From first brief to delivered order"
        description="Every garment follows the same nine steps. Brands, manufacturers and Fashinza administrators work from one shared record, and every important change is kept in its history."
        aside={
          <nav aria-label="On this page" className="border-t border-line-strong lg:ml-auto lg:max-w-md">
            <p className="label-caps py-4 text-ink-muted">On this page</p>
            <ol className="border-t border-line">
              <li className="border-b border-line">
                <a href="#video" className="group flex min-h-12 items-center gap-4 py-2.5 text-ink transition-colors duration-150 hover:text-accent-strong">
                  <span className="w-[4.5rem] shrink-0 text-[13px] font-medium text-ink-muted">Watch</span>
                  <span className="flex-1 font-display text-[1.0625rem] font-medium tracking-[-0.01em]">Video demo</span>
                  <ArrowRight className="size-4 shrink-0 text-ink-subtle transition-colors duration-150 group-hover:text-accent" aria-hidden />
                </a>
              </li>
              {DETAIL.map((d) => (
                <li key={d.title} className="border-b border-line">
                  <a
                    href={`#${anchor(d.steps)}`}
                    className="group flex min-h-12 items-center gap-4 py-2.5 text-ink transition-colors duration-150 hover:text-accent-strong"
                  >
                    <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-[13px] font-medium text-ink-muted tabular">
                      {stepWord(d.steps)} {d.steps}
                    </span>
                    <span className="flex-1 font-display text-[1.0625rem] font-medium tracking-[-0.01em]">{d.title}</span>
                    <ArrowRight className="size-4 shrink-0 text-ink-subtle transition-colors duration-150 group-hover:text-accent" aria-hidden />
                  </a>
                </li>
              ))}
              <li className="border-b border-line">
                <a href="#statuses" className="group flex min-h-12 items-center gap-4 py-2.5 text-ink transition-colors duration-150 hover:text-accent-strong">
                  <span className="w-[4.5rem] shrink-0 text-[13px] font-medium text-ink-muted" aria-hidden>
                    —
                  </span>
                  <span className="flex-1 font-display text-[1.0625rem] font-medium tracking-[-0.01em]">Project statuses</span>
                  <ArrowRight className="size-4 shrink-0 text-ink-subtle transition-colors duration-150 group-hover:text-accent" aria-hidden />
                </a>
              </li>
            </ol>
          </nav>
        }
      >
        <Button asChild variant="accent" size="lg">
          <Link to="/register?role=brand">Start a Project</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/register?role=manufacturer">Join as a Manufacturer</Link>
        </Button>
      </PageHero>

      {/* The whole process on screen first; the written guide below covers the same steps in detail. */}
      <Section id="video" tone="surface" labelledBy="video-title">
        <SectionHeading
          id="video-title"
          eyebrow="Video demo"
          title="Watch the whole process"
          description="A brand briefs a garment, a matched factory quotes, and the order runs through sampling, production, quality inspection, payment and delivery. Use the chapters to jump to any part."
          split
        />
        <VideoDemo />
      </Section>

      <Section labelledBy="flow-title">
        <SectionHeading
          id="flow-title"
          eyebrow="Overview"
          title="The manufacturing journey at a glance"
          description="Steps 1–3 happen on the project page. Steps 4–9 run on the order page as eight production milestones: fabric sourcing, sampling, cutting, stitching, finishing, quality check, shipping and delivery confirmation."
          split
        />
        <JourneyDiagram />
      </Section>

      <div className="bg-canvas">
        <div className="container-page">
          <div className="relative aspect-[16/9] sm:aspect-[21/9]">
            <Photo
              photo="fabricCutting"
              sizes="(min-width: 1280px) 1136px, 100vw"
              fill
              position="center 35%"
              rounded="xl"
              credit
              alt="Hands laying a paper pattern on printed fabric before cutting it with tailor's shears"
            />
          </div>
        </div>
      </div>

      <Section labelledBy="detail-title">
        <SectionHeading
          id="detail-title"
          eyebrow="In detail"
          title="What happens at each step"
          description="These rules are built into Fashinza, so both sides can rely on them rather than on convention."
          split
        />
        <ol className="border-t border-line-strong">
          {DETAIL.map((d) => (
            <li key={d.title} id={anchor(d.steps)} className="grid scroll-mt-24 gap-5 border-b border-line py-8 lg:grid-cols-12 lg:gap-10 lg:py-12">
              <div className="flex items-start gap-5 lg:col-span-5">
                <div className="flex w-20 shrink-0 flex-col lg:w-28">
                  <span className="label-caps text-ink-muted">{stepWord(d.steps)}</span>
                  <span className="mt-1 font-display text-[2.5rem] font-normal leading-none tracking-[-0.03em] text-accent-strong tabular lg:text-[3.25rem]">
                    {d.steps}
                  </span>
                </div>
                <h3 className="max-w-xs pt-5 font-display text-[1.375rem] font-medium leading-7 tracking-[-0.015em] text-ink lg:pt-7 lg:text-[1.625rem] lg:leading-8">
                  {d.title}
                </h3>
              </div>
              <ul className="space-y-3 lg:col-span-7">
                {d.points.map((p) => (
                  <li
                    key={p}
                    className="relative pl-5 text-[0.9375rem] leading-7 text-ink before:absolute before:left-0.5 before:top-[0.7rem] before:h-px before:w-2.5 before:bg-accent"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="surface" labelledBy="tracking-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="min-w-0 lg:col-span-5">
            <SectionHeading
              id="tracking-title"
              eyebrow="On the order page"
              title="What both sides see during production"
              description="The milestones, the inspection plan for the lot and the payment schedule sit on one order, shared by the brand and the manufacturer."
              className="mb-0 lg:mb-0"
            />
          </div>
          <div className="min-w-0 lg:col-span-7">
            <TrackingMock />
          </div>
        </div>
      </Section>

      <Section id="statuses" labelledBy="status-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading
            id="status-title"
            eyebrow="Statuses"
            title="Project statuses"
            description="Statuses move forward one step at a time and can't be skipped or reversed. A project can still be cancelled before production starts."
            className="lg:sticky lg:top-24 lg:col-span-5 lg:mb-0 lg:self-start"
          />
          <ol className="border-t border-line-strong lg:col-span-7">
            {STATUSES.map(([key, meaning]) => (
              <li key={key} className="grid gap-2 border-b border-line py-4 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-start sm:gap-4">
                <span>
                  <Badge tone={PROJECT_STATUS[key].tone} dot>
                    {PROJECT_STATUS[key].label}
                  </Badge>
                </span>
                <span className="text-sm leading-6 text-ink-muted">{meaning}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
