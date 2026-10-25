import type { Metadata } from "next";
import { Eye, Layers, ScanSearch, Scale } from "lucide-react";
import { CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading } from "@/components/site/marketing";

export const metadata: Metadata = {
  title: "About",
  description: "Why Fashinza exists and how it approaches apparel manufacturing.",
};

const FACTS = [
  ["Project", "Final Year Project"],
  ["Department", "Software Engineering"],
  ["University", "The University of Lahore"],
  ["Build", "Working MVP"],
  ["Payments", "Sandbox provider, no real money"],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Fashinza"
        title="Making apparel manufacturing easier to manage"
        description="Fashinza is a B2B platform that connects fashion brands with clothing manufacturers and keeps the whole production run in one shared workflow."
        aside={
          <div className="rounded-lg border border-line bg-surface-muted p-5 sm:p-6">
            <p className="label-caps mb-2 text-muted">Fact sheet</p>
            <dl className="divide-y divide-line">
              {FACTS.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-6">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="text-sm font-medium text-navy sm:text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        }
      />
      <Section labelledBy="problem-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading id="problem-title" eyebrow="Context" title="The problem we are addressing" className="lg:mb-0" />
          <div className="space-y-5 text-[1.0625rem] leading-8 text-ink">
            <p>
              Many brands, especially startups, still source factories through directories and manage production
              through email, spreadsheets and messaging apps. Requirements get lost, status updates arrive late, and
              quality problems are discovered after the goods are made.
            </p>
            <p className="text-muted">
              Manufacturers face the opposite problem: requests that do not fit their capacity or capabilities, and
              no standard way to quote or report progress.
            </p>
          </div>
        </div>
      </Section>
      <Section tone="white" labelledBy="approach-title">
        <SectionHeading id="approach-title" eyebrow="Principles" title="Our approach" />
        <FeatureGrid columns={4}>
          <FeatureCard icon={Eye} title="Transparent matching">Compatibility is calculated from documented rules, and the reasons are always shown.</FeatureCard>
          <FeatureCard icon={Layers} title="One shared status">Brands and manufacturers see the same milestones, quotations and quality results.</FeatureCard>
          <FeatureCard icon={ScanSearch} title="Manual verification">An administrator reviews manufacturer documents; nothing is verified automatically.</FeatureCard>
          <FeatureCard icon={Scale} title="Honest claims">We do not publish invented statistics, testimonials or partnerships. Demo content is labelled.</FeatureCard>
        </FeatureGrid>
      </Section>
      <Section labelledBy="project-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading id="project-title" eyebrow="Academic project" title="About this project" className="lg:mb-0" />
          <div className="rounded-lg border border-line bg-white p-6 shadow-card sm:p-8">
            <p className="text-[0.9375rem] leading-7 text-ink">
              Fashinza is being developed as a Final Year Project in the Department of Software Engineering at The University of Lahore. This version is a
              working MVP: payments run through a sandbox provider (no real money), production updates refresh by polling, and email delivery is not yet
              configured. Demand forecasting and message translation are planned extensions.
            </p>
          </div>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
