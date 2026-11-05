import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Factory,
  FileText,
  Info,
  Ruler,
  ScanSearch,
  Scissors,
  Shirt,
  Tag,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Photo, photoCredit, type PhotoName } from "@/components/ui/photo";
import { cn } from "@/lib/utils";

/*
 * Public-website building blocks ("Atelier"). Server components.
 * Charcoal on ivory, Playfair headlines, numbered section heads over thin rules, asymmetric 12-column grids and
 * real garment-industry photography. Sections sit on `canvas` (default) or `surface`; dark photographic bands
 * (hero, closing call to action) carry ivory text over a scrim.
 */

/** Phones: let long call-to-action labels wrap instead of pushing the page sideways at 320px. */
export const WRAP_ON_PHONE = "max-sm:h-auto max-sm:min-h-11 max-sm:whitespace-normal max-sm:py-2.5 max-sm:text-center";

/**
 * Photographer credit for a full-bleed photo whose scrim is a separate layer on top of `<Photo>` (hero, closing
 * band, sign-in panel): rendered after the scrim so it is not dimmed. Same look as `<Photo credit>`.
 */
export function PhotoCredit({ photo, decorative = false, className }: { photo: PhotoName; decorative?: boolean; className?: string }) {
  return (
    <small
      aria-hidden={decorative || undefined}
      className={cn(
        "absolute right-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-xs bg-scrim/75 px-1.5 py-0.5 text-[0.6875rem] leading-4 text-ink-inverse",
        className,
      )}
    >
      {photoCredit(photo)}
    </small>
  );
}

/** Ivory outline button for dark photographic bands. */
export const ON_PHOTO_OUTLINE =
  "border border-ink-inverse/40 text-ink-inverse hover:bg-ink-inverse/10 hover:text-ink-inverse focus-visible:outline-ink-inverse";

export function Section({
  className,
  tone = "default",
  children,
  id,
  labelledBy,
  containerClassName,
}: {
  className?: string;
  /** default = canvas (ivory), surface (white paper), inverse (charcoal band). */
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

/** Small numbered running head over a rule: "01 — MANUFACTURING JOURNEY". */
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
        <h2 id={id} className={cn("type-section scroll-mt-24 text-balance text-ink", split && "lg:col-span-7")}>
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

/**
 * Inner-page hero: eyebrow, large Playfair h1, lead and actions. On the right (lg+) either a composed `aside`
 * (on-this-page navigation, a fact sheet) or a `photo` — an approved photograph in a tall editorial frame.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  children,
  aside,
  photo,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** Actions (buttons). */
  children?: React.ReactNode;
  /** Right-hand column on large screens (navigation, fact sheet). */
  aside?: React.ReactNode;
  /** Photograph for the right-hand column (ignored when `aside` is given). Preloaded: it is the page's hero image. */
  photo?: { name: PhotoName; alt?: string; position?: string };
}) {
  const media = !aside && photo;
  return (
    <section className="border-b border-line bg-canvas">
      <div
        className={cn(
          "container-page grid gap-10 pb-14 pt-12 sm:gap-12 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20",
          (aside || media) && "lg:grid-cols-12 lg:items-center lg:gap-12",
        )}
      >
        <div className={cn(aside ? "lg:col-span-6" : media ? "lg:col-span-7 xl:col-span-6" : "max-w-4xl")}>
          <p className="eyebrow mb-6 flex items-center gap-3 text-accent-strong">
            <span className="h-px w-8 bg-accent" aria-hidden />
            {eyebrow}
          </p>
          <h1
            className={cn(
              "text-balance font-display text-[2.375rem] font-medium leading-[1.06] tracking-[-0.02em] text-ink sm:text-[3rem]",
              aside || media ? "lg:text-[3.375rem] lg:leading-[1.04] lg:tracking-[-0.028em]" : "lg:text-[4rem] lg:leading-[1.02] lg:tracking-[-0.03em]",
            )}
          >
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">{description}</p>
          {children && <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>}
        </div>
        {aside && <div className="min-w-0 lg:col-span-6">{aside}</div>}
        {media && (
          <div className="relative aspect-[4/3] min-w-0 lg:col-span-5 lg:col-start-8 lg:aspect-[4/5]">
            <Photo
              photo={media.name}
              alt={media.alt}
              position={media.position}
              sizes="(min-width: 1280px) 460px, (min-width: 1024px) 38vw, (min-width: 640px) 90vw, 100vw"
              priority
              fill
              rounded="xl"
              credit
            />
          </div>
        )}
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

/** An entry of FeatureGrid: rule, icon and running number, Playfair title, body. */
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

/** Ruled list with small forest-green checks. */
export function CheckList({ items, inverted = false, className }: { items: React.ReactNode[]; inverted?: boolean; className?: string }) {
  return (
    <ul className={cn("border-t", inverted ? "border-ink-inverse/15" : "border-line", className)}>
      {items.map((item, i) => (
        <li key={i} className={cn("flex gap-3.5 border-b py-3.5 text-[0.9375rem] leading-6", inverted ? "border-ink-inverse/15" : "border-line")}>
          <Check className={cn("mt-1 size-4 shrink-0", inverted ? "text-accent-inverse" : "text-accent")} strokeWidth={2} aria-hidden />
          <span className={inverted ? "text-ink-inverse" : "text-ink"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Numbered steps with Playfair numerals over hairlines: stacked, or three columns from lg with `horizontal`. */
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
              <span className="font-display text-[2.5rem] font-normal leading-none tracking-[-0.03em] text-ink tabular" aria-hidden>
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
          <span className="font-display text-[1.75rem] font-normal leading-none tracking-[-0.02em] text-ink-muted tabular" aria-hidden>
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

/** "Example data" marker for every product preview on the public website. */
export function ExampleBadge({ children = "Example data" }: { children?: React.ReactNode }) {
  return (
    <Badge tone="warning" dot>
      {children}
    </Badge>
  );
}

/** Frame for a composed product preview. `label` names it for assistive technology. */
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

/**
 * The manufacturing journey, in nine steps. Steps 1–3 (sourcing) happen on the project page; steps 4–9 run on
 * the order page as eight production milestones (fabric sourcing, sampling, cutting, stitching, finishing,
 * quality check, shipping and delivery confirmation). How It Works numbers its detail sections by these steps.
 */
export const JOURNEY: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: ClipboardList, title: "Design brief", detail: "Garment, fabric, sizes, quantity and tech pack" },
  { icon: Factory, title: "Factory sourcing", detail: "Manufacturers matched on category, MOQ and capacity" },
  { icon: FileText, title: "Quotations", detail: "Itemised offers compared side by side" },
  { icon: Ruler, title: "Sample development", detail: "Fabric sourced, samples made and approved" },
  { icon: Scissors, title: "Cutting", detail: "Panels cut to pattern, with photo evidence" },
  { icon: Shirt, title: "Stitching", detail: "Garments assembled on the sewing line" },
  { icon: Tag, title: "Finishing", detail: "Pressing, labelling and packing" },
  { icon: ScanSearch, title: "Quality inspection", detail: "AQL inspection before anything ships" },
  { icon: Truck, title: "Delivery", detail: "Shipped with tracking, confirmed on arrival" },
];

/** Steps 1–3 are sourcing; 4–9 are production. */
export const SOURCING_STEPS = 3;

/**
 * The nine-step journey as a numbered sequence: a ruled list on phones, a 3 × 3 grid on tablets and small
 * laptops, and a single rail with a node per step from xl, with phase brackets underneath.
 */
export function JourneyDiagram({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ol className="grid border-line-strong sm:grid-cols-3 sm:gap-x-8 xl:grid-cols-9 xl:gap-x-0 xl:border-t">
        {JOURNEY.map((step, i) => {
          const production = i >= SOURCING_STEPS;
          return (
            <li
              key={step.title}
              className={cn(
                "relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 border-t border-line py-4",
                "sm:flex sm:flex-col sm:py-6",
                "xl:border-t-0 xl:py-0 xl:pr-4 xl:pt-8",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute -top-[4.5px] left-0 hidden size-2 rounded-full xl:block",
                  production ? "bg-accent" : "bg-primary",
                )}
              />
              <span className="font-display text-[1.375rem] italic leading-7 text-ink-muted tabular sm:text-[1.75rem] sm:leading-none xl:text-[2.25rem]" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 sm:mt-4 xl:mt-5">
                {/* In the nine-column row (xl) the icon sits above the title so long words such as "development" fit the column. */}
                <h3 className="flex items-center gap-2 font-display text-[1.0625rem] font-medium leading-6 tracking-[-0.01em] text-ink sm:text-lg xl:flex-col xl:items-start xl:gap-2 xl:text-[1.0625rem] xl:leading-[1.3] 2xl:text-lg">
                  <step.icon className={cn("size-4 shrink-0", production ? "text-accent-strong" : "text-ink-muted")} strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-1 text-[13px] leading-5 text-ink-muted">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-10 hidden grid-cols-9 text-xs text-ink-muted xl:grid" aria-hidden>
        <div className="col-span-3 mr-5 border-t-2 border-primary pt-2.5">
          <span className="font-medium text-ink">Sourcing</span> · steps 1–3 on the project page
        </div>
        <div className="col-span-6 border-t-2 border-accent pt-2.5">
          <span className="font-medium text-accent-strong">Production</span> · steps 4–9, tracked as eight milestones on the order page
        </div>
      </div>
    </div>
  );
}

/**
 * Closing call to action: a dark editorial band over a photograph (garments on a rail by default), ivory text on
 * a scrim. Pages that serve both audiences show both sign-up buttons; audience pages pass `focused`, which keeps
 * a single accent button and turns the other audience's sign-up into a quiet text link.
 */
export function CtaBand({
  eyebrow = "Start production",
  title = "Bring your next collection to production",
  description = "Registration is free. Brief your first garment and see which verified manufacturers fit it, or list your factory to receive projects that match your capabilities.",
  primary = "brand",
  focused = false,
  photo = "garmentRailDark",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Which audience gets the accent button (manufacturer pages lead with "Join as a Manufacturer"). */
  primary?: "brand" | "manufacturer";
  /** Audience pages: one accent button, the other audience as a small text link. */
  focused?: boolean;
  photo?: PhotoName;
}) {
  const brand = { href: "/register?role=brand", label: "Start Your Manufacturing Project", link: "Sourcing for a brand? Start a project" };
  const factory = { href: "/register?role=manufacturer", label: "Join as a Manufacturer", link: "Run a garment factory? Join as a manufacturer" };
  const [main, other] = primary === "brand" ? [brand, factory] : [factory, brand];
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-inverse text-ink-inverse">
      <Photo photo={photo} sizes="100vw" fill rounded="none" decorative position="center 40%" />
      {/* Phones: an even 85% scrim. lg+: darkest on the left, where the text sits (≥88% under the paragraph). */}
      <div
        aria-hidden
        className="absolute inset-0 bg-scrim/85 lg:bg-transparent lg:bg-linear-to-r lg:from-scrim/95 lg:via-scrim/88 lg:via-60% lg:to-scrim/50"
      />
      <PhotoCredit photo={photo} decorative />
      <div className="container-page relative py-20 lg:py-28">
        <div className="max-w-2xl">
          <p className="eyebrow flex items-center gap-3 text-ink-inverse">
            <span className="h-px w-8 bg-taupe" aria-hidden />
            {eyebrow}
          </p>
          <h2
            id="cta-title"
            className="mt-7 text-balance font-display text-[2.25rem] font-medium leading-[1.06] tracking-[-0.02em] text-ink-inverse sm:text-[2.75rem] lg:text-[3.5rem] lg:tracking-[-0.03em]"
          >
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-inverse-muted sm:text-[1.0625rem]">{description}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild variant="accent" size="lg" className={WRAP_ON_PHONE}>
              <Link href={main.href}>
                {main.label} <ArrowRight />
              </Link>
            </Button>
            {focused ? (
              <Link
                href={other.href}
                className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-ink-inverse underline decoration-ink-inverse/40 underline-offset-4 transition-colors duration-150 hover:decoration-ink-inverse focus-visible:outline-ink-inverse sm:ml-3 sm:self-auto"
              >
                {other.link}
                <ArrowRight className="size-3.5 shrink-0" aria-hidden />
              </Link>
            ) : (
              <Button asChild variant="ghost" size="lg" className={cn(ON_PHOTO_OUTLINE, WRAP_ON_PHONE)}>
                <Link href={other.href}>{other.label}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
