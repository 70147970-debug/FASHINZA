import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, FileText, Leaf, ScanSearch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckList, CtaBand, Section, SectionHeading, StepList, WorkflowDiagram } from "@/components/site/marketing";
import { MatchMock, OrderOverviewMock, TrackingMock } from "@/components/site/product-mocks";
import { FaqList } from "@/components/site/faq-list";
import { FAQ } from "@/lib/faq";
import { CERTIFICATIONS } from "@/lib/constants";

const HOME_FAQ = ["How are factories matched to my project?", "Who can see my designs and tech packs?", "How do payments work?", "Why am I not receiving any opportunities?"];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dot-grid opacity-70 [mask-image:radial-gradient(ellipse_70%_80%_at_75%_30%,black,transparent_75%)]"
        />
        <div className="container-page relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-24">
          <div className="max-w-xl">
            <p className="eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-teal-700 shadow-card">
              <span className="size-1.5 rounded-full bg-teal" aria-hidden />
              B2B apparel manufacturing platform
            </p>
            <h1 className="type-display text-balance text-navy">From tech pack to delivery, with every step in view.</h1>
            <p className="mt-6 text-base leading-7 text-muted sm:text-lg sm:leading-8">
              Fashinza helps fashion brands find compatible clothing manufacturers, compare quotations, and follow
              production and quality control in one place — so you spend less time chasing updates.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="accent" size="lg">
                <Link href="/register?role=brand">
                  Start a Project <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/register?role=manufacturer">Join as a Manufacturer</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["Free to register", "Manufacturers reviewed by an administrator", "Matching reasons always shown", "Sandbox payments, clearly labelled"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-teal" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <OrderOverviewMock />
        </div>
      </section>

      {/* Workflow */}
      <Section labelledBy="workflow-title">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="workflow-title"
            eyebrow="Production workflow"
            title="One workflow from requirements to delivery"
            description="Every project follows the same clear stages, and both sides see the same status."
            className="mb-0 lg:mb-12"
          />
          <Button asChild variant="link" className="mb-8 self-start lg:mb-14 lg:self-auto">
            <Link href="/how-it-works">
              See the full process <ArrowRight />
            </Link>
          </Button>
        </div>
        <WorkflowDiagram />
      </Section>

      {/* Benefits */}
      <Section tone="white" labelledBy="benefits-title">
        <SectionHeading
          id="benefits-title"
          eyebrow="Who it is for"
          title="Built for both sides of the order"
          description="Brands and manufacturers work from the same project, quotation and order — each with the tools their role needs."
        />
        <div className="grid overflow-hidden rounded-lg border border-line shadow-card lg:grid-cols-2">
          <div className="bg-white p-6 sm:p-8 lg:p-10">
            <p className="eyebrow mb-2 text-teal-700">For fashion brands</p>
            <h3 className="font-display text-xl font-semibold text-navy">Less sourcing effort, more visibility</h3>
            <CheckList
              className="mt-6"
              items={[
                "Shortlist manufacturers by category, quantity, capability and location instead of searching directories.",
                "See why each manufacturer was matched before you contact them.",
                "Compare quotations on price, minimum quantity, lead time and sampling cost in one table.",
                "Follow production milestones and quality-control results without chasing messages.",
              ]}
            />
            <Button asChild variant="outline" className="mt-8">
              <Link href="/for-brands">Learn more for brands <ArrowRight /></Link>
            </Button>
          </div>
          <div className="border-t border-line bg-canvas p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <p className="eyebrow mb-2 text-teal-700">For manufacturers</p>
            <h3 className="font-display text-xl font-semibold text-navy">Requests that fit your factory</h3>
            <CheckList
              className="mt-6"
              items={[
                "Receive project requests that match your categories, capacity and capabilities.",
                "Submit and revise structured quotations, with the history kept for both sides.",
                "Update production milestones from one dashboard instead of many chat threads.",
                "Show your verified profile and documents to brands looking for partners.",
              ]}
            />
            <Button asChild variant="outline" className="mt-8">
              <Link href="/for-manufacturers">Learn more for manufacturers <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* Matching preview */}
      <Section labelledBy="matching-title">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <SectionHeading
              id="matching-title"
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
          <MatchMock />
        </div>
      </Section>

      {/* Production tracking preview */}
      <Section tone="white" labelledBy="tracking-title">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:order-2">
            <SectionHeading
              id="tracking-title"
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
          <div className="lg:order-1">
            <TrackingMock />
          </div>
        </div>
      </Section>

      {/* Quality & sustainability */}
      <Section labelledBy="quality-title">
        <SectionHeading
          id="quality-title"
          eyebrow="Quality and sustainability"
          title="Standards you can hold a factory to"
          description="Quality is checked against a published standard, and certifications count only once a person has reviewed the document."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-lg border border-line bg-white p-6 shadow-card sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-md bg-teal-50 text-teal-700"><ScanSearch className="size-[18px]" aria-hidden /></span>
              <h3 className="font-display text-lg font-semibold text-navy">Quality checked against a standard</h3>
            </div>
            <p className="mt-4 text-[0.9375rem] leading-7 text-muted">
              Samples are approved before bulk production. Inspections use ISO 2859-1 AQL sampling plans, so the number of
              units to inspect and the defects allowed are set by the standard, not by negotiation. Failed batches go back
              for rework, and every report is kept.
            </p>
            <dl className="mt-6 grid grid-cols-3 divide-x divide-line-subtle rounded-lg border border-line bg-surface-muted text-center">
              {[["Sampling plan", "ISO 2859-1"], ["Defects", "By severity"], ["Failed batch", "Rework task"]].map(([k, v]) => (
                <div key={k} className="px-2 py-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 text-[13px] font-semibold text-navy">{v}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="rounded-lg border border-line bg-white p-6 shadow-card sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-md bg-teal-50 text-teal-700"><Leaf className="size-[18px]" aria-hidden /></span>
              <h3 className="font-display text-lg font-semibold text-navy">Certifications you can require</h3>
            </div>
            <p className="mt-4 text-[0.9375rem] leading-7 text-muted">
              Make GOTS, OEKO-TEX, Fairtrade, BCI and other certifications mandatory for a project. A certification only
              counts after an administrator has reviewed the certificate.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Supported certifications">
              {CERTIFICATIONS.map((c) => (
                <li key={c} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 text-xs font-medium text-navy">
                  <ShieldCheck className="size-3.5 text-teal" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
            <Button asChild variant="link" className="mt-6"><Link href="/sustainability">Our approach to sustainability <ArrowRight /></Link></Button>
          </article>
        </div>
      </Section>

      {/* Trust / verification */}
      <Section tone="white" labelledBy="trust-title">
        <SectionHeading
          id="trust-title"
          eyebrow="Manufacturer verification"
          title="How manufacturers are reviewed"
          description="Verification is a manual step taken by a Fashinza administrator. It is never applied automatically."
        />
        <StepList
          horizontal
          items={[
            { icon: FileText, title: "Profile and documents submitted", text: "The manufacturer completes its business profile and uploads supporting documents, such as business registration or certificates." },
            { icon: ScanSearch, title: "Administrator review", text: "An administrator reviews the profile and documents and records an approval or a rejection with a reason." },
            { icon: BadgeCheck, title: "Verified badge shown", text: "Only approved manufacturers carry the verified badge. Certifications count in matching only after their document is verified." },
          ]}
        />
        <p className="mt-10 flex max-w-3xl gap-3 rounded-lg border border-line bg-surface-muted px-4 py-3.5 text-sm leading-6 text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-blue" aria-hidden />
          Verification confirms that documents were reviewed. It is not a guarantee of product quality or delivery, so
          brands should still approve samples before bulk production.
        </p>
      </Section>

      {/* FAQ */}
      <Section labelledBy="faq-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <SectionHeading id="faq-title" eyebrow="FAQ" title="Common questions" description="How matching, file access, payments and opportunities work." className="lg:mb-0">
            <Button asChild variant="outline"><Link href="/faq">All questions <ArrowRight /></Link></Button>
          </SectionHeading>
          <FaqList items={FAQ.filter((f) => HOME_FAQ.includes(f.q))} />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
