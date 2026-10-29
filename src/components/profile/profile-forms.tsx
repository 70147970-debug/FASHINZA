"use client";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ChipSelect } from "@/components/forms/chip-select";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { CAPABILITIES, GARMENT_CATEGORIES } from "@/lib/constants";
import { saveBrandProfileAction, saveFactoryProfileAction } from "@/app/(app)/profile-actions";

type BrandValues = { companyName?: string; country?: string; city?: string | null; website?: string | null; phone?: string | null; description?: string | null };

export function BrandProfileForm({ values, submitLabel = "Save profile" }: { values: BrandValues; submitLabel?: string }) {
  return (
    <ActionForm action={saveBrandProfileAction} className="space-y-6">
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
        <SubmitButton variant={submitLabel === "Save and continue" ? "accent" : "primary"} pendingText="Saving…">{submitLabel}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

type FactoryValues = {
  businessName?: string;
  description?: string;
  country?: string;
  city?: string;
  categories?: string[];
  production?: string[];
  fabrics?: string[];
  finishing?: string[];
  minOrderQuantity?: number;
  maxMonthlyCapacity?: number;
  typicalLeadTimeDays?: number;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string | null;
  website?: string | null;
};

export function FactoryProfileForm({ values, submitLabel = "Save factory profile" }: { values: FactoryValues; submitLabel?: string }) {
  const num = (n?: number) => (n ? String(n) : "");
  return (
    <ActionForm action={saveFactoryProfileAction} className="space-y-8 [&>section+section]:border-t [&>section+section]:border-line-subtle [&>section+section]:pt-8">
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

      <section className="space-y-5" aria-labelledby="fp-capacity">
        <SectionHead id="fp-capacity" title="Capacity and lead time" description="Projects below your minimum, beyond your free capacity, or due sooner than your lead time are not matched to you." />
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
        <SubmitButton variant={submitLabel === "Save and continue" ? "accent" : "primary"} pendingText="Saving…">{submitLabel}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

function SectionHead({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div>
      <h3 id={id} className="type-heading text-ink">{title}</h3>
      {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-muted">{description}</p>}
    </div>
  );
}

/** Save row: full-width button on phones, right-aligned with a divider above from sm. */
function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 border-t border-line-subtle pt-5 sm:flex-row sm:justify-end">{children}</div>;
}
