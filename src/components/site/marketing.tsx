import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
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
 * Marketing building blocks ("Editorial Atelier"). Server components.
 * Ink on ivory, Fraunces headlines, numbered section heads over thin rules, asymmetric 12-column grids.
 * Sections sit on `canvas` (default) or `surface`; `inverse` is reserved for the closing CTA band.
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
  /** default = canvas (ivory), surface (lighter paper), inverse (CTA band only). */
  tone?: "default" | "surface" | "inverse";
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
        tone === "surface" && "border-y border-line bg-surface",
        tone === "inverse" && "bg-inverse text-ink-inverse",
        className,
      )}
    >
      <div className={cn("container-page", containerClassName)}>{children}</div>
    </section>
  );
}

/** Small numbered running head over a rule: "01 — PRODUCTION WORKFLOW". */
export function Kicker({ index, children, className }: { index?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-baseline gap-3 border-t border-line-strong pt-3", className)}>
      {index && (
        <span className="font-display text-[0.9375rem] italic leading-none text-ink tabular" aria-hidden>
          {index}
        </span>
      )}
      <span className="eyebrow text-accent-strong">{children}</span>
    </p>
  );
}

export function SectionHeading({
  id,
  index,
  eyebrow,
  title,
  description,
  split = false,
  className,
  children,
}: {
  id?: string;
  /** Section number shown before the eyebrow ("01"). */
  index?: string;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Title (7 columns) and description (5 columns) side by side from lg: the editorial opener for full-width sections. */
  split?: boolean;
  className?: string;
  /** Optional actions under the description. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-10 lg:mb-14", className)}>
      {eyebrow && (
        <Kicker index={index} className="mb-7 lg:mb-9">
          {eyebrow}
        </Kicker>
      )}
      <div className={cn(split ? "grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-10" : "max-w-2xl")}>
        <h2 id={id} className={cn("type-section text-balance text-ink", split && "lg:col-span-7")}>
          {title}
        </h2>
        {(description || children) && (
          <div className={cn(split ? "lg:col-span-5 lg:pb-1.5" : "mt-5")}>
            {description && <p className="max-w-xl text-base leading-7 text-ink-muted sm:text-[1.0625rem]">{description}</p>}
            {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Inner-page hero: eyebrow, large serif h1, lead and actions, with an optional composed aside on the right (lg+). */
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
    <section className="border-b border-line bg-canvas">
      <div
        className={cn(
          "container-page grid gap-12 pb-14 pt-12 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20",
          aside && "lg:grid-cols-12 lg:items-center lg:gap-12",
        )}
      >
        <div className={cn(aside ? "lg:col-span-6" : "max-w-4xl")}>
          <p className="eyebrow mb-6 flex items-center gap-3 text-accent-strong">
            <span className="h-px w-8 bg-accent" aria-hidden />
            {eyebrow}
          </p>
          <h1
            className={cn(
              "text-balance font-display text-[2.375rem] font-[450] leading-[1.06] tracking-[-0.025em] text-ink sm:text-[3rem]",
              aside ? "lg:text-[3.375rem] lg:leading-[1.04] lg:tracking-[-0.032em]" : "lg:text-[4rem] lg:leading-[1.02] lg:tracking-[-0.035em]",
            )}
          >
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">{description}</p>
          {children && <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>}
        </div>
        {aside && <div className="min-w-0 lg:col-span-6">{aside}</div>}
      </div>
    </section>
  );
}

/** Editorial feature grid: no boxes, each entry hangs from a rule and is numbered automatically. */
export function FeatureGrid({ children, columns = 3, className }: { children: React.ReactNode; columns?: 2 | 3 | 4; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-x-10 gap-y-12 [counter-reset:feature] sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4 lg:gap-x-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** An entry of FeatureGrid: rule, icon and running number, serif title, body. */
export function FeatureCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line-strong pt-5 [counter-increment:feature]">
      <div className="flex items-center justify-between gap-3">
        <Icon className="size-5 text-ink" strokeWidth={1.5} aria-hidden />
        <span
          aria-hidden
          className="font-display text-[0.9375rem] italic text-ink-muted tabular before:content-[counter(feature,decimal-leading-zero)]"
        />
      </div>
      <h3 className="mt-6 font-display text-[1.3125rem] font-medium leading-7 tracking-[-0.015em] text-ink">{title}</h3>
      <div className="mt-2.5 text-[0.9375rem] leading-7 text-ink-muted">{children}</div>
    </div>
  );
}

/** Ruled list with small terracotta checks. */
export function CheckList({ items, inverted = false, className }: { items: React.ReactNode[]; inverted?: boolean; className?: string }) {
  return (
    <ul className={cn("border-t", inverted ? "border-ink-inverse/15" : "border-line", className)}>
      {items.map((item, i) => (
        <li key={i} className={cn("flex gap-3.5 border-b py-3.5 text-[0.9375rem] leading-6", inverted ? "border-ink-inverse/15" : "border-line")}>
          <Check className="mt-1 size-4 shrink-0 text-accent" strokeWidth={2} aria-hidden />
          <span className={inverted ? "text-ink-inverse" : "text-ink"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered steps with serif numerals over hairlines: stacked, or three columns from lg with `horizontal`. */
export function StepList({
  items,
  horizontal = false,
  className,
}: {
  items: { title: string; text: React.ReactNode; icon?: LucideIcon }[];
  horizontal?: boolean;
  className?: string;
}) {
  if (horizontal) {
    return (
      <ol className={cn("grid gap-10 lg:grid-cols-3 lg:gap-10", className)}>
        {items.map((s, i) => (
          <li key={s.title} className="border-t border-line-strong pt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-[2.5rem] font-light leading-none tracking-[-0.03em] text-ink tabular" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.icon && <s.icon className="size-5 text-accent" strokeWidth={1.5} aria-hidden />}
            </div>
            <h3 className="mt-6 font-display text-xl font-medium tracking-[-0.012em] text-ink">{s.title}</h3>
            <div className="mt-2 text-[0.9375rem] leading-7 text-ink-muted">{s.text}</div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className={cn("border-t border-line", className)}>
      {items.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 border-b border-line py-5">
          <span className="font-display text-[1.75rem] font-light leading-none tracking-[-0.02em] text-ink-muted tabular" aria-hidden>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-medium leading-6 tracking-[-0.01em] text-ink">{s.title}</h3>
            <div className="mt-1.5 text-[0.9375rem] leading-7 text-ink-muted">{s.text}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "Example data" marker for every product-UI mock on the marketing site. */
export function ExampleBadge({ children = "Example data" }: { children?: React.ReactNode }) {
  return (
    <Badge tone="warning" dot>
      {children}
    </Badge>
  );
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
        <figcaption className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-ink-muted">
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

/**
 * The 7-step production workflow as an elegant numbered sequence: a rule with a node per step and serif
 * numerals (seven columns from lg), a ruled list on smaller screens. Steps 1–3 are sourcing (ink nodes),
 * 4–7 production (terracotta nodes), matched by the two phase brackets underneath.
 */
export function WorkflowDiagram() {
  return (
    <div>
      <ol className="grid sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-7 lg:gap-x-0">
        {WORKFLOW.map((step, i) => {
          const production = i >= 3;
          return (
            <li
              key={step.title}
              className={cn(
                "relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 border-t border-line py-5",
                "lg:flex lg:flex-col lg:border-line-strong lg:py-0 lg:pr-5 lg:pt-8",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute -top-[4.5px] left-0 hidden size-2 rounded-full lg:block",
                  production ? "bg-accent" : "bg-primary",
                )}
              />
              <span className="font-display text-[1.75rem] font-light leading-none tracking-[-0.03em] text-ink tabular lg:text-[2.75rem]" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 lg:mt-6">
                <step.icon
                  className={cn("size-4", production ? "text-accent-strong" : "text-ink-muted")}
                  strokeWidth={1.5}
                  aria-hidden
                />
                <h3 className="mt-2 font-display text-lg font-medium leading-6 tracking-[-0.01em] text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-ink-muted">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-10 hidden grid-cols-7 text-xs text-ink-muted lg:grid" aria-hidden>
        <div className="col-span-3 mr-5 border-t-2 border-primary pt-2.5">
          <span className="font-medium text-ink">Sourcing</span> · brief, match and quote on the project page
        </div>
        <div className="col-span-4 border-t-2 border-accent pt-2.5">
          <span className="font-medium text-accent-strong">Production</span> · eight milestones tracked on the order page
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
  const quiet = "border border-ink-inverse/30 text-ink-inverse hover:bg-ink-inverse/10";
  const buttons = [
    <Button key="brand" asChild variant={primary === "brand" ? "accent" : "ghost"} size="lg" className={primary === "brand" ? undefined : quiet}>
      <Link href="/register?role=brand">
        Start a Project {primary === "brand" && <ArrowRight />}
      </Link>
    </Button>,
    <Button key="manufacturer" asChild variant={primary === "manufacturer" ? "accent" : "ghost"} size="lg" className={primary === "manufacturer" ? undefined : quiet}>
      <Link href="/register?role=manufacturer">
        Join as a Manufacturer {primary === "manufacturer" && <ArrowRight />}
      </Link>
    </Button>,
  ];
  return (
    <section aria-labelledby="cta-title" className="bg-inverse text-ink-inverse">
      <div className="container-page py-16 lg:py-24">
        <p className="eyebrow border-t border-ink-inverse/20 pt-3 text-ink-inverse-muted">Get started</p>
        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <h2
              id="cta-title"
              className="text-balance font-display text-[2.25rem] font-[450] leading-[1.06] tracking-[-0.025em] text-ink-inverse sm:text-[2.75rem] lg:text-[3.5rem] lg:tracking-[-0.035em]"
            >
              {title}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-inverse-muted sm:text-[1.0625rem]">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:flex-col lg:items-stretch">
            {primary === "manufacturer" ? [buttons[1], buttons[0]] : buttons}
          </div>
        </div>
      </div>
    </section>
  );
}
