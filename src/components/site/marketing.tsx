import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Factory,
  FileText,
  PackageCheck,
  Ruler,
  Scissors,
  ShieldCheck,
  Truck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Section({
  className,
  tone = "default",
  children,
  id,
  labelledBy,
}: {
  className?: string;
  tone?: "default" | "white" | "navy";
  children: React.ReactNode;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "py-14 sm:py-20",
        tone === "white" && "bg-white",
        tone === "navy" && "bg-navy text-white",
        className,
      )}
    >
      <div className="container-page">{children}</div>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  inverted = false,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  inverted?: boolean;
}) {
  return (
    <div className={cn("mb-10 max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p className={cn("mb-2 text-sm font-semibold uppercase tracking-wide", inverted ? "text-teal-50" : "text-teal")}>
          {eyebrow}
        </p>
      )}
      <h2 id={id} className={cn("text-2xl font-semibold sm:text-3xl", inverted && "text-white")}>
        {title}
      </h2>
      {description && <p className={cn("mt-3 text-base", inverted ? "text-white/75" : "text-muted")}>{description}</p>}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-line bg-white py-14 sm:py-20">
      <div className="container-page max-w-3xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-teal">{eyebrow}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mt-4 text-lg text-muted">{description}</p>
        {children && <div className="mt-8 flex flex-col gap-3 sm:flex-row">{children}</div>}
      </div>
    </section>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="mb-4 grid size-10 place-items-center rounded-md bg-teal-50 text-teal">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export function CheckList({ items, inverted = false }: { items: string[]; inverted?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed">
          <ShieldCheck className={cn("mt-0.5 size-4 shrink-0", inverted ? "text-teal-50" : "text-teal")} aria-hidden />
          <span className={inverted ? "text-white/85" : "text-ink"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const WORKFLOW: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: ClipboardList, title: "Requirements", detail: "Brand submits garment, quantity, fabric and deadline" },
  { icon: Factory, title: "Matching", detail: "Compatible manufacturers are shortlisted with reasons" },
  { icon: FileText, title: "Quotations", detail: "Manufacturers quote; the brand compares and accepts one" },
  { icon: Ruler, title: "Sampling", detail: "Samples are produced and approved before bulk" },
  { icon: Scissors, title: "Production", detail: "Cutting, stitching and finishing tracked by milestone" },
  { icon: PackageCheck, title: "Quality control", detail: "Inspection results and defect rate recorded" },
  { icon: Truck, title: "Delivery", detail: "Order shipped and confirmed as delivered" },
];

/** Visual explanation of the production workflow — vertical on phones, horizontal on large screens. */
export function WorkflowDiagram() {
  return (
    <ol className="grid gap-3 lg:grid-cols-7 lg:gap-0">
      {WORKFLOW.map((step, i) => (
        <li key={step.title} className="relative flex gap-4 lg:flex-col lg:items-center lg:gap-3 lg:px-2 lg:text-center">
          {i < WORKFLOW.length - 1 && (
            <span
              aria-hidden
              className="absolute left-5 top-11 h-[calc(100%-1.75rem)] w-px bg-line lg:left-[calc(50%+1.75rem)] lg:top-5 lg:h-px lg:w-[calc(100%-3.5rem)]"
            />
          )}
          <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white text-navy">
            <step.icon className="size-5" aria-hidden />
          </span>
          <div className="pb-2">
            <p className="text-xs font-medium text-muted">Step {i + 1}</p>
            <p className="font-semibold text-navy">{step.title}</p>
            <p className="mt-1 text-sm text-muted">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CtaBand({
  title = "Ready to start your next production run?",
  description = "Create a free account to submit your first project, or register your factory to start receiving requests.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Section tone="navy" labelledBy="cta-title">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2 id="cta-title" className="text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-white/75">{description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="accent" size="lg">
            <Link href="/register?role=brand">
              Start a Project <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10">
            <Link href="/register?role=manufacturer">Join as a Manufacturer</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
