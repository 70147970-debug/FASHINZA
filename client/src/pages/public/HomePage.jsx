import { Link } from "react-router";
import { ArrowDown, ArrowRight, BadgeCheck, Check, ClipboardCheck, FileText, Leaf, PackageCheck, Ruler, Scissors, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { CtaBand, ON_PHOTO_OUTLINE, PhotoCredit, Section, SectionHeading, WRAP_ON_PHONE } from "@/components/site/marketing";
import { FaqList } from "@/components/site/faq-list";
import { ProductionSnapshotMock } from "@/components/site/product-mocks";
import { GARMENT_CATEGORIES } from "@fashinza/shared/constants.js";
import { FAQ } from "@fashinza/shared/faq.js";
import { cn } from "@fashinza/shared/utils.js";
import { PageMeta } from "@/components/meta";

const HERO_FACTS = ["Free to register", "Factories reviewed by a person", "Matching reasons always shown"];

/** The two ways in. Each card is a short, numbered "what happens next" for that audience. */
const PATHS = [
  {
    photo: "designersSampleFitting",
    position: "55% 35%",
    alt: "Two designers pinning a sample bodice on a dress form in a studio",
    audience: "I'm a fashion brand",
    title: "Turn a design into a finished collection",
    steps: [
      "Brief your garment: category, fabric, sizes, quantity and tech pack",
      "Compare itemised quotations from verified factories that fit",
      "Approve samples, then follow production to delivery",
    ],
    cta: "Start Your Manufacturing Project",
    href: "/register?role=brand",
    more: "More for brands",
    moreHref: "/for-brands",
  },
  {
    photo: "factorySewingLines",
    position: "68% center",
    alt: "Machinists at industrial sewing stations beside stacks of cut fabric in a garment factory",
    audience: "I'm a garment manufacturer",
    title: "Receive projects that fit your floor",
    steps: [
      "List your categories, machinery, MOQ and monthly capacity",
      "Get verified, then receive matching production requests",
      "Quote, submit samples and update progress with photos",
    ],
    cta: "Join as a Manufacturer",
    href: "/register?role=manufacturer",
    more: "More for manufacturers",
    moreHref: "/for-manufacturers",
  },
];

/** The nine-step journey, grouped into four phases a first-time visitor can take in at a glance. */
const PHASES = [
  { icon: FileText, title: "Brief", text: "Describe the garment once, with sketches, reference images and a measurement chart." },
  { icon: Users, title: "Match & quote", text: "Verified factories that fit your order are matched by clear rules and send itemised quotes." },
  { icon: Scissors, title: "Sample & produce", text: "Approve the sample, then watch cutting, stitching and finishing milestone by milestone." },
  { icon: PackageCheck, title: "Inspect & deliver", text: "An AQL quality inspection before shipment, then tracking until you confirm delivery." },
];

const CAPABILITIES = [
  { photo: "designSketches", position: "62% center", title: "Sampling", text: "Pattern making and samples, approved before bulk." },
  { photo: "fabricCutting", position: "45% 40%", title: "Cutting", text: "Fabric laid and cut to pattern." },
  { photo: "heroSewing", position: "55% 62%", title: "Stitching", text: "Knitted and woven garments sewn on the line." },
  { photo: "finishedGarments", position: "72% center", title: "Finishing", text: "Washing, dyeing, pressing, labels and packing." },
  { photo: "qualityInspection", position: "38% center", title: "Quality control", text: "ISO 2859-1 AQL inspection, with rework." },
];

const RESPONSIBLE = [
  {
    icon: BadgeCheck,
    title: "Certifications you can require",
    text: "Make GOTS, OEKO-TEX or Fairtrade mandatory. A certificate counts only after an administrator has checked it.",
  },
  {
    icon: Ruler,
    title: "Order what you need",
    text: "Set the highest minimum order you can accept and meet factories that take smaller runs, instead of over-ordering.",
  },
  {
    icon: ClipboardCheck,
    title: "Fewer rejected batches",
    text: "Samples are approved before bulk, and inspection happens at the factory, where defects can still be reworked.",
  },
];

const FIRST_QUESTIONS = ["What do I need to start a project?", "How are factories matched to my project?", "How do samples work?", "How do payments work?"];

export default function HomePage() {
  const firstQuestions = FIRST_QUESTIONS.map((q) => FAQ.find((f) => f.q === q)).filter((f) => f !== undefined);

  return (
    <>
      <PageMeta />
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
        <div className="container-page relative flex min-h-[36rem] flex-col justify-end pb-12 pt-20 sm:min-h-[40rem] lg:min-h-[min(44rem,calc(100svh-4rem))] lg:justify-center lg:py-24">
          <div className="max-w-[38rem]">
            <p className="eyebrow flex items-center gap-3 text-ink-inverse">
              <span className="h-px w-8 bg-taupe" aria-hidden />
              Garment manufacturing for fashion brands
            </p>
            <h1
              id="hero-title"
              className="mt-6 text-balance font-display text-[2.75rem] font-medium leading-[1.02] tracking-[-0.02em] text-ink-inverse min-[400px]:text-[3.125rem] sm:text-[4rem] lg:text-[4.5rem] xl:text-[5.25rem] xl:tracking-[-0.03em]"
            >
              From Fashion Ideas to <em className="font-normal italic text-taupe">Finished Garments.</em>
            </h1>
            <p className="mt-6 max-w-[31rem] text-pretty text-base leading-7 text-ink-inverse sm:text-lg sm:leading-8">
              Fashinza matches fashion brands with garment factories that suit their category, fabric and order size, then follows every order from sample to
              delivery.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild variant="accent" size="lg" className={WRAP_ON_PHONE}>
                <Link to="/register?role=brand">
                  Start Your Manufacturing Project <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className={cn(ON_PHOTO_OUTLINE, WRAP_ON_PHONE)}>
                <Link to="/register?role=manufacturer">Join as a Manufacturer</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2">
              {HERO_FACTS.map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-1.5 rounded-full border border-ink-inverse/25 bg-scrim/40 px-3 py-1.5 text-[13px] leading-5 text-ink-inverse backdrop-blur-sm"
                >
                  <Check className="size-3.5 shrink-0 text-accent-inverse" strokeWidth={2.25} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <a
              href="#start"
              className="mt-10 inline-flex items-center gap-2 rounded-xs text-sm font-medium text-ink-inverse underline-offset-4 hover:underline"
            >
              New here? See how it works <ArrowDown className="size-4 motion-safe:animate-bounce" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* Garment categories: a quick "yes, they make my kind of clothing" for first-time visitors. */}
      <div className="border-b border-line bg-surface">
        <div className="container-page flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-6">
          <p className="eyebrow shrink-0 text-ink-muted">Garments you can brief</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 font-display text-base text-ink sm:text-[1.0625rem]">
            {GARMENT_CATEGORIES.map((c) => (
              <li key={c.value}>{c.label}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 01 Choose your path: brands and manufacturers, side by side. */}
      <Section id="start" labelledBy="start-title">
        <SectionHeading
          id="start-title"
          index="01"
          eyebrow="Start here"
          title="How will you use Fashinza?"
          description="Choose your side to see what happens after you sign up. Both are free, and you can read more before you register."
          split
        />
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {PATHS.map((p) => (
            <article
              key={p.audience}
              className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-shadow duration-300 hover:shadow-md"
            >
              <Photo
                photo={p.photo}
                sizes="(min-width: 1024px) 45vw, 100vw"
                aspect="landscape"
                rounded="none"
                position={p.position}
                overlay="bottom"
                credit="top"
                alt={p.alt}
                imageClassName="transition-transform duration-700 motion-safe:group-hover:scale-[1.03]"
                contentClassName="p-5 sm:p-7"
              >
                <p className="eyebrow text-ink-inverse">{p.audience}</p>
                <h3 className="mt-2 text-balance font-display text-[1.625rem] font-medium leading-tight tracking-[-0.015em] text-ink-inverse sm:text-[2rem]">
                  {p.title}
                </h3>
              </Photo>
              <div className="flex flex-1 flex-col p-5 sm:p-7">
                <ol className="space-y-4">
                  {p.steps.map((s, i) => (
                    <li key={s} className="flex gap-4">
                      <span
                        aria-hidden
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-[0.9375rem] font-medium text-accent-strong tabular"
                      >
                        {i + 1}
                      </span>
                      <span className="pt-1 text-[0.9375rem] leading-6 text-ink">{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:gap-6">
                  <Button asChild size="lg" className={cn("self-start", WRAP_ON_PHONE)}>
                    <Link to={p.href}>
                      {p.cta} <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild variant="link">
                    <Link to={p.moreHref}>{p.more}</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* 02 The manufacturing journey, in four phases. */}
      <Section tone="surface" labelledBy="journey-title">
        <SectionHeading
          id="journey-title"
          index="02"
          eyebrow="The manufacturing journey"
          title="From brief to delivery in four phases"
          description="Brand and factory work from one shared order, so both always see the same status, from the first tech pack to the final shipment."
          split
        >
          <Button asChild variant="link">
            <Link to="/how-it-works">
              See all nine steps <ArrowRight />
            </Link>
          </Button>
        </SectionHeading>
        <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* The thread joining the four phases (lg+). */}
          <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-10 hidden border-t border-dashed border-line-strong lg:block" />
          {PHASES.map((ph, i) => (
            // Phones: icon beside the text, so the four phases stay short. sm+: centred cards.
            <li key={ph.title} className="relative flex gap-4 rounded-xl border border-line bg-canvas p-5 sm:block sm:p-6 sm:text-center">
              <span className="relative grid size-12 shrink-0 place-items-center rounded-full border border-accent-line bg-surface text-accent-strong sm:mx-auto sm:size-16 lg:-mt-14 lg:mb-1">
                <ph.icon className="size-5 sm:size-6" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm italic text-ink-muted tabular sm:mt-4" aria-hidden>
                  Phase {i + 1}
                </p>
                <h3 className="mt-0.5 font-display text-[1.25rem] font-medium tracking-[-0.01em] text-ink sm:mt-1 sm:text-[1.375rem]">{ph.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-6 text-ink-muted sm:mt-2">{ph.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* 03 Manufacturing capabilities: a dark gallery band, a swipeable row on phones and tablets. */}
      <section aria-labelledby="capabilities-title" className="bg-inverse py-16 lg:py-24">
        <div className="container-page">
          <div className="mb-10 grid gap-5 lg:mb-14 lg:grid-cols-12 lg:items-end lg:gap-10">
            <div className="lg:col-span-7">
              <p className="eyebrow mb-5 flex items-center gap-3 text-accent-inverse">
                <span className="font-display text-[0.9375rem] normal-case italic tracking-normal text-ink-inverse tabular" aria-hidden>
                  03
                </span>
                Manufacturing capabilities
              </p>
              <h2 id="capabilities-title" className="type-section scroll-mt-24 text-balance text-ink-inverse">
                Every stage of garment making
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-ink-inverse-muted sm:text-[1.0625rem] lg:col-span-5 lg:pb-1.5">
              Factories list the processes they offer, and matching compares them with what your garment needs, from the sampling room to the finishing line.
            </p>
          </div>
          <div
            role="region"
            aria-label="Manufacturing capabilities"
            tabIndex={0}
            className="-mx-4 scroll-px-4 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-offset-[-2px] sm:-mx-6 sm:scroll-px-6 lg:mx-0 lg:overflow-visible lg:pb-0"
          >
            <ul className="flex snap-x snap-mandatory gap-4 px-4 sm:px-6 lg:grid lg:grid-cols-5 lg:gap-5 lg:px-0">
              {CAPABILITIES.map((c, i) => (
                <li key={c.title} className="group w-[72%] shrink-0 snap-start min-[480px]:w-[46%] sm:w-[38%] lg:w-auto">
                  <Photo
                    photo={c.photo}
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 38vw, 72vw"
                    aspect="portrait"
                    position={c.position}
                    overlay="bottom"
                    credit="top"
                    decorative
                    imageClassName="transition-transform duration-700 motion-safe:group-hover:scale-[1.04]"
                    contentClassName="p-4 sm:p-5"
                  >
                    <span className="font-display text-sm italic text-ink-inverse tabular" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-display text-[1.375rem] font-medium leading-7 tracking-[-0.01em] text-ink-inverse">{c.title}</h3>
                  </Photo>
                  <p className="mt-3 text-[13px] leading-5 text-ink-inverse-muted">{c.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 04 Production tracking and supply-chain transparency */}
      <Section labelledBy="tracking-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="min-w-0 lg:col-span-5">
            <SectionHeading
              id="tracking-title"
              index="04"
              eyebrow="Production tracking"
              title="Always know where your order is"
              description="Each order runs through eight production milestones. A milestone is completed with photos, a document or an approval, so progress is never a matter of opinion."
              className="mb-8"
            />
            <ul className="space-y-3">
              {[
                "Planned and actual dates side by side, with delays flagged",
                "Sample rounds, inspection reports and shipment tracking in one place",
                "Brand and factory always see the same status",
              ].map((t) => (
                <li key={t} className="flex gap-3 text-[0.9375rem] leading-6 text-ink">
                  <Check className="mt-1 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-6">
              <Link to="/how-it-works">
                How production tracking works <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="relative min-w-0 lg:col-span-7 lg:pb-72">
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

      {/* 05 Responsible and sustainable manufacturing */}
      <Section tone="surface" labelledBy="responsible-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
          <div className="relative aspect-[16/9] min-w-0 overflow-hidden rounded-xl lg:col-span-5 lg:aspect-[4/5]">
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
            <SectionHeading
              id="responsible-title"
              index="05"
              eyebrow="Responsible manufacturing"
              title="Responsible production, written into the brief"
              description="Fashinza does not certify factories or publish impact figures. It gives brands practical controls that make standards enforceable and cut waste."
              className="mb-8"
            />
            <ul className="grid gap-4">
              {RESPONSIBLE.map((r) => (
                <li key={r.title} className="flex gap-4 rounded-xl border border-line bg-canvas p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-strong">
                    <r.icon className="size-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-[1.125rem] font-medium leading-6 text-ink">{r.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">{r.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-6">
              <Link to="/sustainability">
                <Leaf /> Our approach to sustainability
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* 06 First questions, answered before sign-up. */}
      <Section labelledBy="questions-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <SectionHeading id="questions-title" index="06" eyebrow="New to Fashinza?" title="Questions people ask first" className="mb-6" />
            <Button asChild variant="outline">
              <Link to="/faq">
                Read all questions <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <FaqList items={firstQuestions} />
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
