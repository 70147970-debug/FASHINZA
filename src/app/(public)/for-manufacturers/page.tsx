import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Factory, FileText, Inbox, ListChecks, ScanSearch } from "lucide-react";
import { CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading, StepList } from "@/components/site/marketing";
import { OpportunityMock } from "@/components/site/product-mocks";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "For Manufacturers",
  description: "Create a manufacturer profile, receive matching project requests from brands, submit quotations and manage production orders.",
};

export default function ForManufacturersPage() {
  return (
    <>
      <PageHero
        eyebrow="For manufacturers"
        title="Receive project requests that fit your factory"
        description="Show what your factory can make, and Fashinza shows you brand projects that match your categories, capacity and capabilities."
        aside={<OpportunityMock />}
      >
        <Button asChild variant="accent" size="lg"><Link href="/register?role=manufacturer">Join as a Manufacturer</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/how-it-works">How it works</Link></Button>
      </PageHero>

      <Section labelledBy="mfr-features">
        <SectionHeading id="mfr-features" index="01" eyebrow="Capabilities" title="What you can do as a manufacturer" description="Quote, produce and report from one dashboard, with the same record the brand sees." split />
        <FeatureGrid>
          <FeatureCard icon={Factory} title="A detailed business profile">
            List your location, garment categories, minimum order quantity, monthly capacity, typical lead time, and
            production, fabric and finishing capabilities.
          </FeatureCard>
          <FeatureCard icon={Inbox} title="Matching opportunities">
            See brand projects that your verified factory is eligible for, with a match score and the reasons behind it.
          </FeatureCard>
          <FeatureCard icon={FileText} title="Structured quotations">
            Break down making, fabric, finishing, packaging, sampling, logistics and tax. Fashinza calculates the total,
            and every revision is kept in the history.
          </FeatureCard>
          <FeatureCard icon={ListChecks} title="Milestone updates">
            Move accepted orders through each production stage by uploading evidence such as photos of cut panels.
            Overdue stages are flagged automatically.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Quality-control reports">
            Record AQL inspections (ISO 2859-1 sampling plans) with defects by severity; the pass or fail result is
            calculated, and failed batches open a rework task.
          </FeatureCard>
          <FeatureCard icon={BadgeCheck} title="Verification">
            Upload business and certification documents for an administrator to review and earn the verified badge.
          </FeatureCard>
        </FeatureGrid>
      </Section>

      <Section tone="surface" labelledBy="mfr-steps">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading
            id="mfr-steps"
            index="02"
            eyebrow="Verification"
            title="Getting listed"
            description="Only verified factories are matched to brand projects. Verification is a manual review by a Fashinza administrator."
            className="lg:col-span-5 lg:mb-0"
          />
          <StepList
            className="lg:col-span-7 lg:mt-[3.75rem]"
            items={[
              { title: "Register and build your profile", text: "Register as a manufacturer and complete your business profile." },
              { title: "Add capabilities and documents", text: "Add your capabilities and upload supporting documents, such as business registration or certificates." },
              { title: "Request verification", text: "An administrator reviews your documents and records a decision with a reason." },
              { title: "Certifications start to count", text: "Certifications count in matching only after the administrator has verified the document." },
            ]}
          />
        </div>
      </Section>

      <CtaBand primary="manufacturer" title="Register your factory" description="Create your profile now; you can request verification once your documents are uploaded." />
    </>
  );
}
