import Link from "next/link";
import { Check } from "lucide-react";
import { PROJECT_STEPS } from "@/lib/validation/project";
import { cn } from "@/lib/utils";

/** One-line purpose of each wizard step (panel descriptions and the step rail). */
export const STEP_INFO: Record<number, string> = {
  1: "Name the project and describe the product.",
  2: "Fabric, colours, sizes and the processes it needs.",
  3: "Units, target price and when you need delivery.",
  4: "Certifications and sustainability requirements.",
  5: "Upload your tech pack and supporting files.",
  6: "Check the brief and send it to matched factories.",
};

/**
 * Step indicator for the project wizard: a vertical rail from lg (sticky beside the form), a compact
 * "Step x of y" summary plus a horizontally scrolling list of steps below that.
 * Completed = teal check, current = navy ring, upcoming = numbered grey.
 */
export function WizardSteps({ projectId, current, reached, submitted }: { projectId?: string; current: number; reached: number; submitted: boolean }) {
  const steps = submitted ? PROJECT_STEPS.filter((s) => s.fields.length > 0) : PROJECT_STEPS;
  const index = Math.max(0, steps.findIndex((s) => s.step === current));
  return (
    <nav aria-label="Project steps" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <div className="mb-3 lg:hidden">
        <p className="tabular text-[13px] text-muted">
          Step <span className="font-semibold text-navy">{index + 1}</span> of {steps.length}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span key={s.step} className={cn("h-1 flex-1 rounded-full", i < index ? "bg-teal" : i === index ? "bg-navy" : "bg-neutral-100")} />
          ))}
        </div>
      </div>
      <p className="label-caps mb-3 hidden text-muted lg:block">{submitted ? "Requirements" : "Steps"}</p>
      <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
        {steps.map((s, i) => {
          const isCurrent = s.step === current;
          const done = !submitted && s.step < reached && !isCurrent;
          const reachable = !!projectId && (submitted || s.step <= reached);
          const last = i === steps.length - 1;
          const content = (
            <>
              <span
                className={cn(
                  "relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular",
                  isCurrent && "border-2 border-navy bg-white text-navy ring-4 ring-navy-50",
                  done && "bg-teal text-white",
                  !isCurrent && !done && "border border-line-strong bg-white text-muted",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : s.step}
              </span>
              <span className="min-w-0">
                <span className={cn("block whitespace-nowrap text-sm leading-6", !isCurrent && "max-sm:sr-only", isCurrent ? "font-semibold text-navy" : done ? "font-medium text-ink" : "text-muted")}>
                  {s.title}
                  {done && <span className="sr-only"> (completed)</span>}
                </span>
                <span className="hidden text-xs leading-4 text-muted lg:block">{STEP_INFO[s.step]}</span>
              </span>
            </>
          );
          const cls = cn(
            "relative flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors duration-150 lg:px-2 lg:pb-5 lg:pt-1",
            isCurrent ? "bg-white shadow-card max-lg:ring-1 max-lg:ring-line lg:bg-transparent lg:shadow-none" : "",
          );
          return (
            <li key={s.step} aria-current={isCurrent ? "step" : undefined} className="relative shrink-0">
              {!last && (
                <span
                  className={cn("absolute bottom-0 left-[19px] top-8 hidden w-px lg:block", done ? "bg-teal" : "bg-line-strong")}
                  aria-hidden
                />
              )}
              {reachable && !isCurrent ? (
                <Link href={`/projects/${projectId}/edit?step=${s.step}`} className={cn(cls, "hover:bg-neutral-100 lg:hover:bg-neutral-100/60")}>
                  {content}
                </Link>
              ) : (
                <span className={cls}>{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
