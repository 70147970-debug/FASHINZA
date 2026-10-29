import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, FileText, Leaf, ScanSearch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckList, CtaBand, Section, SectionHeading, StepList, WorkflowDiagram } from "@/components/site/marketing";
import { MatchMock, OrderOverviewMock, TrackingMock } from "@/components/site/product-mocks";
import { FaqList } from "@/components/site/faq-list";
import { FAQ } from "@/lib/faq";
import { CERTIFICATIONS } from "@/lib/constants";

const HOME_FAQ = ["How are factories matched to my project?", "Who can see my designs and tech packs?", "How do payments work?", "Why am I not receiving any opportunities?"];

const ASSURANCES = ["Free to register", "Manufacturers reviewed by an administrator", "Matching reasons always shown", "Sandbox payments, clearly labelled"];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_55%_70%_at_80%_35%,black,transparent_75%)]"
        />
        <div className="container-page relative grid gap-14 pb-14 pt-12 sm:pt-16 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pb-20 lg:pt-20">
          <div className="lg:col-span-6">
            <p className="eyebrow mb-7 flex items-center gap-3 text-accent-strong">
              <span className="h-px w-8 bg-accent" aria-hidden />
              B2B apparel manufacturing platform
            </p>
            <h1 className="text-balance font-display text-[2.625rem] font-[440] leading-[1.02] tracking-[-0.03em] text-ink min-[400px]:text-[3rem] sm:text-[3.75rem] lg:text-[4.25rem] xl:text-[4.75rem] xl:tracking-[-0.04em]">
              From tech pack to delivery, with{" "}
              <em className="font-[380] italic text-accent-strong">every step in view.</em>
            </h1>
            <p className="mt-7 max-w-xl text-pretty text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
              Fashinza helps fashion brands find compatible clothing manufacturers, compare quotations, and follow
              production and quality control in one place — so you spend less time chasing updates.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="accent" size="lg">
                <Link href="/register?role=brand">
                  Start a Project <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/register?role=manufacturer">Join as a Manufacturer</Link>
              </Button>
            </div>
          </div>
          <div className="min-w-0 lg:col-span-6 lg:pl-4">
            <OrderOverviewMock />
          </div>
        </div>
        <div className="container-page relative">
          <ul className="grid border-t border-line-strong text-[13px] leading-5 text-ink sm:grid-cols-2 lg:grid-cols-4">
            {ASSURANCES.map((t) => (
              <li
                key={t}
                className="flex items-center gap-2.5 border-b border-line py-4 sm:even:pl-6 lg:border-b-0 lg:px-6 lg:py-5 lg:first:pl-0 lg:[&:not(:first-child)]:border-l"
              >
                <Check className="size-4 shrink-0 text-accent" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 01 Workflow */}
      <Section labelledBy="workflow-title">
        <SectionHeading
          id="workflow-title"
          index="01"
          eyebrow="Production workflow"
          title="One workflow from requirements to delivery"
          description="Every project follows the same clear stages, and both sides see the same status."
          split
        >
          <Button asChild variant="link" className="px-0">
            <Link href="/how-it-works">
              See the full process <ArrowRight />
            </Link>
          </Button>
        </SectionHeading>
        <WorkflowDiagram />
      </Section>

      {/* 02 Benefits — a two-column spread */}
      <Section tone="surface" labelledBy="benefits-title">
        <SectionHeading
          id="benefits-title"
          index="02"
          eyebrow="Who it is for"
          title="Built for both sides of the order"
          description="Brands and manufacturers work from the same project, quotation and order — each with the tools their role needs."
          split
        />
        <div className="grid border-t border-line-strong lg:grid-cols-2">
          <div className="flex flex-col pt-8 lg:pr-12 lg:pt-10">
            <p className="eyebrow text-ink-muted">For fashion brands</p>
            <h3 className="mt-3 font-display text-[1.75rem] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[2rem]">
              Less sourcing effort, <em className="font-normal italic">more visibility</em>
            </h3>
            <CheckList
              className="mt-7 flex-1"
              items={[
                "Shortlist manufacturers by category, quantity, capability and location instead of searching directories.",
                "See why each manufacturer was matched before you contact them.",
                "Compare quotations on price, minimum quantity, lead time and sampling cost in one table.",
                "Follow production milestones and quality-control results without chasing messages.",
              ]}
            />
            <Button asChild variant="outline" className="mt-8 self-start">
              <Link href="/for-brands">Learn more for brands <ArrowRight /></Link>
            </Button>
          </div>
          <div className="mt-12 flex flex-col border-t border-line pt-8 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-10">
            <p className="eyebrow text-ink-muted">For manufacturers</p>
            <h3 className="mt-3 font-display text-[1.75rem] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[2rem]">
              Requests that <em className="font-normal italic">fit your factory</em>
            </h3>
            <CheckList
              className="mt-7 flex-1"
              items={[
                "Receive project requests that match your categories, capacity and capabilities.",
                "Submit and revise structured quotations, with the history kept for both sides.",
                "Update production milestones from one dashboard instead of many chat threads.",
                "Show your verified profile and documents to brands looking for partners.",
              ]}
            />
            <Button asChild variant="outline" className="mt-8 self-start">
              <Link href="/for-manufacturers">Learn more for manufacturers <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* 03 Matching preview */}
      <Section labelledBy="matching-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-10">
          <div className="lg:col-span-5">
            <SectionHeading
              id="matching-title"
              index="03"
              eyebrow="Factory matching"
              title="See why each factory was matched — and why others were not"
              description="A transparent, rule-based engine. No black box: every score comes with its reasons."
              className="mb-8 lg:mb-10"
            />
            <StepList
              items={[
                { title: "Mandatory filters first", text: "Verification, category, MOQ, capacity, lead time and required certifications. A factory that fails one is excluded, not just ranked lower." },
                { title: "Ranked with documented weights", text: "Eligible factories are scored on processes, fabric, capacity, lead time, location and track record." },
                { title: "Reasons shown with every score", text: "Brands see what matched and what did not before inviting anyone to quote." },
              ]}
            />
            <Button asChild variant="outline" className="mt-8"><Link href="/how-it-works">How matching works</Link></Button>
          </div>
          <div className="min-w-0 lg:col-span-6 lg:col-start-7 lg:pt-24">
            <MatchMock />
          </div>
        </div>
      </Section>

      {/* 04 Production tracking preview */}
      <Section tone="surface" labelledBy="tracking-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-10">
          <div className="lg:order-2 lg:col-span-5 lg:col-start-8 lg:pl-4">
            <SectionHeading
              id="tracking-title"
              index="04"
              eyebrow="Production tracking"
              title="Every milestone, inspection and payment in one view"
              description="Accepting a quotation creates an order with eight milestones, from fabric sourcing to delivery."
              className="mb-8"
            />
            <CheckList
              items={[
                "Milestones complete in order, each with its required evidence or approval.",
                "Planned and actual dates side by side, with automatic delay warnings.",
                "Payment milestones (30% / 40% / 30% by default) fall due as stages complete.",
                "Both sides see the same status, so nobody has to ask for an update.",
              ]}
            />
          </div>
          <div className="min-w-0 lg:order-1 lg:col-span-7 lg:pt-24">
            <TrackingMock />
          </div>
        </div>
      </Section>

      {/* 05 Quality & sustainability */}
      <Section labelledBy="quality-title">
        <SectionHeading
          id="quality-title"
          index="05"
          eyebrow="Quality and sustainability"
          title="Standards you can hold a factory to"
          description="Quality is checked against a published standard, and certifications count only once a person has reviewed the document."
          split
        />
        <div className="grid gap-12 border-t border-line-strong pt-8 lg:grid-cols-2 lg:gap-0 lg:pt-10">
          <article className="lg:pr-12">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-[1.5rem] font-medium tracking-[-0.015em] text-ink">Quality checked against a standard</h3>
              <ScanSearch className="size-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="mt-4 max-w-[60ch] text-[0.9375rem] leading-7 text-ink-muted">
              Samples are approved before bulk production. Inspections use ISO 2859-1 AQL sampling plans, so the number of
              units to inspect and the defects allowed are set by the standard, not by negotiation. Failed batches go back
              for rework, and every report is kept.
            </p>
            <dl className="mt-7 grid grid-cols-3 divide-x divide-line border-y border-line">
              {[["Sampling plan", "ISO 2859-1"], ["Defects", "By severity"], ["Failed batch", "Rework task"]].map(([k, v]) => (
                <div key={k} className="px-3 py-4 first:pl-0">
                  <dt className="label-caps text-ink-muted">{k}</dt>
                  <dd className="mt-1.5 font-display text-base font-medium text-ink sm:text-lg">{v}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="border-t border-line pt-10 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-[1.5rem] font-medium tracking-[-0.015em] text-ink">Certifications you can require</h3>
              <Leaf className="size-5 shrink-0 text-accent" strokeWidth={1.5} aria-hidden />
            </div>
            <p className="mt-4 max-w-[60ch] text-[0.9375rem] leading-7 text-ink-muted">
              Make GOTS, OEKO-TEX, Fairtrade, BCI and other certifications mandatory for a project. A certification only
              counts after an administrator has reviewed the certificate.
            </p>
            <ul className="mt-7 flex flex-wrap gap-2" aria-label="Supported certifications">
              {CERTIFICATIONS.map((c) => (
                <li key={c} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-xs font-medium text-ink">
                  <ShieldCheck className="size-3.5 text-ink-muted" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-6 px-0"><Link href="/sustainability">Our approach to sustainability <ArrowRight /></Link></Button>
          </article>
        </div>
      </Section>

      {/* 06 Trust / verification */}
      <Section tone="surface" labelledBy="trust-title">
        <SectionHeading
          id="trust-title"
          index="06"
          eyebrow="Manufacturer verification"
          title="How manufacturers are reviewed"
          description="Verification is a manual step taken by a Fashinza administrator. It is never applied automatically."
          split
        />
        <StepList
          horizontal
          items={[
            { icon: FileText, title: "Profile and documents submitted", text: "The manufacturer completes its business profile and uploads supporting documents, such as business registration or certificates." },
            { icon: ScanSearch, title: "Administrator review", text: "An administrator reviews the profile and documents and records an approval or a rejection with a reason." },
            { icon: BadgeCheck, title: "Verified badge shown", text: "Only approved manufacturers carry the verified badge. Certifications count in matching only after their document is verified." },
          ]}
        />
        <p className="mt-12 flex max-w-3xl gap-3 border-l-2 border-info pl-4 text-sm leading-6 text-ink-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          Verification confirms that documents were reviewed. It is not a guarantee of product quality or delivery, so
          brands should still approve samples before bulk production.
        </p>
      </Section>

      {/* 07 FAQ */}
      <Section labelledBy="faq-title">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHeading
            id="faq-title"
            index="07"
            eyebrow="FAQ"
            title="Common questions"
            description="How matching, file access, payments and opportunities work."
            className="lg:col-span-4 lg:mb-0"
          >
            <Button asChild variant="outline"><Link href="/faq">All questions <ArrowRight /></Link></Button>
          </SectionHeading>
          <div className="lg:col-span-7 lg:col-start-6 lg:pt-[3.75rem]">
            <FaqList items={FAQ.filter((f) => HOME_FAQ.includes(f.q))} />
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
