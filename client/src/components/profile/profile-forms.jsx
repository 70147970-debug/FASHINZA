import { useContext, useId, useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { ActionForm, FormErrorsContext, SubmitButton } from "@/components/forms/action-form";
import { ChipSelect } from "@/components/forms/chip-select";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CAPABILITIES, GARMENT_CATEGORIES, MACHINERY_LIMITS, MACHINERY_TYPES } from "@fashinza/shared/constants.js";
import { cn } from "@fashinza/shared/utils.js";

export function BrandProfileForm({ values, submitLabel = "Save profile" }) {
  return (
    <ActionForm action="/api/profile/brand" method="PUT" className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="companyName" label="Company name" required>
          <Input name="companyName" defaultValue={values.companyName} autoComplete="organization" />
        </Field>
        <Field id="website" label="Website" hint="For example https://yourbrand.com">
          <Input name="website" type="url" defaultValue={values.website ?? ""} autoComplete="url" />
        </Field>
        <Field id="country" label="Country" required>
          <Input name="country" defaultValue={values.country} autoComplete="country-name" />
        </Field>
        <Field id="city" label="City">
          <Input name="city" defaultValue={values.city ?? ""} autoComplete="address-level2" />
        </Field>
        <Field id="phone" label="Phone">
          <Input name="phone" type="tel" defaultValue={values.phone ?? ""} autoComplete="tel" />
        </Field>
      </div>
      <Field id="description" label="About your brand" hint="What you sell and who you sell to. Factories see this with your projects.">
        <Textarea name="description" rows={4} defaultValue={values.description ?? ""} />
      </Field>
      <FormActions>
        <SubmitButton variant={submitLabel === "Save and continue" ? "accent" : "primary"} pendingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

export function FactoryProfileForm({ values, submitLabel = "Save factory profile" }) {
  const num = (n) => (n ? String(n) : "");
  return (
    <ActionForm
      action="/api/profile/factory"
      method="PUT"
      className="space-y-8 [&>section+section]:border-t [&>section+section]:border-line-subtle [&>section+section]:pt-8"
    >
      <section className="space-y-5" aria-labelledby="fp-business">
        <SectionHead id="fp-business" title="Business details" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="businessName" label="Factory or business name" required>
            <Input name="businessName" defaultValue={values.businessName} autoComplete="organization" />
          </Field>
          <Field id="website" label="Website">
            <Input name="website" type="url" defaultValue={values.website ?? ""} />
          </Field>
          <Field id="country" label="Country" required>
            <Input name="country" defaultValue={values.country} autoComplete="country-name" />
          </Field>
          <Field id="city" label="City" required>
            <Input name="city" defaultValue={values.city} autoComplete="address-level2" />
          </Field>
        </div>
        <Field id="description" label="About the factory" required hint="Machinery, specialities, team size and the brands or markets you usually serve.">
          <Textarea name="description" rows={4} defaultValue={values.description} />
        </Field>
      </section>

      <section className="space-y-5" aria-labelledby="fp-capabilities">
        <SectionHead id="fp-capabilities" title="Capabilities" description="Matching uses these to decide which projects you are invited to quote on." />
        <ChipSelect name="categories" label="Product categories" required options={GARMENT_CATEGORIES} defaultValue={values.categories} />
        <ChipSelect name="production" label="Production processes" required options={CAPABILITIES.PRODUCTION} defaultValue={values.production} allowCustom />
        <ChipSelect name="fabrics" label="Fabric expertise" options={CAPABILITIES.FABRIC} defaultValue={values.fabrics} allowCustom />
        <ChipSelect name="finishing" label="Finishing" options={CAPABILITIES.FINISHING} defaultValue={values.finishing} allowCustom />
      </section>

      <section className="space-y-5" aria-labelledby="fp-machinery">
        <SectionHead
          id="fp-machinery"
          title="Machinery"
          description="Your main machines and how many you run, for example 40 single-needle lockstitch machines. Brands see this list when you are matched to their project."
        />
        <MachineryEditor defaultValue={values.machinery ?? []} />
      </section>

      <section className="space-y-5" aria-labelledby="fp-capacity">
        <SectionHead
          id="fp-capacity"
          title="Capacity and lead time"
          description="Projects below your minimum, beyond your free capacity, or due sooner than your lead time are not matched to you."
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="minOrderQuantity" label="Minimum order (units)" required>
            <Input name="minOrderQuantity" type="number" inputMode="numeric" min={1} defaultValue={num(values.minOrderQuantity)} />
          </Field>
          <Field id="maxMonthlyCapacity" label="Monthly capacity (units)" required>
            <Input name="maxMonthlyCapacity" type="number" inputMode="numeric" min={1} defaultValue={num(values.maxMonthlyCapacity)} />
          </Field>
          <Field id="typicalLeadTimeDays" label="Typical lead time (days)" required>
            <Input name="typicalLeadTimeDays" type="number" inputMode="numeric" min={7} defaultValue={num(values.typicalLeadTimeDays ?? 45)} />
          </Field>
        </div>
      </section>

      <section className="space-y-5" aria-labelledby="fp-contact">
        <SectionHead id="fp-contact" title="Contact person" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="contactName" label="Name" required>
            <Input name="contactName" defaultValue={values.contactName} autoComplete="name" />
          </Field>
          <Field id="contactEmail" label="Email" required>
            <Input name="contactEmail" type="email" defaultValue={values.contactEmail} autoComplete="email" />
          </Field>
          <Field id="contactPhone" label="Phone">
            <Input name="contactPhone" type="tel" defaultValue={values.contactPhone ?? ""} autoComplete="tel" />
          </Field>
        </div>
      </section>

      <FormActions>
        <SubmitButton variant={submitLabel === "Save and continue" ? "accent" : "primary"} pendingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

/**
 * Editable machinery list: one row per machine type with a count. Rows post as parallel `machineType` /
 * `machineQuantity` lists; a row left empty is ignored by the server. Type suggestions come from a datalist,
 * so any other machine can still be typed.
 */
function MachineryEditor({ defaultValue }) {
  const id = useId();
  const errors = useContext(FormErrorsContext);
  const [rows, setRows] = useState(() =>
    (defaultValue.length ? defaultValue.map((m) => ({ type: m.type, quantity: String(m.quantity) })) : [{ type: "", quantity: "" }]).map((r, i) => ({
      key: i,
      ...r,
    })),
  );
  const full = rows.length >= MACHINERY_LIMITS.rows;
  const update = (key, patch) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const add = () => setRows((r) => (r.length >= MACHINERY_LIMITS.rows ? r : [...r, { key: Math.max(-1, ...r.map((x) => x.key)) + 1, type: "", quantity: "" }]));
  const remove = (key) => setRows((r) => (r.length === 1 ? [{ key: r[0].key + 1, type: "", quantity: "" }] : r.filter((x) => x.key !== key)));

  return (
    <fieldset aria-describedby={`${id}-hint`}>
      <legend className="mb-2 text-[13px] font-medium leading-5 text-ink">
        Machines <span className="font-normal text-ink-muted">(optional)</span>
      </legend>
      <div
        className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] gap-x-2 pb-1.5 text-xs font-medium text-ink-muted sm:grid-cols-[minmax(0,1fr)_7rem_2.25rem]"
        aria-hidden
      >
        <span>Machine type</span>
        <span>Quantity</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const typeError = errors[`machinery.${i}.type`];
          const qtyError = errors[`machinery.${i}.quantity`];
          const name = r.type.trim() || `row ${i + 1}`;
          return (
            <li key={r.key}>
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_2.25rem]">
                <div className="min-w-0">
                  <label htmlFor={`${id}-type-${r.key}`} className="sr-only">
                    Machine type, row {i + 1}
                  </label>
                  <Input
                    id={`${id}-type-${r.key}`}
                    name="machineType"
                    list={`${id}-types`}
                    value={r.type}
                    onChange={(e) => update(r.key, { type: e.target.value })}
                    maxLength={80}
                    placeholder="e.g. Overlock 4-thread"
                    autoComplete="off"
                    aria-invalid={typeError ? true : undefined}
                    aria-describedby={typeError ? `${id}-type-${r.key}-error` : undefined}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor={`${id}-qty-${r.key}`} className="sr-only">
                    Quantity of {name}
                  </label>
                  <Input
                    id={`${id}-qty-${r.key}`}
                    name="machineQuantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MACHINERY_LIMITS.quantity}
                    value={r.quantity}
                    onChange={(e) => update(r.key, { quantity: e.target.value })}
                    className="tabular"
                    aria-invalid={qtyError ? true : undefined}
                    aria-describedby={qtyError ? `${id}-qty-${r.key}-error` : undefined}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" className="sm:size-9" onClick={() => remove(r.key)} aria-label={`Remove ${name}`}>
                  <Trash2 className="text-ink-muted" />
                </Button>
              </div>
              {(typeError || qtyError) && (
                <div className="mt-1 space-y-0.5">
                  {[
                    { msg: typeError, eid: `${id}-type-${r.key}-error` },
                    { msg: qtyError, eid: `${id}-qty-${r.key}-error` },
                  ]
                    .filter((x) => x.msg)
                    .map((x) => (
                      <p key={x.eid} id={x.eid} className="flex items-start gap-1 text-xs font-medium leading-4 text-danger-strong">
                        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
                        {x.msg}
                      </p>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <datalist id={`${id}-types`}>
        {MACHINERY_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={full}>
          <Plus /> Add machine
        </Button>
        <p id={`${id}-hint`} className={cn("text-xs text-ink-muted", full && "text-warning-strong")}>
          {full ? `You can list up to ${MACHINERY_LIMITS.rows} machine types.` : "Start typing for common machines, or enter your own."}
        </p>
      </div>
      {errors.machinery && <p className="mt-1.5 text-xs font-medium leading-4 text-danger-strong">{errors.machinery}</p>}
    </fieldset>
  );
}

function SectionHead({ id, title, description }) {
  return (
    <div>
      <h3 id={id} className="type-heading text-ink">
        {title}
      </h3>
      {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-muted">{description}</p>}
    </div>
  );
}

/** Save row: full-width button on phones, right-aligned with a divider above from sm. */
function FormActions({ children }) {
  return <div className="flex flex-col gap-2 border-t border-line-subtle pt-5 sm:flex-row sm:justify-end">{children}</div>;
}
