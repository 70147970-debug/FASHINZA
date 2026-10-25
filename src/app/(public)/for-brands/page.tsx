import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Eye, FileSearch, GitCompareArrows, History, ScanSearch } from "lucide-react";
import { CheckList, CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading } from "@/components/site/marketing";
import { QuoteCompareMock } from "@/components/site/product-mocks";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For Brands",
  description: "Submit production requirements, get matched with compatible manufacturers, compare quotations and track every milestone.",
};

export default function ForBrandsPage() {
  return (
    <>
      <PageHero
        eyebrow="For fashion brands"
        title="Spend your time on the collection, not on chasing factories"
        description="Fashinza gives startups and growing brands one place to brief manufacturers, compare offers and follow production through to delivery."
        aside={<QuoteCompareMock />}
      >
        <Button asChild variant="accent" size="lg"><Link href="/register?role=brand">Start a Project</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/how-it-works">How it works</Link></Button>
      </PageHero>

      <Section labelledBy="brand-features">
        <SectionHeading id="brand-features" eyebrow="Capabilities" title="What you can do as a brand" description="Everything from the first brief to the final inspection lives in one project record." />
        <FeatureGrid>
          <FeatureCard icon={ClipboardList} title="Structured project briefs">
            Describe the garment, quantity, target price, deadline, fabric, sizes and colours, and attach a tech pack.
            Save drafts until you are ready to submit.
          </FeatureCard>
          <FeatureCard icon={FileSearch} title="Explained matching">
            See which manufacturers are compatible with your project, their compatibility score, and the exact reasons
            they were matched.
          </FeatureCard>
          <FeatureCard icon={GitCompareArrows} title="Side-by-side quotations">
            Compare unit price, minimum quantity, production time, sampling cost and validity, then accept the one that
            fits.
          </FeatureCard>
          <FeatureCard icon={Eye} title="Production timeline">
            Follow eight milestones from fabric sourcing to delivery, with notes, supporting photos and any reported
            delays.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Quality-control reports">
            Review each inspection: sample size, defective items, observed defect rate, notes and the pass or fail
            result.
          </FeatureCard>
          <FeatureCard icon={History} title="A complete history">
            Changes to your project after quotations arrive, and every order status change, are kept in an activity
            history.
          </FeatureCard>
        </FeatureGrid>
      </Section>

      <Section tone="white" labelledBy="brand-fit">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading
            id="brand-fit"
            eyebrow="Fit"
            title="Who it is for"
            description="Fashinza is designed for brands that need managed production without a full sourcing team."
            className="lg:mb-0"
          />
          <div className="rounded-lg border border-line bg-surface-muted p-6 sm:p-8">
            <CheckList
              items={[
                "Startups planning a first or second production run who need manufacturers that accept their quantity.",
                "E-commerce and social-media brands that want fewer messages and a clear status for every order.",
                "Growing labels adding new categories, such as activewear or knitwear, and looking for capable factories.",
                "Teams that want a written record of requirements, quotations and quality results for every order.",
              ]}
            />
          </div>
        </div>
      </Section>

      <CtaBand title="Brief your first project" description="Registration is free. You can save your project as a draft and submit it when it is complete." />
    </>
  );
}
