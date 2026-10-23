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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckList, CtaBand, FeatureCard, Section, SectionHeading, WorkflowDiagram } from "@/components/site/marketing";

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

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-white">
        <div className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal">B2B apparel manufacturing platform</p>
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
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal">For fashion brands</p>
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
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal">For manufacturers</p>
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
            A transparent, rule-based engine checks category, quantity, capacity, capabilities, location and
            certifications, then shows a compatibility score with the reasons behind it.
          </FeatureCard>
          <FeatureCard icon={GitCompareArrows} title="Quotations">
            Manufacturers send structured quotes. Brands compare them side by side and accept one; the others are
            closed automatically.
          </FeatureCard>
          <FeatureCard icon={ClipboardCheck} title="Production tracking">
            Eight milestones from fabric sourcing to delivery, each with timestamps, notes, supporting files and any
            reported delay.
          </FeatureCard>
          <FeatureCard icon={ScanSearch} title="Quality control">
            Inspection reports record sample size, defects and a pass or fail result, with the observed defect rate
            calculated for you.
          </FeatureCard>
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

      <CtaBand />
    </>
  );
}
