"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ChipSelect } from "@/components/forms/chip-select";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CAPABILITIES, CERTIFICATIONS, CURRENCIES, GARMENT_CATEGORIES } from "@/lib/constants";
import { PROJECT_STEPS, SIZE_OPTIONS, MIN_LEAD_DAYS } from "@/lib/validation/project";
import { isoDateInDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveProjectStepAction } from "@/app/(app)/projects/actions";

export type WizardProject = {
  id: string;
  status: string;
  wizardStep: number;
  name: string;
  category: string;
  description: string | null;
  fabricRequirements: string | null;
  fabrics: string[];
  colors: string | null;
  sizes: string[];
  requiredCapabilities: string[];
  additionalInstructions: string | null;
  quantity: number | null;
  maxMoq: number | null;
  targetUnitPrice: string | null;
  currency: string;
  deadline: string | null;
  preferredCountry: string | null;
  requiredCertifications: string[];
  sustainabilityNotes: string | null;
};

export function WizardSteps({ projectId, current, reached, submitted }: { projectId?: string; current: number; reached: number; submitted: boolean }) {
  const steps = submitted ? PROJECT_STEPS.filter((s) => s.fields.length > 0) : PROJECT_STEPS;
  return (
    <nav aria-label="Project steps" className="mb-6">
      <ol className="flex gap-1 overflow-x-auto pb-1 sm:gap-2">
        {steps.map((s) => {
          const done = !submitted && s.step < reached && s.step !== current;
          const reachable = !!projectId && (submitted || s.step <= reached);
          const content = (
            <>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  s.step === current ? "bg-navy text-white" : done ? "bg-teal-50 text-teal-700" : "bg-navy-50 text-muted",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : s.step}
              </span>
              <span className="whitespace-nowrap">{s.title}</span>
            </>
          );
          const cls = cn("flex items-center gap-2 rounded-md px-2.5 py-2 text-sm", s.step === current ? "bg-white font-medium text-navy shadow-card" : "text-muted");
          return (
            <li key={s.step} aria-current={s.step === current ? "step" : undefined}>
              {reachable && s.step !== current ? (
                <Link href={`/projects/${projectId}/edit?step=${s.step}`} className={cn(cls, "hover:bg-white hover:text-navy")}>{content}</Link>
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

function StepForm({ project, step, children, isLast = false }: { project: WizardProject | null; step: number; children: React.ReactNode; isLast?: boolean }) {
  const submitted = !!project && project.status !== "DRAFT";
  return (
    <ActionForm action={saveProjectStepAction} className="space-y-6">
      <input type="hidden" name="step" value={step} />
      {project && <input type="hidden" name="projectId" value={project.id} />}
      {submitted && <input type="hidden" name="submitted" value="1" />}
      {children}
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        {submitted ? (
          <>
            <Link href={`/projects/${project!.id}`} className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-navy hover:bg-navy-50">Cancel</Link>
            <SubmitButton variant="accent" name="intent" value="save" pendingText="Saving…">Save changes</SubmitButton>
          </>
        ) : (
          <>
            <SubmitButton variant="outline" name="intent" value="save" pendingText="Saving…">Save draft</SubmitButton>
            <SubmitButton variant="accent" name="intent" value="next" pendingText="Saving…">{isLast ? "Save and review" : "Save and continue"}</SubmitButton>
          </>
        )}
      </div>
    </ActionForm>
  );
}

export function BasicsStep({ project }: { project: WizardProject | null }) {
  return (
    <StepForm project={project} step={1}>
      <Field id="name" label="Project name" required hint="An internal name such as “SS27 organic tee”.">
        <Input name="name" defaultValue={project?.name} maxLength={120} />
      </Field>
      <Field id="category" label="Product category" required>
        <Select name="category" defaultValue={project?.category ?? ""}>
          <option value="" disabled>Choose a category</option>
          {GARMENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </Field>
      <Field id="description" label="Product description" required hint="Style, fit, construction details and anything a factory needs to price it. Required before you submit.">
        <Textarea name="description" rows={6} defaultValue={project?.description ?? ""} />
      </Field>
    </StepForm>
  );
}

export function SpecificationsStep({ project }: { project: WizardProject }) {
  return (
    <StepForm project={project} step={2}>
      <Field id="fabricRequirements" label="Fabric type and composition" required hint="For example “100% organic cotton single jersey, 220 gsm”.">
        <Textarea name="fabricRequirements" rows={3} defaultValue={project.fabricRequirements ?? ""} />
      </Field>
      <ChipSelect name="fabrics" label="Fabrics the factory must handle" options={CAPABILITIES.FABRIC} defaultValue={project.fabrics} allowCustom hint="Used for matching fabric expertise." />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="colors" label="Colours" required hint="Comma-separated, with Pantone references if you have them.">
          <Input name="colors" defaultValue={project.colors ?? ""} />
        </Field>
      </div>
      <ChipSelect name="sizes" label="Sizes" required options={SIZE_OPTIONS} defaultValue={project.sizes} allowCustom />
      <ChipSelect name="requiredCapabilities" label="Manufacturing requirements" options={[...CAPABILITIES.PRODUCTION, ...CAPABILITIES.FINISHING]} defaultValue={project.requiredCapabilities} allowCustom hint="Processes the factory must offer, such as screen printing or garment dyeing." />
      <Field id="additionalInstructions" label="Additional instructions">
        <Textarea name="additionalInstructions" rows={3} defaultValue={project.additionalInstructions ?? ""} />
      </Field>
    </StepForm>
  );
}

export function QuantityStep({ project }: { project: WizardProject }) {
  const minDate = isoDateInDays(MIN_LEAD_DAYS);
  return (
    <StepForm project={project} step={3}>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="quantity" label="Estimated quantity (units)" required>
          <Input name="quantity" type="number" inputMode="numeric" min={1} defaultValue={project.quantity ?? ""} />
        </Field>
        <Field id="maxMoq" label="Highest MOQ you can accept" hint="Factories with a higher minimum order are excluded. Leave empty to use your quantity.">
          <Input name="maxMoq" type="number" inputMode="numeric" min={1} defaultValue={project.maxMoq ?? ""} />
        </Field>
        <Field id="targetUnitPrice" label="Target price per unit" hint="Shared with matched factories as guidance.">
          <Input name="targetUnitPrice" inputMode="decimal" placeholder="0.00" defaultValue={project.targetUnitPrice ?? ""} />
        </Field>
        <Field id="currency" label="Currency" required>
          <Select name="currency" defaultValue={project.currency}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field id="deadline" label="Desired delivery date" required hint={`At least ${MIN_LEAD_DAYS} days from today. Factories whose lead time is longer are not matched.`}>
          <Input name="deadline" type="date" min={minDate} defaultValue={project.deadline ?? ""} />
        </Field>
        <Field id="preferredCountry" label="Preferred manufacturing country" hint="A preference, not a requirement: other countries score lower.">
          <Input name="preferredCountry" defaultValue={project.preferredCountry ?? ""} autoComplete="country-name" />
        </Field>
      </div>
    </StepForm>
  );
}

export function SustainabilityStep({ project }: { project: WizardProject }) {
  return (
    <StepForm project={project} step={4} isLast={project.status === "DRAFT" ? false : true}>
      <ChipSelect
        name="requiredCertifications"
        label="Required certifications"
        options={CERTIFICATIONS}
        defaultValue={project.requiredCertifications}
        hint="Only factories whose certificate has been verified by Fashinza are matched. Leave empty if none are required."
      />
      <Field id="sustainabilityNotes" label="Sustainability requirements" hint="For example recycled packaging, low-impact dyes or traceability needs.">
        <Textarea name="sustainabilityNotes" rows={4} defaultValue={project.sustainabilityNotes ?? ""} />
      </Field>
    </StepForm>
  );
}
