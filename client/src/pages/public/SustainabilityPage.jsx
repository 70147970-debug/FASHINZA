import { Link } from "react-router";
import { ArrowRight, BadgeCheck, FileCheck2, PackageMinus, Recycle, Ruler, Scale, ScanSearch, TriangleAlert } from "lucide-react";
import { CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading } from "@/components/site/marketing";
import { CertificationMock } from "@/components/site/product-mocks";
import { Button } from "@/components/ui/button";
import { CERTIFICATIONS } from "@fashinza/shared/constants.js";
import { PageMeta } from "@/components/meta";

const CERT_NOTES = {
  GOTS: "Global Organic Textile Standard: organic fibre and processing",
  "OEKO-TEX Standard 100": "Textiles tested for harmful substances",
  Fairtrade: "Fair trading conditions for producers",
  BCI: "Better Cotton: a cotton farming standard",
  WRAP: "Responsible manufacturing and labour practices",
  SA8000: "Social accountability and working conditions",
  "ISO 9001": "Quality management (not an environmental standard)",
};

export default function SustainabilityPage() {
  return (
    <>
      <PageMeta
        title="Sustainability"
        description="How Fashinza helps brands require verified certifications, order closer to demand, approve samples before bulk and reduce rejected garment batches."
      />
      <PageHero
        eyebrow="Responsible manufacturing"
        title="Make responsible sourcing a requirement, not a hope"
        description="Fashinza does not certify factories or publish impact figures. It lets brands require recognised certifications, has a person check the certificates behind them, and reduces the waste that comes from overproduction and rejected batches."
        photo={{ name: "linenTexture", alt: "Close-up of natural linen fabric" }}
      >
        <Button asChild variant="accent" size="lg">
          <Link to="/register?role=brand">
            Start a Project <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/faq">Read the FAQ</Link>
        </Button>
      </PageHero>

      <Section labelledBy="sus-how">
        <SectionHeading
          id="sus-how"
          index="01"
          eyebrow="What brands can do today"
          title="Practical controls inside the production workflow"
          description="Each of these works in the brief, the matching and the order itself, rather than in a separate report."
          split
        />
        <FeatureGrid>
          <FeatureCard icon={FileCheck2} title="Certifications as hard requirements">
            Require certifications such as GOTS or OEKO-TEX in your brief. Factories without that verified certification are left out of matching, not just
            ranked lower.
          </FeatureCard>
          <FeatureCard icon={BadgeCheck} title="Certificates checked by a person">
            A certification counts only after a Fashinza administrator has reviewed the uploaded certificate, and every decision is recorded in an audit log.
          </FeatureCard>
          <FeatureCard icon={PackageMinus} title="Smaller minimum orders">
            Set the highest MOQ you can accept, so you are matched with factories that take smaller runs instead of over-ordering to meet a minimum.
          </FeatureCard>
          <FeatureCard icon={Ruler} title="Sample approval before bulk">
            Fit, fabric and finish are agreed on an approved sample before full production starts, so fewer garments are made to the wrong specification.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Fewer rejected batches">
            AQL inspection before shipment catches defects at the factory, where a failed batch is reworked rather than rejected on arrival.
          </FeatureCard>
          <FeatureCard icon={Recycle} title="Sustainability notes in the brief">
            Write requirements such as recycled packaging, low-impact dyes or traceability into the brief, where every factory that quotes can see them.
          </FeatureCard>
        </FeatureGrid>
      </Section>

      <Section tone="surface" labelledBy="sus-certs">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:col-span-6">
            <SectionHeading
              id="sus-certs"
              index="02"
              eyebrow="Standards"
              title="Certifications brands can require"
              description="Factories can upload these certificates for review, and brands can make any of them mandatory in a brief."
              className="mb-8"
            />
            <ul className="border-t border-line-strong">
              {CERTIFICATIONS.map((c) => (
                <li key={c} className="flex flex-col gap-1 border-b border-line py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <span className="flex items-center gap-3 font-display text-lg font-medium tracking-[-0.01em] text-ink">
                    <BadgeCheck className="size-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
                    {c}
                  </span>
                  <span className="pl-7 text-sm text-ink-muted sm:pl-0 sm:text-right">{CERT_NOTES[c]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:pt-[3.75rem]">
            <CertificationMock />
          </div>
        </div>
      </Section>

      <Section labelledBy="sus-limits">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading
            id="sus-limits"
            index="03"
            eyebrow="Honest limits"
            title="What verification does not cover"
            description="We would rather be clear about the limits than make claims we cannot support."
            className="lg:col-span-5 lg:mb-0"
          />
          <ul className="border-t border-line-strong lg:col-span-7 lg:mt-[3.75rem]">
            {[
              "Verification confirms that an administrator reviewed a factory's documents. It is not an on-site social or environmental audit.",
              "Certificates can expire. Administrators can revoke a verification, but check validity yourself for high-stakes orders.",
              "We do not publish carbon figures, impact scores or partner logos we cannot substantiate.",
              "Demand forecasting, to size orders to expected sales, is planned for a later version.",
            ].map((t) => (
              <li key={t} className="flex gap-3.5 border-b border-line py-4 text-[0.9375rem] leading-7 text-ink">
                <TriangleAlert className="mt-1.5 size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-10 flex max-w-3xl items-start gap-3 text-sm leading-6 text-ink-muted">
          <Scale className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
          The photographs on this website are generic garment-industry images. They do not show Fashinza partners, factories or customers.
        </p>
      </Section>

      <CtaBand
        focused
        eyebrow="Responsible sourcing"
        title="Brief a responsibly sourced run"
        description="Add certification and sustainability requirements to your next brief and see which verified manufacturers qualify."
        photo="fabricRolls"
      />
    </>
  );
}
