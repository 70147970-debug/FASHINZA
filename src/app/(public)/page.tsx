import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileSearch,
  FileText,
  GitCompareArrows,
  Loader2,
  ScanSearch,
  Send,
  Users,
  Activity,
  Leaf,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckList, CtaBand, FeatureCard, Section, SectionHeading, WorkflowDiagram } from "@/components/site/marketing";
import { FaqList } from "@/components/site/faq-list";
import { FAQ } from "@/lib/faq";

const DEMO_STAGES = [
  { name: "Fabric sourcing", state: "done", date: "Completed 3 Mar" },
  { name: "Sampling", state: "done", date: "Completed 10 Mar" },
  { name: "Cutting", state: "done", date: "Completed 14 Mar" },
  { name: "Stitching", state: "active", date: "In progress" },
  { name: "Finishing", state: "todo", date: "Not started" },
  { name: "Quality control", state: "todo", date: "Not started" },
] as const;

function HeroPreview() {
  return (
    <div className="rounded-lg border border-line bg-white shadow-pop" aria-label="Example order tracking view with demo data">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <p className="text-xs text-muted">Order FZ-DEMO-0001</p>
          <p className="font-semibold text-navy">Organic cotton crew-neck tee</p>
        </div>
        <Badge tone="warning">Demo data</Badge>
      </div>
      <dl className="grid grid-cols-3 gap-3 border-b border-line px-5 py-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Quantity</dt>
          <dd className="font-medium">500 pcs</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Unit price</dt>
          <dd className="font-medium">USD 6.40</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Expected</dt>
          <dd className="font-medium">12 Apr</dd>
        </div>
      </dl>
      <ol className="space-y-3 px-5 py-4">
        {DEMO_STAGES.map((s) => (
          <li key={s.name} className="flex items-center gap-3 text-sm">
            {s.state === "done" && <CheckCircle2 className="size-4 text-success" aria-label="Completed" />}
            {s.state === "active" && <Loader2 className="size-4 text-teal" aria-label="In progress" />}
            {s.state === "todo" && <Circle className="size-4 text-line" aria-label="Not started" />}
            <span className={s.state === "todo" ? "text-muted" : "font-medium text-ink"}>{s.name}</span>
            <span className="ml-auto text-xs text-muted">{s.date}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const EXAMPLE_MATCHES = [
  { name: "Example Knit Unit A", place: "Lahore, PK", score: 91, notes: ["2 of 2 required processes", "GOTS verified", "35-day lead time, 90 days available"] },
  { name: "Example Knit Unit B", place: "Dhaka, BD", score: 74, notes: ["1 of 2 required processes (no screen printing)", "GOTS verified", "Outside preferred country"] },
];

function MatchPreview() {
  return (
    <div className="rounded-lg border border-line bg-white shadow-card" aria-label="Example factory matching result with illustrative data">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <p className="text-xs text-muted">Project · 500 organic cotton tees · GOTS required</p>
          <p className="font-semibold text-navy">2 verified factories matched</p>
        </div>
        <Badge tone="warning">Example data</Badge>
      </div>
      <ul className="divide-y divide-line">
        {EXAMPLE_MATCHES.map((m) => (
          <li key={m.name} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1 text-sm font-semibold text-navy">{m.name}<BadgeCheck className="size-4 text-success" aria-label="Verified" /></p>
                <p className="flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" aria-hidden />{m.place}</p>
              </div>
              <p className="tabular font-display text-xl font-semibold text-navy">{m.score}<span className="text-xs font-normal text-muted">/100</span></p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy-50" aria-hidden><div className="h-full rounded-full bg-teal" style={{ width: `${m.score}%` }} /></div>
            <ul className="mt-2 space-y-0.5 text-xs text-muted">{m.notes.map((n) => <li key={n}>· {n}</li>)}</ul>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">3 other factories excluded: MOQ above the order (1), lead time too long (1), no verified GOTS (1).</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-white">
        <div className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-700">B2B apparel manufacturing platform</p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              From tech pack to delivery, with every step in view.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
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
            <p className="mt-4 text-sm text-muted">Free to register. Manufacturers are listed only after an administrator reviews them.</p>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Workflow */}
      <Section labelledBy="workflow-title">
        <SectionHeading
          id="workflow-title"
          eyebrow="Production workflow"
          title="One workflow from requirements to delivery"
          description="Every project follows the same clear stages, and both sides see the same status."
        />
        <WorkflowDiagram />
      </Section>

      {/* Three steps */}
      <Section tone="white" labelledBy="steps-title">
        <SectionHeading id="steps-title" eyebrow="How it works" title="Three steps to get production moving" align="center" />
        <ol className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Send, title: "Submit requirements", text: "Describe the garment, quantity, fabric, sizes, target price and deadline, and attach your tech pack." },
            { icon: Users, title: "Connect with manufacturers", text: "Compatible manufacturers review your project and send quotations you can compare side by side." },
            { icon: Activity, title: "Track production", text: "Accept a quotation to create an order, then follow each milestone and quality-control result." },
          ].map((step, i) => (
            <li key={step.title} className="rounded-lg border border-line p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-navy text-sm font-semibold text-white">{i + 1}</span>
                <step.icon className="size-5 text-teal" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 text-center">
          <Button asChild variant="link">
            <Link href="/how-it-works">
              See the full process <ArrowRight />
            </Link>
          </Button>
        </div>
      </Section>

      {/* Benefits */}
      <Section labelledBy="benefits-title">
        <h2 id="benefits-title" className="sr-only">Benefits</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-white p-6 sm:p-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal-700">For fashion brands</p>
            <h3 className="mb-5 text-xl font-semibold">Less sourcing effort, more visibility</h3>
            <CheckList
              items={[
                "Shortlist manufacturers by category, quantity, capability and location instead of searching directories.",
                "See why each manufacturer was matched before you contact them.",
                "Compare quotations on price, minimum quantity, lead time and sampling cost in one table.",
                "Follow production milestones and quality-control results without chasing messages.",
              ]}
            />
            <Button asChild variant="outline" className="mt-6">
              <Link href="/for-brands">Learn more for brands</Link>
            </Button>
          </div>
          <div className="rounded-lg border border-line bg-white p-6 sm:p-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal-700">For manufacturers</p>
            <h3 className="mb-5 text-xl font-semibold">Requests that fit your factory</h3>
            <CheckList
              items={[
                "Receive project requests that match your categories, capacity and capabilities.",
                "Submit and revise structured quotations, with the history kept for both sides.",
                "Update production milestones from one dashboard instead of many chat threads.",
                "Show your verified profile and documents to brands looking for partners.",
              ]}
            />
            <Button asChild variant="outline" className="mt-6">
              <Link href="/for-manufacturers">Learn more for manufacturers</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* Features */}
      <Section tone="white" labelledBy="features-title">
        <SectionHeading
          id="features-title"
          eyebrow="Platform features"
          title="The tools a production run actually needs"
          description="Built around the four parts of manufacturing that cause the most back-and-forth."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={FileSearch} title="Factory matching">
            A transparent, rule-based engine filters verified factories on category, MOQ, capacity, lead time and
            certifications, then ranks them with a score and the reasons behind it.
          </FeatureCard>
          <FeatureCard icon={GitCompareArrows} title="Quotations">
            Manufacturers send structured quotes. Brands compare them side by side and accept one; the others are
            closed automatically.
          </FeatureCard>
          <FeatureCard icon={ClipboardCheck} title="Production tracking">
            Eight milestones from fabric sourcing to delivery, each gated by evidence or approval, with planned and
            actual dates and automatic delay warnings.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Quality control">
            AQL inspections follow ISO 2859-1 sampling plans. Defects are recorded by severity, the result is calculated,
            and a failed batch automatically opens a rework task.
          </FeatureCard>
        </div>
      </Section>

      {/* Matching preview */}
      <Section labelledBy="matching-title">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading
              id="matching-title"
              eyebrow="Factory matching"
              title="See why each factory was matched — and why others were not"
              description="Mandatory filters come first: verification, category, MOQ, capacity, lead time and required certifications. Eligible factories are then ranked with documented weights, and every score comes with its reasons."
            />
            <Button asChild variant="outline"><Link href="/how-it-works">How matching works</Link></Button>
          </div>
          <MatchPreview />
        </div>
      </Section>

      {/* Quality & sustainability */}
      <Section tone="white" labelledBy="quality-title">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-line p-6 sm:p-8">
            <ScanSearch className="size-6 text-teal" aria-hidden />
            <h2 id="quality-title" className="mt-3 text-xl font-semibold">Quality checked against a standard</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Samples are approved before bulk production. Inspections use ISO 2859-1 AQL sampling plans, so the number of
              units to inspect and the defects allowed are set by the standard, not by negotiation. Failed batches go back
              for rework, and every report is kept.
            </p>
          </div>
          <div className="rounded-lg border border-line p-6 sm:p-8">
            <Leaf className="size-6 text-teal" aria-hidden />
            <h2 className="mt-3 text-xl font-semibold">Certifications you can require</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Make GOTS, OEKO-TEX, Fairtrade, BCI and other certifications mandatory for a project. A certification only
              counts after an administrator has reviewed the certificate.
            </p>
            <Button asChild variant="link" className="mt-2"><Link href="/sustainability">Our approach to sustainability <ArrowRight /></Link></Button>
          </div>
        </div>
      </Section>

      {/* Trust / verification */}
      <Section labelledBy="trust-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <SectionHeading
            id="trust-title"
            eyebrow="Manufacturer verification"
            title="How manufacturers are reviewed"
            description="Verification is a manual step taken by a Fashinza administrator. It is never applied automatically."
          />
          <ol className="space-y-4">
            {[
              { icon: FileText, title: "Profile and documents submitted", text: "The manufacturer completes its business profile and uploads supporting documents, such as business registration or certificates." },
              { icon: ScanSearch, title: "Administrator review", text: "An administrator reviews the profile and documents and records an approval or a rejection with a reason." },
              { icon: BadgeCheck, title: "Verified badge shown", text: "Only approved manufacturers carry the verified badge. Certifications count in matching only after their document is verified." },
            ].map((item) => (
              <li key={item.title} className="flex gap-4 rounded-lg border border-line bg-white p-5">
                <item.icon className="mt-0.5 size-5 shrink-0 text-teal" aria-hidden />
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted">{item.text}</p>
                </div>
              </li>
            ))}
            <li className="text-sm text-muted">
              Verification confirms that documents were reviewed. It is not a guarantee of product quality or
              delivery, so brands should still approve samples before bulk production.
            </li>
          </ol>
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="white" labelledBy="faq-title">
        <div className="mx-auto max-w-3xl">
          <SectionHeading id="faq-title" eyebrow="FAQ" title="Common questions" align="center" />
          <FaqList items={FAQ.filter((f) => ["How are factories matched to my project?", "Who can see my designs and tech packs?", "How do payments work?", "Why am I not receiving any opportunities?"].includes(f.q))} />
          <p className="mt-6 text-center"><Button asChild variant="link"><Link href="/faq">All questions <ArrowRight /></Link></Button></p>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
