import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, PageHero, Section, SectionHeading, WorkflowDiagram } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How It Works",
  description: "The Fashinza workflow: submit requirements, get matched with compatible manufacturers, compare quotations, and track production and quality control.",
};

const STATUSES = [
  ["Draft", "The brand is still writing the project. Only the brand can see it."],
  ["Submitted", "The project is complete and visible to compatible manufacturers."],
  ["Quoting", "At least one manufacturer has sent a quotation."],
  ["Quotation accepted", "The brand accepted one quotation; the others are closed and an order is created."],
  ["In production", "The manufacturer is working through the production milestones."],
  ["Quality check", "An inspection is recorded with sample size, defects and a pass or fail result."],
  ["Ready to ship", "The order passed quality control and is packed."],
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
      "An optional tech-pack attachment (PDF or image, up to 10 MB). Projects can be saved as drafts first.",
    ],
  },
  {
    title: "2. Compatible manufacturers are matched",
    points: [
      "Manufacturers that fail a mandatory requirement — wrong category, quantity below their minimum or above their capacity, or a missing required capability or certification — are excluded.",
      "The remaining manufacturers receive a compatibility score calculated from documented weights, with the reasons listed next to it.",
      "Matching is rule-based and shows compatibility only. It is not a guarantee of quality or on-time delivery.",
    ],
  },
  {
    title: "3. Manufacturers send quotations",
    points: [
      "Each quotation includes unit price, minimum acceptable quantity, production time, sampling cost, notes and a validity date.",
      "A manufacturer holds one quotation per project and can revise it; earlier versions stay in the history.",
      "The brand compares all quotations side by side and accepts one. The others are closed automatically.",
    ],
  },
  {
    title: "4. Production and quality control are tracked",
    points: [
      "Accepting a quotation creates an order with eight milestones: fabric sourcing, sampling, cutting, stitching, finishing, quality control, shipping and delivery.",
      "Milestones must be completed in order. Each can carry notes, a supporting file and a reported delay reason.",
      "Quality-control reports record the observed defect rate (defective items ÷ inspected items × 100). This is a simple calculation, not a formal AQL inspection.",
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
      >
        <Button asChild variant="accent" size="lg"><Link href="/register?role=brand">Start a Project</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/register?role=manufacturer">Join as a Manufacturer</Link></Button>
      </PageHero>

      <Section labelledBy="flow-title">
        <SectionHeading id="flow-title" title="The production workflow at a glance" />
        <WorkflowDiagram />
      </Section>

      <Section tone="white" labelledBy="detail-title">
        <SectionHeading id="detail-title" title="What happens at each step" />
        <div className="grid gap-6 md:grid-cols-2">
          {DETAIL.map((d) => (
            <div key={d.title} className="rounded-lg border border-line p-6">
              <h3 className="text-lg font-semibold">{d.title}</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted marker:text-teal">
                {d.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section labelledBy="status-title">
        <SectionHeading
          id="status-title"
          title="Project statuses"
          description="Statuses only move forward through permitted steps, checked on the server. A project can also be cancelled before production starts."
        />
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-navy-50 text-navy">
              <tr><th scope="col" className="px-4 py-3 font-semibold">Status</th><th scope="col" className="px-4 py-3 font-semibold">Meaning</th></tr>
            </thead>
            <tbody>
              {STATUSES.map(([s, m]) => (
                <tr key={s} className="border-t border-line">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-navy">{s}</td>
                  <td className="px-4 py-3 text-muted">{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
