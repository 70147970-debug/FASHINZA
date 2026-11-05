import { Link } from "react-router";
import { ArrowRight, ClipboardList, Eye, FileSearch, GitCompareArrows, PackageCheck, Ruler, ScanSearch, Shirt, Truck } from "lucide-react";
import { CheckList, CtaBand, FeatureCard, FeatureGrid, PageHero, Section, SectionHeading, WRAP_ON_PHONE } from "@/components/site/marketing";
import { MatchMock, QuoteCompareMock } from "@/components/site/product-mocks";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { GARMENT_CATEGORIES } from "@fashinza/shared/constants.js";
import { PageMeta } from "@/components/meta";

export default function ForBrandsPage() {
  return (
    <>
      <PageMeta
        title="For Brands"
        description="Brief your garment, source a suitable manufacturer, compare quotations, approve samples and follow production and quality inspection through to delivery."
      />
      <PageHero
        eyebrow="For fashion brands"
        title="Develop your collection with the right garment manufacturer"
        description="For clothing startups, designers and growing labels: brief your garment once, find factories that accept your quantity and fabric, and follow it from sample to delivery."
        photo={{ name: "designersSampleFitting", position: "55% center", alt: "Two designers fitting a sample garment on a dress form in a studio" }}
      >
        <Button asChild variant="accent" size="lg" className={WRAP_ON_PHONE}>
          <Link to="/register?role=brand">
            Start Your Manufacturing Project <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/how-it-works">How it works</Link>
        </Button>
      </PageHero>

      <Section labelledBy="brand-features">
        <SectionHeading
          id="brand-features"
          index="01"
          eyebrow="What you can do"
          title="Everything from the first brief to the final inspection"
          description="One project record holds your requirements, files, quotations, samples, production milestones and quality reports."
          split
        />
        <FeatureGrid>
          <FeatureCard icon={Shirt} title="Garment categories">
            Brief T-shirts, shirts, dresses, denim, trousers, jackets and outerwear, activewear, knitwear and more, then specify the fabrics, colours, sizes and
            quantity you need.
          </FeatureCard>
          <FeatureCard icon={ClipboardList} title="Tech packs and references">
            Attach your tech pack, design sketches, reference images and documents such as measurement charts. New tech packs become new versions, and earlier
            ones are kept.
          </FeatureCard>
          <FeatureCard icon={FileSearch} title="Factory sourcing with reasons">
            See which verified manufacturers fit your category, MOQ, deadline, capacity and certifications, and exactly why each one was matched.
          </FeatureCard>
          <FeatureCard icon={GitCompareArrows} title="Quotations side by side">
            Compare itemised quotations on unit price, minimum quantity, production time and sampling cost, ask for a revision, then accept the one that fits.
          </FeatureCard>
          <FeatureCard icon={Ruler} title="Sample approval">
            Review each sample round with its photos, request changes, and approve before bulk production begins.
          </FeatureCard>
          <FeatureCard icon={Eye} title="Production you can follow">
            Follow eight milestones from fabric sourcing to delivery, with photo evidence for cutting, stitching and finishing, and delays flagged
            automatically.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Quality inspection reports">
            Read each AQL inspection: sample size, defects by severity, the defect rate and the pass or fail result, and accept a passing batch before it ships.
          </FeatureCard>
          <FeatureCard icon={Truck} title="Delivery status">
            See the carrier and tracking details once the order ships, and confirm delivery when the goods arrive.
          </FeatureCard>
          <FeatureCard icon={PackageCheck} title="A complete history">
            Changes to your brief after quotations arrive, quotation revisions and every order update are kept in one activity history.
          </FeatureCard>
        </FeatureGrid>
      </Section>

      <Section tone="surface" labelledBy="brand-sourcing">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="min-w-0 lg:col-span-5">
            <SectionHeading
              id="brand-sourcing"
              index="02"
              eyebrow="Factory sourcing"
              title="Know why each factory fits before its quotation arrives"
              description="Matching follows published rules: factories that miss a hard requirement are left out, and every verified factory that fits is invited to quote, with its score and reasons shown to you. It shows compatibility, not a guarantee of quality."
              className="mb-0 lg:mb-0"
            >
              <Button asChild variant="link">
                <Link to="/how-it-works#step-2">
                  How factory sourcing works <ArrowRight />
                </Link>
              </Button>
            </SectionHeading>
          </div>
          <div className="min-w-0 lg:col-span-6 lg:col-start-7">
            <MatchMock />
          </div>
        </div>
      </Section>

      <Section labelledBy="brand-quotes">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="min-w-0 lg:order-2 lg:col-span-5 lg:col-start-8">
            <SectionHeading
              id="brand-quotes"
              index="03"
              eyebrow="Quotations"
              title="Compare offers on the terms that matter"
              description="Every quotation itemises making, fabric, finishing, packaging, sampling, logistics and tax, so you compare like with like. Accepting one creates the order."
              className="mb-0 lg:mb-0"
            />
          </div>
          <div className="min-w-0 lg:order-1 lg:col-span-6">
            <QuoteCompareMock />
          </div>
        </div>
      </Section>

      <Section tone="surface" labelledBy="brand-fit">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-6">
            <SectionHeading
              id="brand-fit"
              index="04"
              eyebrow="Who it is for"
              title="Built for brands without a sourcing team"
              description="Fashinza suits labels that need managed garment production and a written record of every decision."
              className="mb-8"
            />
            <CheckList
              items={[
                "Clothing startups planning a first or second production run who need factories that accept their minimum order quantity.",
                "Designers moving a collection from sample to small-batch production.",
                "E-commerce and social-media brands that want fewer messages and a clear status for every order.",
                "Growing labels adding categories such as activewear or knitwear and looking for capable manufacturers.",
              ]}
            />
            <div className="mt-8">
              <p className="label-caps text-ink-muted">Garment categories you can brief</p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Garment categories">
                {GARMENT_CATEGORIES.map((c) => (
                  <li key={c.value} className="inline-flex h-8 items-center rounded-sm border border-line-strong bg-surface px-3 text-xs font-medium text-ink">
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="relative aspect-[16/10] min-w-0 overflow-hidden rounded-xl lg:col-span-6 lg:aspect-auto lg:min-h-[30rem]">
            <Photo
              photo="designSketches"
              sizes="(min-width: 1024px) 50vw, 100vw"
              fill
              rounded="xl"
              position="60% center"
              credit
              alt="Fashion design sketches and a tape measure pinned to a studio wall grid"
            />
          </div>
        </div>
      </Section>

      <CtaBand
        focused
        eyebrow="For fashion brands"
        title="Brief your first garment"
        description="Registration is free. Save your brief as a draft, add your tech pack, and submit it when it is complete to see which verified manufacturers fit."
      />
    </>
  );
}
