import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileCheck2, PackageMinus, Recycle, ScanSearch, Scale } from "lucide-react";
import { CheckList, CtaBand, FeatureCard, PageHero, Section, SectionHeading } from "@/components/site/marketing";
import { Button } from "@/components/ui/button";
import { CERTIFICATIONS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sustainability",
  description: "How Fashinza helps brands require verified certifications, order closer to demand and reduce rejected production.",
};

const CERT_NOTES: Record<string, string> = {
  GOTS: "Global Organic Textile Standard — organic fibre and processing",
  "OEKO-TEX Standard 100": "Textiles tested for harmful substances",
  Fairtrade: "Fair trading conditions for producers",
  BCI: "Better Cotton — cotton farming standard",
  WRAP: "Responsible manufacturing and labour practices",
  SA8000: "Social accountability and working conditions",
  "ISO 9001": "Quality management (not an environmental standard)",
};

export default function SustainabilityPage() {
  return (
    <>
      <PageHero
        eyebrow="Sustainability"
        title="Make responsible sourcing a requirement, not a hope"
        description="Fashinza does not certify factories itself. It lets brands require recognised certifications, checks the documents behind them, and reduces the waste that comes from overproduction and rejected batches."
      >
        <Button asChild variant="accent" size="lg"><Link href="/register?role=brand">Start a Project</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/faq">Read the FAQ</Link></Button>
      </PageHero>

      <Section labelledBy="sus-how">
        <SectionHeading id="sus-how" title="What the platform does today" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={FileCheck2} title="Certifications as hard requirements">
            Brands can require certifications such as GOTS or OEKO-TEX. Factories without that certification are excluded
            from matching — not just ranked lower.
          </FeatureCard>
          <FeatureCard icon={BadgeCheck} title="Documents checked by a person">
            A certification counts only after a Fashinza administrator has reviewed the uploaded certificate. Every
            decision is recorded in an audit log.
          </FeatureCard>
          <FeatureCard icon={PackageMinus} title="Smaller, closer-to-demand runs">
            Brands set the highest MOQ they can accept, so they are matched with factories that take smaller orders
            instead of over-ordering to meet a minimum.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Fewer rejected batches">
            Samples are approved before bulk production and AQL inspections catch defects before shipping, so problems
            are fixed through rework rather than discarded on arrival.
          </FeatureCard>
          <FeatureCard icon={Recycle} title="Sustainability requirements in the brief">
            Recycled packaging, low-impact dyes or traceability needs are written into the project and shown to every
            factory that quotes.
          </FeatureCard>
          <FeatureCard icon={Scale} title="Honest claims">
            We do not publish carbon figures, impact scores or partner logos we cannot substantiate. Verification
            confirms documents were reviewed; it is not an audit of the factory floor.
          </FeatureCard>
        </div>
      </Section>

      <Section tone="white" labelledBy="sus-certs">
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeading id="sus-certs" title="Certifications brands can require" description="These are the certifications factories can upload for verification and brands can make mandatory in a project." />
          <ul className="divide-y divide-line rounded-lg border border-line">
            {CERTIFICATIONS.map((c) => (
              <li key={c} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="font-medium text-navy">{c}</span>
                <span className="text-sm text-muted">{CERT_NOTES[c]}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section labelledBy="sus-limits">
        <div className="grid gap-10 lg:grid-cols-2">
          <SectionHeading id="sus-limits" title="Limits you should know about" />
          <CheckList
            items={[
              "Certificates can expire. Administrators can revoke a verification, but brands should still check validity for high-stakes orders.",
              "Fashinza does not run on-site social or environmental audits.",
              "Demand forecasting to size orders to expected sales is a planned extension, not part of this build.",
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Brief a responsibly sourced run" description="Add certification and sustainability requirements to your next project and see which verified factories qualify." />
    </>
  );
}
