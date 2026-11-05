import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Camera, Cog, Factory, FileText, Gauge, Layers, Ruler, ScanSearch } from "lucide-react";
import { CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading, StepList, WRAP_ON_PHONE } from "@/components/site/marketing";
import { OpportunityMock } from "@/components/site/product-mocks";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { CAPABILITIES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "For Manufacturers",
  description:
    "List your garment categories, MOQ, monthly capacity and processes, receive matching production requests from fashion brands, quote, sample and report progress with evidence.",
};

const CAPABILITY_GROUPS: { title: string; items: readonly string[] }[] = [
  { title: "Production processes", items: CAPABILITIES.PRODUCTION },
  { title: "Fabrics and materials", items: CAPABILITIES.FABRIC },
  { title: "Finishing", items: CAPABILITIES.FINISHING },
];

export default function ForManufacturersPage() {
  return (
    <>
      <PageHero
        eyebrow="For garment manufacturers"
        title="Production requests that fit your factory"
        description="Show brands what your factory makes, the fabrics you handle and how much you can take on. Once verified, you receive projects that match your categories, minimum order quantity and capacity."
        photo={{ name: "factorySewingLines", position: "68% center", alt: "Machinists at industrial sewing stations in a garment factory" }}
      >
        <Button asChild variant="accent" size="lg" className={WRAP_ON_PHONE}>
          <Link href="/register?role=manufacturer">
            Join as a Manufacturer <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg"><Link href="/how-it-works">How it works</Link></Button>
      </PageHero>

      <Section labelledBy="mfr-features">
        <SectionHeading
          id="mfr-features"
          index="01"
          eyebrow="What you can do"
          title="Quote, sample and produce from one dashboard"
          description="You work from the same order record the brand sees, so progress is shown with evidence rather than chased by message."
          split
        />
        <FeatureGrid>
          <FeatureCard icon={Factory} title="A detailed factory profile">
            List the garment categories you produce, your location and your typical lead time, so brands see what you
            specialise in.
          </FeatureCard>
          <FeatureCard icon={Gauge} title="MOQ and monthly capacity">
            Set your minimum order quantity and monthly production capacity. Matching only sends you projects you can
            take on.
          </FeatureCard>
          <FeatureCard icon={Cog} title="Machinery and processes">
            Describe your machinery and specialities, and list the production and finishing processes you offer, from
            cut-and-sew and knitting to embroidery and garment dyeing.
          </FeatureCard>
          <FeatureCard icon={Layers} title="Fabrics you handle">
            Show the fabrics and materials you work with, such as organic cotton, denim, jersey knit or wool blends.
          </FeatureCard>
          <FeatureCard icon={FileText} title="Itemised quotations">
            Break down making, fabric, finishing, packaging, sampling, logistics and tax. Fashinza calculates the total,
            and every revision is kept in the history.
          </FeatureCard>
          <FeatureCard icon={Ruler} title="Sample rounds">
            Submit samples with photos and notes for the brand to approve or comment on. Each round is kept on the order.
          </FeatureCard>
          <FeatureCard icon={Camera} title="Progress with evidence">
            Complete fabric sourcing, cutting, stitching and finishing by uploading photos or documents, and record the
            carrier and tracking details when you ship. Overdue stages are flagged automatically.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Quality inspection reports">
            Record AQL inspections (ISO 2859-1 sampling plans) with defects by severity; the pass or fail result is
            calculated, and a failed batch opens a rework task.
          </FeatureCard>
          <FeatureCard icon={BadgeCheck} title="Verification">
            Upload your business registration and certificates for an administrator to review, and earn the verified
            badge brands look for.
          </FeatureCard>
        </FeatureGrid>
      </Section>

      <Section tone="surface" labelledBy="mfr-opportunities">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="min-w-0 lg:col-span-5">
            <SectionHeading
              id="mfr-opportunities"
              index="02"
              eyebrow="Matched opportunities"
              title="See why a project was sent to you"
              description="Each opportunity shows the brief, the tech pack, your match score and the reasons behind it, so you can decide quickly whether to quote."
              className="mb-0 lg:mb-0"
            />
          </div>
          <div className="min-w-0 lg:col-span-6 lg:col-start-7">
            <OpportunityMock />
          </div>
        </div>
      </Section>

      <Section labelledBy="mfr-capabilities">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="relative aspect-[16/10] min-w-0 overflow-hidden rounded-xl lg:col-span-5 lg:aspect-auto lg:min-h-[30rem]">
            <Photo
              photo="fabricCutting"
              sizes="(min-width: 1024px) 40vw, 100vw"
              fill
              rounded="xl"
              position="45% 40%"
              credit
              alt="Cutting printed fabric with tailor's shears along a paper pattern"
            />
          </div>
          <div className="min-w-0 lg:col-span-7">
            <SectionHeading
              id="mfr-capabilities"
              index="03"
              eyebrow="Capabilities"
              title="The capabilities brands can ask for"
              description="Brands can require specific processes in a brief, and matching compares them with the capabilities on your profile."
              className="mb-8"
            />
            <div className="grid gap-8 border-t border-line-strong pt-6 sm:grid-cols-3 sm:gap-6">
              {CAPABILITY_GROUPS.map((g) => (
                <div key={g.title}>
                  <h3 className="label-caps font-sans text-ink-muted">{g.title}</h3>
                  <ul className="mt-3 space-y-1.5 text-sm leading-6 text-ink">
                    {g.items.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section id="verification" tone="surface" labelledBy="mfr-steps">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading
            id="mfr-steps"
            index="04"
            eyebrow="Verification"
            title="Getting listed"
            description="Only verified factories are matched to brand projects. Verification is a manual review by a Fashinza administrator, never automatic. It confirms your documents were reviewed; it is not an on-site audit."
            className="lg:col-span-5 lg:mb-0"
          />
          <StepList
            className="lg:col-span-7 lg:mt-[3.75rem]"
            items={[
              { title: "Register your factory", text: "Create a manufacturer account and complete your factory profile: categories, MOQ, monthly capacity and lead time." },
              { title: "Add capabilities and documents", text: "List your processes, fabrics and finishing, and upload your business registration and any certificates." },
              { title: "Request verification", text: "An administrator reviews your documents and records a decision with a reason." },
              { title: "Start receiving projects", text: "Verified factories are matched to brand projects. Certifications count in matching once their document is verified." },
            ]}
          />
        </div>
      </Section>

      <CtaBand
        focused
        primary="manufacturer"
        eyebrow="For garment manufacturers"
        title="List your factory on Fashinza"
        description="Registration is free. Build your factory profile now and request verification once your business registration is uploaded."
        photo="factoryFloor"
      />
    </>
  );
}
