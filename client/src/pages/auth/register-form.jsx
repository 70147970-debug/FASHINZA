import { startTransition, useActionState, useState } from "react";
import { useNavigate } from "react-router";
import { Check, Factory, Loader2, Shirt } from "lucide-react";
import { submitForm } from "@/lib/api";
import { initialFormState, zodFieldErrors } from "@fashinza/shared/form-state.js";
import { registerSchema } from "@fashinza/shared/validation/auth.js";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@fashinza/shared/utils.js";

const ROLES = [
  { value: "BRAND", label: "Fashion brand", hint: "I'm producing a clothing collection", icon: Shirt },
  { value: "MANUFACTURER", label: "Manufacturer", hint: "I run a garment factory", icon: Factory },
];

export function RegisterForm({ defaultRole }) {
  const navigate = useNavigate();
  // POST /api/auth/register; the server action redirected on success, so the pending state lasts until the next page is shown.
  const [state, action, pending] = useActionState(async (_prev, formData) => {
    const result = await submitForm("/api/auth/register", formData);
    if (result.status === "success" && result.redirectTo) await navigate(result.redirectTo);
    return result.status === "success" ? { status: "success" } : result;
  }, initialFormState);
  const [clientErrors, setClientErrors] = useState({});
  const [role, setRole] = useState(defaultRole);
  const errors = { ...state.fieldErrors, ...clientErrors };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
        // Submitted manually so React does not reset the form (and the user's input) after a server error.
        e.preventDefault();
        if (!parsed.success) {
          setClientErrors(zodFieldErrors(parsed.error));
          return;
        }
        setClientErrors({});
        if (pending) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {state.message && <Alert tone={state.status === "success" ? "success" : "error"}>{state.message}</Alert>}
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">
          Account type{" "}
          <span className="text-accent-strong" aria-hidden>
            *
          </span>
        </legend>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-md border p-3.5 text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-canvas",
                role === r.value ? "border-accent bg-accent-soft" : "border-line-control bg-surface hover:bg-surface-hover",
              )}
            >
              <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="sr-only" />
              <span
                className={cn(
                  "absolute right-3 top-3 grid size-4 place-items-center rounded-full border",
                  role === r.value ? "border-accent bg-accent text-accent-fg" : "border-line-control bg-surface",
                )}
                aria-hidden
              >
                {role === r.value && <Check className="size-2.5" strokeWidth={3.5} />}
              </span>
              <r.icon className={cn("mb-1 size-5", role === r.value ? "text-accent-strong" : "text-ink-subtle")} aria-hidden />
              <span className="font-medium text-ink">{r.label}</span>
              <span className="text-xs leading-4 text-ink-muted">{r.hint}</span>
            </label>
          ))}
        </div>
        {errors.role && <p className="mt-1.5 text-xs text-danger-strong">{errors.role}</p>}
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
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
