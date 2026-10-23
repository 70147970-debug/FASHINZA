import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Factory, FileText, Inbox, ListChecks, ScanSearch } from "lucide-react";
import { CheckList, CtaBand, FeatureCard, PageHero, Section, SectionHeading } from "@/components/site/marketing";
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
      >
        <Button asChild variant="accent" size="lg"><Link href="/register?role=manufacturer">Join as a Manufacturer</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/how-it-works">How it works</Link></Button>
      </PageHero>

      <Section labelledBy="mfr-features">
        <SectionHeading id="mfr-features" title="What you can do as a manufacturer" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={Factory} title="A detailed business profile">
            List your location, garment categories, minimum order quantity, monthly capacity, and production, fabric
            and finishing capabilities.
          </FeatureCard>
          <FeatureCard icon={Inbox} title="Matching opportunities">
            See submitted brand projects that match your profile, with the reasons for each match.
          </FeatureCard>
          <FeatureCard icon={FileText} title="Structured quotations">
            Quote unit price, minimum quantity, production time, sampling cost, notes and a validity date. Revise later
            with the history kept.
          </FeatureCard>
          <FeatureCard icon={ListChecks} title="Milestone updates">
            Move accepted orders through each production stage, add notes and photos, and report delays with a reason.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Quality-control reports">
            Record inspection results so the brand sees the same quality data you do.
          </FeatureCard>
          <FeatureCard icon={BadgeCheck} title="Verification">
            Upload business and certification documents for an administrator to review and earn the verified badge.
          </FeatureCard>
        </div>
      </Section>

      <Section tone="white" labelledBy="mfr-steps">
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeading
            id="mfr-steps"
            title="Getting listed"
            description="Your profile becomes visible in matching once it is complete. Verification is a separate, manual review."
          />
          <CheckList
            items={[
              "Register as a manufacturer and complete your business profile.",
              "Add your capabilities and upload supporting documents, such as business registration or certificates.",
              "Request verification. An administrator reviews your documents and records a decision with a reason.",
              "Certifications count in matching only after the administrator has verified the document.",
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Register your factory" description="Create your profile now; you can request verification once your documents are uploaded." />
    </>
  );
}
