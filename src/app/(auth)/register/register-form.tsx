"use client";

import { useActionState, useState } from "react";
import { Factory, Loader2, Shirt } from "lucide-react";
import { registerAction } from "../actions";
import { initialFormState, zodFieldErrors } from "@/lib/form-state";
import { registerSchema } from "@/lib/validation/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "BRAND", label: "Fashion brand", hint: "I want to manufacture clothing", icon: Shirt },
  { value: "MANUFACTURER", label: "Manufacturer", hint: "I run a clothing factory", icon: Factory },
] as const;

export function RegisterForm({ defaultRole }: { defaultRole: "BRAND" | "MANUFACTURER" }) {
  const [state, action, pending] = useActionState(registerAction, initialFormState);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState(defaultRole);
  const errors = { ...state.fieldErrors, ...clientErrors };
  return (
    <form
      action={action}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
        if (!parsed.success) { e.preventDefault(); setClientErrors(zodFieldErrors(parsed.error)); } else setClientErrors({});
      }}
    >
      {state.message && <Alert tone={state.status === "success" ? "success" : "error"}>{state.message}</Alert>}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Account type <span className="text-danger" aria-hidden>*</span></legend>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal",
                role === r.value ? "border-teal bg-teal-50" : "border-line bg-white hover:bg-canvas",
              )}
            >
              <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="sr-only" />
              <r.icon className="size-5 text-teal" aria-hidden />
              <span className="font-medium text-navy">{r.label}</span>
              <span className="text-xs text-muted">{r.hint}</span>
            </label>
          ))}
        </div>
        {errors.role && <p className="mt-1 text-xs text-danger">{errors.role}</p>}
      </fieldset>
      <Field id="name" label="Full name" required error={errors.name}>
        <Input name="name" autoComplete="name" />
      </Field>
      <Field id="organization" label={role === "BRAND" ? "Brand or company name" : "Factory or business name"} required error={errors.organization}>
        <Input name="organization" autoComplete="organization" />
      </Field>
      <Field id="email" label="Work email" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field id="password" label="Password" required error={errors.password} hint="At least 8 characters, with a letter and a number.">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field id="confirmPassword" label="Confirm password" required error={errors.confirmPassword}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
