"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ChipSelect } from "@/components/forms/chip-select";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CAPABILITIES, CERTIFICATIONS, CURRENCIES, GARMENT_CATEGORIES } from "@/lib/constants";
import { SIZE_OPTIONS, MIN_LEAD_DAYS } from "@/lib/validation/project";
import { isoDateInDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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

/** A titled group of fields inside a step (plain heading: no aria-labelledby, so it never matches getByLabel). */
function Group({ title, description, children, first = false }: { title: string; description?: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={cn("space-y-5", !first && "border-t border-line-subtle pt-6")}>
      <div>
        <h3 className="type-heading text-navy">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-muted">{description}</p>}
      </div>
      {children}
    </div>
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
      {/* Action bar: sticks to the bottom of the screen on phones so the next step is always in reach. */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex gap-2 border-t max-sm:[&>*:not(p)]:flex-1 border-line bg-white/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:mb-0 sm:items-center sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none">
        <p className="mr-auto hidden text-xs text-muted sm:block">{submitted ? "Quoting factories are notified of changes." : "Drafts are private until you submit."}</p>
        {submitted ? (
          <>
            <Link href={`/projects/${project!.id}`} className={buttonVariants({ variant: "ghost" })}>Cancel</Link>
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
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="name" label="Project name" required hint="An internal name such as “SS27 organic tee”.">
          <Input name="name" defaultValue={project?.name} maxLength={120} />
        </Field>
        <Field id="category" label="Product category" required>
          <Select name="category" defaultValue={project?.category ?? ""}>
            <option value="" disabled>Choose a category</option>
            {GARMENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field id="description" label="Product description" required hint="Style, fit, construction details and anything a factory needs to price it. Required before you submit.">
        <Textarea name="description" rows={6} defaultValue={project?.description ?? ""} />
      </Field>
    </StepForm>
  );
}

export function SpecificationsStep({ project }: { project: WizardProject }) {
  return (
    <StepForm project={project} step={2}>
      <Group first title="Fabric" description="What the garment is made of and the fabric expertise the factory needs.">
        <Field id="fabricRequirements" label="Fabric type and composition" required hint="For example “100% organic cotton single jersey, 220 gsm”.">
          <Textarea name="fabricRequirements" rows={3} defaultValue={project.fabricRequirements ?? ""} />
        </Field>
        <ChipSelect name="fabrics" label="Fabrics the factory must handle" options={CAPABILITIES.FABRIC} defaultValue={project.fabrics} allowCustom hint="Used for matching fabric expertise." />
      </Group>
      <Group title="Colourways and sizing">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="colors" label="Colours" required hint="Comma-separated, with Pantone references if you have them.">
            <Input name="colors" defaultValue={project.colors ?? ""} />
          </Field>
        </div>
        <ChipSelect name="sizes" label="Sizes" required options={SIZE_OPTIONS} defaultValue={project.sizes} allowCustom />
      </Group>
      <Group title="Construction" description="Processes the factory must offer and anything else they should know.">
        <ChipSelect name="requiredCapabilities" label="Manufacturing requirements" options={[...CAPABILITIES.PRODUCTION, ...CAPABILITIES.FINISHING]} defaultValue={project.requiredCapabilities} allowCustom hint="Processes the factory must offer, such as screen printing or garment dyeing." />
        <Field id="additionalInstructions" label="Additional instructions">
          <Textarea name="additionalInstructions" rows={3} defaultValue={project.additionalInstructions ?? ""} />
        </Field>
      </Group>
    </StepForm>
  );
}

export function QuantityStep({ project }: { project: WizardProject }) {
  const minDate = isoDateInDays(MIN_LEAD_DAYS);
  return (
    <StepForm project={project} step={3}>
      <Group first title="Volume and price" description="Factories with a higher minimum order than you can accept are excluded.">
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
        </div>
      </Group>
      <Group title="Delivery" description="Matching only invites factories whose lead time fits your date.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="deadline" label="Desired delivery date" required hint={`At least ${MIN_LEAD_DAYS} days from today. Factories whose lead time is longer are not matched.`}>
            <Input name="deadline" type="date" min={minDate} defaultValue={project.deadline ?? ""} />
          </Field>
          <Field id="preferredCountry" label="Preferred manufacturing country" hint="A preference, not a requirement: other countries score lower.">
            <Input name="preferredCountry" defaultValue={project.preferredCountry ?? ""} autoComplete="country-name" />
          </Field>
        </div>
      </Group>
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
