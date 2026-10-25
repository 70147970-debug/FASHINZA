import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardList,
  Factory,
  FileText,
  Info,
  PackageCheck,
  Ruler,
  Scissors,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/*
 * Marketing building blocks ("Atelier Ops"). Server components. Sections alternate white / canvas with a
 * 64px (phone) / 96px (desktop) rhythm; the navy tone is reserved for the CTA band.
 */

export function Section({
  className,
  tone = "default",
  children,
  id,
  labelledBy,
  containerClassName,
}: {
  className?: string;
  /** default = canvas (#F7F8FA), white, navy (CTA band only). */
  tone?: "default" | "white" | "navy";
  children: React.ReactNode;
  id?: string;
  labelledBy?: string;
  containerClassName?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        "scroll-mt-20 py-16 lg:py-24",
        tone === "default" && "bg-canvas",
        tone === "white" && "bg-white",
        tone === "navy" && "bg-navy text-white",
        className,
      )}
    >
      <div className={cn("container-page", containerClassName)}>{children}</div>
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
  className,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  align?: "left" | "center";
  inverted?: boolean;
  className?: string;
  /** Optional actions under the description. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-10 max-w-2xl lg:mb-12", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className={cn("eyebrow mb-3", inverted ? "text-teal-100" : "text-teal-700")}>{eyebrow}</p>}
      <h2 id={id} className={cn("type-section text-balance", inverted ? "text-white" : "text-navy")}>
        {title}
      </h2>
      {description && (
        <p className={cn("mt-4 text-base leading-7 sm:text-[1.0625rem]", inverted ? "text-white/75" : "text-muted")}>{description}</p>
      )}
      {children && <div className={cn("mt-6 flex flex-wrap gap-3", align === "center" && "justify-center")}>{children}</div>}
    </div>
  );
}

/** Inner-page hero: eyebrow, h1, lead and actions, with an optional composed aside on the right (lg+). */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** Actions (buttons). */
  children?: React.ReactNode;
  /** Right-hand column on large screens (product-UI mock, fact sheet). */
  aside?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-white">
      <div
        className={cn(
          "container-page grid gap-12 py-14 sm:py-16 lg:py-20",
          aside && "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16",
        )}
      >
        <div className="max-w-3xl">
          <p className="eyebrow mb-4 text-teal-700">{eyebrow}</p>
          <h1 className="text-balance font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.025em] text-navy sm:text-[2.5rem] lg:text-[3rem] lg:leading-[1.08] lg:tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">{description}</p>
          {children && <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}

/** One card divided into cells by hairlines (instead of many separate cards). */
export function FeatureGrid({ children, columns = 3, className }: { children: React.ReactNode; columns?: 2 | 3 | 4; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-line bg-line shadow-card sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A cell of FeatureGrid (also works on its own as a card). */
export function FeatureCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 lg:p-7">
      <div className="grid size-9 place-items-center rounded-md bg-teal-50 text-teal-700">
        <Icon className="size-[18px]" aria-hidden />
      </div>
      <h3 className="mt-5 font-display text-base font-semibold text-navy">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </div>
  );
}

export function CheckList({ items, inverted = false, className }: { items: React.ReactNode[]; inverted?: boolean; className?: string }) {
  return (
    <ul className={cn("space-y-3.5", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[0.9375rem] leading-6">
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
              inverted ? "bg-white/10 text-teal-100" : "bg-teal-50 text-teal-700",
            )}
            aria-hidden
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span className={inverted ? "text-white/85" : "text-ink"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered steps joined by a line: vertical, or horizontal from lg with `horizontal`. */
export function StepList({
  items,
  horizontal = false,
  className,
}: {
  items: { title: string; text: React.ReactNode; icon?: LucideIcon }[];
  horizontal?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("grid", horizontal ? "gap-0 lg:grid-cols-3 lg:gap-8" : "gap-0", className)}>
      {items.map((s, i) => {
        const last = i === items.length - 1;
        return (
          <li key={s.title} className={cn("relative flex gap-4 pb-8 last:pb-0", horizontal && "lg:flex-col lg:pb-0")}>
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0 left-[17.5px] top-10 w-px bg-line-strong",
                  horizontal && "lg:left-12 lg:right-[-1rem] lg:top-[17.5px] lg:bottom-auto lg:h-px lg:w-auto",
                )}
              />
            )}
            <span className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border border-line-strong bg-white font-display text-sm font-semibold text-navy tabular">
              {s.icon ? <s.icon className="size-4 text-teal-700" aria-hidden /> : i + 1}
            </span>
            <div className="min-w-0 pt-1.5 lg:pt-1">
              {s.icon && <p className="label-caps mb-1 text-muted">Step {i + 1}</p>}
              <h3 className="font-display text-base font-semibold text-navy">{s.title}</h3>
              <div className="mt-1.5 text-sm leading-6 text-muted">{s.text}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "Example data" marker for every product-UI mock on the marketing site. */
export function ExampleBadge({ children = "Example data" }: { children?: React.ReactNode }) {
  return <Badge tone="warning">{children}</Badge>;
}

/** Frame for a composed product-UI mock. `label` names it for assistive technology. */
export function MockFrame({
  label,
  caption,
  children,
  className,
}: {
  label: string;
  caption?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("relative min-w-0", className)} aria-label={label}>
      {children}
      {caption && (
        <figcaption className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {caption}
        </figcaption>
      )}
    </figure>
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

/** The 7-step production workflow: one divided card, horizontal from lg, stacked on smaller screens. */
export function WorkflowDiagram() {
  return (
    <div>
      <ol className="grid overflow-hidden rounded-lg border border-line bg-white shadow-card sm:grid-cols-2 lg:grid-cols-7 lg:overflow-visible">
        {WORKFLOW.map((step, i) => (
          <li
            key={step.title}
            className={cn(
              "relative flex gap-4 border-line-subtle px-4 py-4 sm:p-5 lg:flex-col lg:gap-0 lg:px-4 lg:py-6",
              "max-sm:border-b max-sm:last:border-b-0",
              "sm:max-lg:border-b sm:max-lg:odd:border-r sm:max-lg:last:border-b-0",
              "lg:border-l lg:first:border-l-0",
            )}
          >
            {i < WORKFLOW.length - 1 && (
              <span
                aria-hidden
                className="absolute -right-[10px] top-[2.6rem] z-10 hidden size-5 place-items-center rounded-full border border-line bg-white text-subtle lg:grid"
              >
                <ChevronRight className="size-3" />
              </span>
            )}
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700 lg:size-10">
              <step.icon className="size-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 lg:mt-5">
              <p className="label-caps tabular text-muted">Step {String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 font-display text-[0.9375rem] font-semibold text-navy">{step.title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 hidden grid-cols-7 gap-0 text-xs text-muted lg:grid" aria-hidden>
        <div className="col-span-3 mr-2 border-t-2 border-navy pt-2">
          <span className="font-medium text-navy">Sourcing</span> · brief, match and quote on the project page
        </div>
        <div className="col-span-4 ml-2 border-t-2 border-teal pt-2">
          <span className="font-medium text-teal-700">Production</span> · eight milestones tracked on the order page
        </div>
      </div>
    </div>
  );
}

export function CtaBand({
  title = "Ready to start your next production run?",
  description = "Create a free account to submit your first project, or register your factory to start receiving requests.",
  primary = "brand",
}: {
  title?: string;
  description?: string;
  /** Which audience gets the filled button (manufacturer pages lead with "Join as a Manufacturer"). */
  primary?: "brand" | "manufacturer";
}) {
  const quiet = "border border-white/25 text-white hover:bg-white/10";
  const buttons = [
    <Button key="brand" asChild variant={primary === "brand" ? "inverse" : "ghost"} size="lg" className={primary === "brand" ? undefined : quiet}>
      <Link href="/register?role=brand">
        Start a Project {primary === "brand" && <ArrowRight />}
      </Link>
    </Button>,
    <Button key="manufacturer" asChild variant={primary === "manufacturer" ? "inverse" : "ghost"} size="lg" className={primary === "manufacturer" ? undefined : quiet}>
      <Link href="/register?role=manufacturer">
        Join as a Manufacturer {primary === "manufacturer" && <ArrowRight />}
      </Link>
    </Button>,
  ];
  return (
    <section aria-labelledby="cta-title" className="bg-navy py-16 text-white lg:py-20">
      <div className="container-page">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3 text-teal-100">Get started</p>
            <h2 id="cta-title" className="text-balance font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-white lg:text-[2.25rem]">
              {title}
            </h2>
            <p className="mt-3 text-base leading-7 text-white/75">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
            {primary === "manufacturer" ? [buttons[1], buttons[0]] : buttons}
          </div>
        </div>
      </div>
    </section>
  );
}
