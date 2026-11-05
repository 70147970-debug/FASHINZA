import type { Metadata } from "next";
import { Eye, Layers, ScanSearch, Scale } from "lucide-react";
import { CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading } from "@/components/site/marketing";
import { Photo } from "@/components/ui/photo";

export const metadata: Metadata = {
  title: "About",
  description: "Why Fashinza exists and how it approaches garment manufacturing for fashion brands and factories.",
};

const FACTS = [
  ["Focus", "Garment manufacturing"],
  ["Project", "Final Year Project"],
  ["Department", "Software Engineering"],
  ["University", "The University of Lahore"],
  ["Stage", "Working prototype"],
  ["Payments", "Test payments, no real money"],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Fashinza"
        title="Making garment manufacturing easier to manage"
        description="Fashinza connects fashion brands, clothing startups and designers with garment manufacturers, and keeps the whole production run, from brief to delivery, in one shared record."
        aside={
          <div className="border-t border-line-strong lg:ml-auto lg:max-w-md">
            <p className="label-caps py-4 text-ink-muted">Fact sheet</p>
            <dl className="border-t border-line">
              {FACTS.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 border-b border-line py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <dt className="text-sm text-ink-muted">{k}</dt>
                  <dd className="font-display text-[1.0625rem] font-medium tracking-[-0.01em] text-ink sm:text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        }
      />
      <Section labelledBy="problem-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading id="problem-title" index="01" eyebrow="Context" title="The problem we are addressing" className="lg:col-span-5 lg:mb-0" />
          <div className="space-y-6 text-[1.0625rem] leading-8 text-ink lg:col-span-7 lg:pt-[3.75rem] lg:text-lg lg:leading-8">
            <p className="first-letter:float-left first-letter:mr-2.5 first-letter:mt-1 first-letter:font-display first-letter:text-[3.75rem] first-letter:font-normal first-letter:leading-[0.85] first-letter:text-accent-strong">
              Many fashion brands, especially startups, still find factories through directories and trade contacts, and
              manage production through email, spreadsheets and messaging apps. Tech packs get lost between versions,
              status updates arrive late, and quality problems are discovered after the garments are made.
            </p>
            <p className="text-ink-muted">
              Garment manufacturers face the opposite problem: requests that do not fit their minimum order quantity,
              capacity or capabilities, and no standard way to quote, share samples or report progress.
            </p>
          </div>
        </div>
      </Section>
      <div className="bg-canvas pb-16 lg:pb-24">
        <div className="container-page">
          <div className="relative aspect-[16/9] sm:aspect-[21/9]">
            <Photo
              photo="finishedGarments"
              sizes="(min-width: 1280px) 1136px, 100vw"
              fill
              position="center 45%"
              rounded="xl"
              credit
              alt="Finished garments in rust and teal hanging on clothing rails"
            />
          </div>
        </div>
      </div>
      <Section tone="surface" labelledBy="approach-title">
        <SectionHeading id="approach-title" index="02" eyebrow="Principles" title="Our approach" />
        <FeatureGrid columns={4}>
          <FeatureCard icon={Eye} title="Transparent matching">
            Factory matching follows published rules, and the reasons are always shown. No AI model is involved today.
          </FeatureCard>
          <FeatureCard icon={Layers} title="One shared status">
            Brands and manufacturers see the same quotations, samples, milestones and inspection results.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Manual verification">
            An administrator reviews every factory&apos;s documents; nothing is verified automatically.
          </FeatureCard>
          <FeatureCard icon={Scale} title="Honest claims">
            No invented statistics, testimonials or partnerships. Example data is labelled, and our photographs are
            generic industry images.
          </FeatureCard>
        </FeatureGrid>
      </Section>
      <Section labelledBy="project-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading id="project-title" index="03" eyebrow="Academic project" title="About this project" className="lg:col-span-5 lg:mb-0" />
          <div className="border-l-2 border-accent pl-6 lg:col-span-7 lg:mt-[3.75rem]">
            <p className="text-[1.0625rem] leading-8 text-ink">
              Fashinza is being developed as a Final Year Project in the Department of Software Engineering at The
              University of Lahore. This version is a working prototype: payments are simulated (no real money moves),
              production updates refresh every few seconds, and email notifications are not switched on yet. Demand
              forecasting, message translation and a more advanced matching service are planned for later versions.
            </p>
          </div>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
