import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, FileCheck2, PackageMinus, Recycle, ScanSearch, Scale } from "lucide-react";
import { CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading } from "@/components/site/marketing";
import { CertificationMock } from "@/components/site/product-mocks";
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
        aside={<CertificationMock />}
      >
        <Button asChild variant="accent" size="lg"><Link href="/register?role=brand">Start a Project</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/faq">Read the FAQ</Link></Button>
      </PageHero>

      <Section labelledBy="sus-how">
        <SectionHeading id="sus-how" eyebrow="Today" title="What the platform does today" description="Practical controls that work inside the production workflow, not a separate report." />
        <FeatureGrid>
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
        </FeatureGrid>
      </Section>

      <Section tone="white" labelledBy="sus-certs">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading
            id="sus-certs"
            eyebrow="Standards"
            title="Certifications brands can require"
            description="These are the certifications factories can upload for verification and brands can make mandatory in a project."
            className="lg:mb-0"
          />
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line bg-white shadow-card">
            {CERTIFICATIONS.map((c) => (
              <li key={c} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <span className="flex items-center gap-2.5 font-display text-[0.9375rem] font-semibold text-navy">
                  <BadgeCheck className="size-4 shrink-0 text-teal" aria-hidden />
                  {c}
                </span>
                <span className="text-sm text-muted sm:text-right">{CERT_NOTES[c]}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section labelledBy="sus-limits">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <SectionHeading
            id="sus-limits"
            eyebrow="Honesty"
            title="Limits you should know about"
            description="What verification on Fashinza does not cover."
            className="lg:mb-0"
          />
          <ul className="space-y-3">
            {[
              "Certificates can expire. Administrators can revoke a verification, but brands should still check validity for high-stakes orders.",
              "Fashinza does not run on-site social or environmental audits.",
              "Demand forecasting to size orders to expected sales is a planned extension, not part of this build.",
            ].map((t) => (
              <li key={t} className="flex gap-3 rounded-lg border border-line bg-white px-5 py-4 text-[0.9375rem] leading-7 text-ink shadow-card">
                <AlertTriangle className="mt-1.5 size-4 shrink-0 text-warning" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <CtaBand title="Brief a responsibly sourced run" description="Add certification and sustainability requirements to your next project and see which verified factories qualify." />
    </>
  );
}
