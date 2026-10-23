import type { Metadata } from "next";
import { CtaBand, PageHero, Section, SectionHeading } from "@/components/site/marketing";

export const metadata: Metadata = {
  title: "About",
  description: "Why Fashinza exists and how it approaches apparel manufacturing.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Fashinza"
        title="Making apparel manufacturing easier to manage"
        description="Fashinza is a B2B platform that connects fashion brands with clothing manufacturers and keeps the whole production run in one shared workflow."
      />
      <Section labelledBy="problem-title">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading id="problem-title" title="The problem we are addressing" />
            <div className="space-y-4 text-muted">
              <p>
                Many brands, especially startups, still source factories through directories and manage production
                through email, spreadsheets and messaging apps. Requirements get lost, status updates arrive late, and
                quality problems are discovered after the goods are made.
              </p>
              <p>
                Manufacturers face the opposite problem: requests that do not fit their capacity or capabilities, and
                no standard way to quote or report progress.
              </p>
            </div>
          </div>
          <div>
            <SectionHeading title="Our approach" />
            <ul className="list-disc space-y-3 pl-5 text-muted marker:text-teal">
              <li><span className="text-ink">Transparent matching.</span> Compatibility is calculated from documented rules, and the reasons are always shown.</li>
              <li><span className="text-ink">One shared status.</span> Brands and manufacturers see the same milestones, quotations and quality results.</li>
              <li><span className="text-ink">Manual verification.</span> An administrator reviews manufacturer documents; nothing is verified automatically.</li>
              <li><span className="text-ink">Honest claims.</span> We do not publish invented statistics, testimonials or partnerships. Demo content is labelled.</li>
            </ul>
          </div>
        </div>
      </Section>
      <Section tone="white" labelledBy="project-title">
        <SectionHeading
          id="project-title"
          title="About this project"
          description="Fashinza is being developed as a Final Year Project in the Department of Software Engineering at The University of Lahore. This version is a working MVP; payments, real-time chat and mobile apps are planned for later stages."
        />
      </Section>
      <CtaBand />
    </>
  );
}
