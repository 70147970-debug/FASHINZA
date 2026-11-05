import { useState } from "react";
import { Link } from "react-router";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ChipSelect } from "@/components/forms/chip-select";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CAPABILITIES, CERTIFICATIONS, CURRENCIES, GARMENT_CATEGORIES } from "@fashinza/shared/constants.js";
import { SIZE_OPTIONS, MIN_LEAD_DAYS, MAX_SAMPLE_PIECES, LAST_FIELD_STEP } from "@fashinza/shared/validation/project.js";
import { isoDateInDays } from "@fashinza/shared/format.js";
import { cn } from "@fashinza/shared/utils.js";
import { buttonVariants } from "@/components/ui/button";

/** A titled group of fields inside a step (plain heading: no aria-labelledby, so it never matches getByLabel). */
function Group({ title, description, children, first = false }) {
  return (
    <div className={cn("space-y-5", !first && "border-t border-line-subtle pt-6")}>
      <div>
        <h3 className="type-heading text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function StepForm({ project, step, children, isLast = false }) {
  const submitted = !!project && project.status !== "DRAFT";
  return (
    <ActionForm action="/api/projects/save-step" className="space-y-6">
      <input type="hidden" name="step" value={step} />
      {project && <input type="hidden" name="projectId" value={project.id} />}
      {submitted && <input type="hidden" name="submitted" value="1" />}
      {children}
      {/* Action bar: sticks to the bottom of the screen on phones so the next step is always in reach. */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex gap-2 border-t max-sm:[&>*:not(p)]:flex-1 border-line bg-surface/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:mb-0 sm:items-center sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none">
        <p className="mr-auto hidden text-xs text-ink-muted sm:block">
          {submitted ? "Quoting factories are notified of changes." : "Drafts are private until you submit."}
        </p>
        {submitted ? (
          <>
            <Link to={`/projects/${project.id}`} className={buttonVariants({ variant: "ghost" })}>
              Cancel
            </Link>
            <SubmitButton variant="accent" name="intent" value="save" pendingText="Saving…">
              Save changes
            </SubmitButton>
          </>
        ) : (
          <>
            <SubmitButton variant="outline" name="intent" value="save" pendingText="Saving…">
              Save draft
            </SubmitButton>
            <SubmitButton variant="accent" name="intent" value="next" pendingText="Saving…">
              {isLast ? "Save and review" : "Save and continue"}
            </SubmitButton>
          </>
        )}
      </div>
    </ActionForm>
  );
}

export function BasicsStep({ project }) {
  return (
    <StepForm project={project} step={1}>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="name" label="Project name" required hint="An internal name such as “SS27 organic tee”.">
          <Input name="name" defaultValue={project?.name} maxLength={120} />
        </Field>
        <Field id="category" label="Product category" required>
          <Select name="category" defaultValue={project?.category ?? ""}>
            <option value="" disabled>
              Choose a category
            </option>
            {GARMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        id="description"
        label="Product description"
        required
        hint="Style, fit, construction details and anything a factory needs to price it. Required before you submit."
      >
        <Textarea name="description" rows={6} defaultValue={project?.description ?? ""} />
      </Field>
    </StepForm>
  );
}

export function SpecificationsStep({ project }) {
  return (
    <StepForm project={project} step={2}>
      <Group first title="Fabric" description="What the garment is made of and the fabric expertise the factory needs.">
        <Field id="fabricRequirements" label="Fabric type and composition" required hint="For example “100% organic cotton single jersey, 220 gsm”.">
          <Textarea name="fabricRequirements" rows={3} defaultValue={project.fabricRequirements ?? ""} />
        </Field>
        <ChipSelect
          name="fabrics"
          label="Fabrics the factory must handle"
          options={CAPABILITIES.FABRIC}
          defaultValue={project.fabrics}
          allowCustom
          hint="Used for matching fabric expertise."
        />
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
        <ChipSelect
          name="requiredCapabilities"
          label="Manufacturing requirements"
          options={[...CAPABILITIES.PRODUCTION, ...CAPABILITIES.FINISHING]}
          defaultValue={project.requiredCapabilities}
          allowCustom
          hint="Processes the factory must offer, such as screen printing or garment dyeing."
        />
        <Field id="additionalInstructions" label="Additional instructions">
          <Textarea name="additionalInstructions" rows={3} defaultValue={project.additionalInstructions ?? ""} />
        </Field>
      </Group>
    </StepForm>
  );
}

export function QuantityStep({ project }) {
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
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Group>
      <Group title="Delivery" description="Matching only invites factories whose lead time fits your date.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="deadline"
            label="Desired delivery date"
            required
            hint={`At least ${MIN_LEAD_DAYS} days from today. Factories whose lead time is longer are not matched.`}
          >
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

export function SustainabilityStep({ project }) {
  return (
    <StepForm project={project} step={4}>
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

/**
 * Sample request. "Yes" asks factories to include a sample proposal (lead time, charge, approach) in their
 * quotation. Every order still has a sampling stage where one sample is approved before cutting, so "No"
 * is worded as going straight to that pre-production sample. The sample fields are disabled (and so not
 * posted, which clears them) while "No" is chosen.
 */
export function SamplesStep({ project }) {
  const [required, setRequired] = useState(project.sampleRequired);
  const sizeOptions = project.sizes.length ? project.sizes : SIZE_OPTIONS;
  const option = (value, title, text) => (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer gap-3 rounded-md border p-3.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
        required === value ? "border-accent bg-accent-soft/50" : "border-line-strong bg-surface hover:border-line-control",
      )}
    >
      <input
        type="radio"
        name="sampleRequired"
        value={String(value)}
        checked={required === value}
        onChange={() => setRequired(value)}
        className="mt-0.5 size-4 shrink-0 accent-accent"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-ink-muted">{text}</span>
      </span>
    </label>
  );
  return (
    <StepForm project={project} step={LAST_FIELD_STEP}>
      <Group first title="Sample request" description="Sampling lets you check fit, fabric and finish before bulk production.">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium leading-5 text-ink">
            Do you need samples before bulk production?
            <span className="text-accent-strong" aria-hidden>
              {" "}
              *
            </span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {option(true, "Yes, request samples", "Factories include a sample lead time, charge and approach in their quotation.")}
            {option(false, "No, go straight to a pre-production sample", "For repeat styles. Every order still has one sample approved before cutting starts.")}
          </div>
        </fieldset>
      </Group>
      {/* Hidden and disabled while "No" is chosen: nothing is posted, so the saved sample details are cleared. */}
      <fieldset hidden={!required} disabled={!required} aria-labelledby="sample-details-title" className="min-w-0 space-y-5 border-t border-line-subtle pt-6">
        <div>
          <h3 id="sample-details-title" className="type-heading text-ink">
            What to sample
          </h3>
          <p className="mt-0.5 text-[13px] leading-5 text-ink-muted">Factories see this with the brief and propose how they will make it.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="sampleQuantity"
            label="Sample pieces"
            required
            hint={`Pieces in total, up to ${MAX_SAMPLE_PIECES}. One per size is common for a fit check.`}
          >
            <Input name="sampleQuantity" type="number" inputMode="numeric" min={1} max={MAX_SAMPLE_PIECES} defaultValue={project.sampleQuantity ?? 1} />
          </Field>
        </div>
        <ChipSelect
          name="sampleSizes"
          label="Sample sizes"
          options={sizeOptions}
          defaultValue={project.sampleSizes}
          allowCustom
          hint={project.sizes.length ? "Usually your base size. The options are the sizes in this brief." : "Usually your base size."}
        />
        <Field id="sampleNotes" label="Sample notes" hint="For example: make the sample in production fabric and trims, or send a size set after fit approval.">
          <Textarea name="sampleNotes" rows={3} maxLength={1000} defaultValue={project.sampleNotes ?? ""} />
        </Field>
      </fieldset>
    </StepForm>
  );
}
