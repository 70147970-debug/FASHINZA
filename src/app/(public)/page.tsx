import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Photo, type PhotoName } from "@/components/ui/photo";
import { CheckList, CtaBand, JourneyDiagram, Kicker, ON_PHOTO_OUTLINE, PhotoCredit, Section, SectionHeading, WRAP_ON_PHONE } from "@/components/site/marketing";
import { ProductionSnapshotMock } from "@/components/site/product-mocks";
import { cn } from "@/lib/utils";

const HERO_FACTS = ["Free to register", "Every factory reviewed by an administrator", "Matching reasons shown for every factory"];

const BRAND_ABILITIES = [
  "Choose a garment category: T-shirts, shirts, dresses, trousers, jackets, activewear and more",
  "Specify fabrics, colours, sizes and quantities",
  "Attach tech packs, design sketches, reference images and measurement charts",
  "Compare itemised quotations from matched manufacturers",
  "Review sample rounds, request changes and approve before bulk",
  "Follow cutting, stitching and finishing milestone by milestone",
  "Read AQL quality inspection reports",
  "See shipment tracking and confirm delivery",
];

const MANUFACTURER_ABILITIES = [
  "List the garment categories and production processes you offer",
  "Set your minimum order quantity (MOQ) and monthly capacity",
  "Describe your machinery, specialities and finishing processes",
  "Show the fabrics and materials you work with",
  "Quote with an itemised cost breakdown, including sampling",
  "Submit sample rounds with photos for the brand's approval",
  "Update cutting, stitching, finishing, QC and shipping progress with photo evidence",
];

const CAPABILITIES: { photo: PhotoName; position: string; title: string; text: string }[] = [
  { photo: "designSketches", position: "62% center", title: "Sampling", text: "Pattern making and sample development, approved by the brand before bulk production." },
  { photo: "fabricCutting", position: "45% 40%", title: "Cutting", text: "Fabric laid and cut to pattern, recorded with photos of the cut panels." },
  { photo: "heroSewing", position: "55% 62%", title: "Stitching", text: "Cut-and-sew, knitted and woven garments assembled on the sewing line." },
  { photo: "finishedGarments", position: "72% center", title: "Finishing", text: "Washing, dyeing, pressing, labelling and custom packaging." },
  { photo: "qualityInspection", position: "38% center", title: "Quality control", text: "ISO 2859-1 AQL inspection, with rework when a batch fails." },
];

const RESPONSIBLE = [
  { title: "Required certifications", text: "Make GOTS, OEKO-TEX, Fairtrade and other standards mandatory; factories without them are not matched." },
  { title: "Certificates checked by a person", text: "A certification counts only after an administrator has reviewed the certificate itself." },
  { title: "Smaller minimum orders", text: "Set the highest MOQ you can accept and meet factories that take smaller runs, instead of over-ordering." },
  { title: "Sample approval before bulk", text: "Fit, fabric and finish are agreed on an approved sample before full production starts." },
  { title: "Fewer rejected batches", text: "AQL inspection before shipment catches defects at the factory, where they are reworked rather than rejected on arrival." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero: full-bleed sewing photograph, ivory copy on a scrim. */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-inverse">
        <Photo
          photo="heroSewing"
          sizes="100vw"
          fill
          priority
          rounded="none"
          position="62% 55%"
          alt="A machinist guiding a pinstripe garment under the needle of an industrial sewing machine"
        />
        {/* Phones: ≥65% scrim everywhere. lg+: darkest on the left, where the copy sits (≥67% across the text column). */}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-scrim/90 via-scrim/75 to-scrim/65 lg:bg-linear-to-r lg:from-scrim/90 lg:via-scrim/75 lg:via-55% lg:to-scrim/10"
        />
        <PhotoCredit photo="heroSewing" />
        <div className="container-page relative flex min-h-[38rem] flex-col justify-end pb-12 pt-20 sm:min-h-[42rem] lg:min-h-[min(46rem,calc(100svh-4rem))] lg:justify-center lg:py-24">
          <div className="max-w-[36rem]">
            <p className="eyebrow flex items-center gap-3 text-ink-inverse">
              <span className="h-px w-8 bg-taupe" aria-hidden />
              Garment manufacturing for fashion brands
            </p>
            <h1
              id="hero-title"
              className="mt-6 text-balance font-display text-[2.625rem] font-medium leading-[1.04] tracking-[-0.02em] text-ink-inverse min-[400px]:text-[3rem] sm:text-[3.75rem] lg:text-[4.25rem] xl:text-[4.75rem] xl:tracking-[-0.03em]"
            >
              From Fashion Ideas to <em className="font-normal italic">Finished Garments.</em>
            </h1>
            <p className="mt-6 max-w-[32rem] text-pretty text-base leading-7 text-ink-inverse sm:text-lg sm:leading-8">
              Fashinza connects fashion brands, clothing startups and designers with garment manufacturers suited to their
              category, fabric and order size, then follows every collection from sample development to quality
              inspection and delivery.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild variant="accent" size="lg" className={WRAP_ON_PHONE}>
                <Link href="/register?role=brand">
                  Start Your Manufacturing Project <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className={cn(ON_PHOTO_OUTLINE, WRAP_ON_PHONE)}>
                <Link href="/register?role=manufacturer">Join as a Manufacturer</Link>
              </Button>
            </div>
            <ul className="mt-10 flex flex-col gap-2 border-t border-ink-inverse/20 pt-5 text-[13px] leading-5 text-ink-inverse sm:flex-row sm:flex-wrap sm:gap-x-6">
              {HERO_FACTS.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 shrink-0 text-accent-inverse" strokeWidth={2.25} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 01 The manufacturing journey */}
      <Section labelledBy="journey-title">
        <SectionHeading
          id="journey-title"
          index="01"
          eyebrow="The manufacturing journey"
          title="Nine steps from brief to delivered order"
          description="Brands and manufacturers work from one shared record, so both sides always see the same status, from the first tech pack to the final shipment."
          split
        >
          <Button asChild variant="link">
            <Link href="/how-it-works">
              See each step in detail <ArrowRight />
            </Link>
          </Button>
        </SectionHeading>
        <JourneyDiagram />
      </Section>

      {/* 02 For fashion brands */}
      <Section tone="surface" labelledBy="brands-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="relative aspect-[16/10] min-w-0 overflow-hidden rounded-xl lg:col-span-6 lg:aspect-auto lg:min-h-[36rem]">
            <Photo
              photo="designersSampleFitting"
              sizes="(min-width: 1024px) 50vw, 100vw"
              fill
              rounded="xl"
              position="55% center"
              credit
              alt="Two designers pinning a sample bodice on a dress form in a studio"
            />
          </div>
          <div className="min-w-0 lg:col-span-6 lg:py-2">
            <Kicker index="02" className="mb-7 lg:mb-9">For fashion brands</Kicker>
            <h2 id="brands-title" className="type-section scroll-mt-24 text-balance text-ink">
              Develop your collection with the <em className="font-normal italic">right factory</em>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted sm:text-[1.0625rem]">
              Brief your garment once, in the detail a factory needs, and take it from sample to delivery with manufacturers
              that fit your quantity and fabric.
            </p>
            <AbilityList items={BRAND_ABILITIES} className="mt-8" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Button asChild size="lg" className="self-start">
                <Link href="/register?role=brand">Start a project</Link>
              </Button>
              <Button asChild variant="link">
                <Link href="/for-brands">
                  More for fashion brands <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* 03 For garment manufacturers */}
      <Section labelledBy="makers-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="relative aspect-[16/10] min-w-0 overflow-hidden rounded-xl lg:order-2 lg:col-span-6 lg:aspect-auto lg:min-h-[34rem]">
            <Photo
              photo="factorySewingLines"
              sizes="(min-width: 1024px) 50vw, 100vw"
              fill
              rounded="xl"
              position="68% center"
              credit
              alt="Machinists at industrial sewing stations beside stacks of cut fabric in a garment factory"
            />
          </div>
          <div className="min-w-0 lg:order-1 lg:col-span-6 lg:py-2">
            <Kicker index="03" className="mb-7 lg:mb-9">For garment manufacturers</Kicker>
            <h2 id="makers-title" className="type-section scroll-mt-24 text-balance text-ink">
              Production requests that <em className="font-normal italic">fit your floor</em>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted sm:text-[1.0625rem]">
              Show brands what your factory makes and how much it can take on. Once verified, you receive projects that
              match your categories, MOQ and capacity.
            </p>
            <AbilityList items={MANUFACTURER_ABILITIES} className="mt-8" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Button asChild size="lg" className="self-start">
                <Link href="/register?role=manufacturer">Join as a manufacturer</Link>
              </Button>
              <Button asChild variant="link">
                <Link href="/for-manufacturers">
                  More for manufacturers <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* 04 Manufacturing capabilities: photo-led, a swipeable row on phones and tablets */}
      <Section tone="surface" labelledBy="capabilities-title">
        <SectionHeading
          id="capabilities-title"
          index="04"
          eyebrow="Manufacturing capabilities"
          title="Every stage of garment making"
          description="Manufacturers list the processes they offer, and matching compares them with what your garment needs, from the sampling room to the finishing line."
          split
        />
        <div
          role="region"
          aria-label="Manufacturing capabilities"
          tabIndex={0}
          className="-mx-4 scroll-px-4 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-offset-[-2px] sm:-mx-6 sm:scroll-px-6 lg:mx-0 lg:overflow-visible lg:pb-0"
        >
          <ul className="flex snap-x snap-mandatory gap-4 px-4 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-5 lg:px-0">
            {CAPABILITIES.map((c, i) => (
              <li key={c.title} className="w-[72%] shrink-0 snap-start min-[480px]:w-[46%] sm:w-[38%] lg:w-auto">
                <Photo
                  photo={c.photo}
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 38vw, 72vw"
                  aspect="portrait"
                  position={c.position}
                  overlay="bottom"
                  credit="top"
                  decorative
                  contentClassName="p-4 sm:p-5"
                >
                  <span className="font-display text-sm italic text-ink-inverse tabular" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-[1.375rem] font-medium leading-7 tracking-[-0.01em] text-ink-inverse">{c.title}</h3>
                </Photo>
                <p className="mt-3 text-[13px] leading-5 text-ink-muted">{c.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 05 Production tracking and supply-chain transparency */}
      <Section labelledBy="tracking-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-10">
          <div className="min-w-0 lg:col-span-5">
            <SectionHeading
              id="tracking-title"
              index="05"
              eyebrow="Production tracking"
              title="Supply-chain transparency, from cutting table to delivery"
              description="Accepting a quotation opens an order with eight production milestones. Each one is completed with evidence or an approval, so progress is never a matter of opinion."
              className="mb-8"
            />
            <CheckList
              items={[
                "Milestones complete in order: fabric sourcing, sampling, cutting, stitching, finishing, quality check, shipping and delivery.",
                "Planned and actual dates side by side, with delays flagged automatically.",
                "Inspection reports, rework and shipment tracking kept on the same order.",
                "Brand and manufacturer always see the same status, so nobody chases updates.",
              ]}
            />
            <Button asChild variant="link" className="mt-6">
              <Link href="/how-it-works">
                How production tracking works <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="relative min-w-0 lg:col-span-7 lg:pb-52">
            <Photo
              photo="factoryFloor"
              sizes="(min-width: 1024px) 58vw, 100vw"
              aspect="landscape"
              rounded="xl"
              credit="top"
              alt="Garment workers checking and stacking finished pieces along a production line"
            />
            <div className="relative -mt-16 hidden px-6 sm:block md:mx-auto md:max-w-lg lg:absolute lg:bottom-0 lg:left-0 lg:mx-0 lg:mt-0 lg:w-[23rem] lg:max-w-none lg:-translate-x-6 lg:px-0 xl:w-[25rem]">
              <ProductionSnapshotMock />
            </div>
          </div>
        </div>
      </Section>

      {/* 06 Responsible and sustainable manufacturing */}
      <Section tone="surface" labelledBy="responsible-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="relative aspect-[16/9] min-w-0 overflow-hidden rounded-xl lg:col-span-5 lg:aspect-auto lg:min-h-[32rem]">
            <Photo
              photo="fabricRolls"
              sizes="(min-width: 1024px) 40vw, 100vw"
              fill
              rounded="xl"
              credit
              alt="Rolled knit fabrics in shades of green, blue and white"
            />
          </div>
          <div className="min-w-0 lg:col-span-7">
            <Kicker index="06" className="mb-7 lg:mb-9">Responsible manufacturing</Kicker>
            <h2 id="responsible-title" className="type-section scroll-mt-24 text-balance text-ink">
              Responsible production, written into the brief
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted sm:text-[1.0625rem]">
              Fashinza does not certify factories or publish impact figures. It gives brands practical controls that make
              standards enforceable and cut the waste of overproduction and rejected batches.
            </p>
            <dl className="mt-8 grid border-t border-line-strong sm:grid-cols-2 sm:gap-x-10">
              {RESPONSIBLE.map((r) => (
                <div key={r.title} className="border-b border-line py-4">
                  <dt className="font-display text-[1.0625rem] font-medium leading-6 text-ink">{r.title}</dt>
                  <dd className="mt-1 text-[13px] leading-5 text-ink-muted sm:text-sm sm:leading-6">{r.text}</dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="link" className="mt-6">
              <Link href="/sustainability">
                Our approach to sustainability <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}

/** Compact ruled list of what an audience can do: one column on phones, two from sm. */
function AbilityList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("grid border-t border-line-strong sm:grid-cols-2 sm:gap-x-8", className)}>
      {items.map((t) => (
        <li key={t} className="flex gap-3 border-b border-line py-3 text-sm leading-6 text-ink">
          <Check className="mt-1 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}
