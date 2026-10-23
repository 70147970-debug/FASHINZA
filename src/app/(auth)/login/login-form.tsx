"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction } from "../actions";
import { initialFormState, zodFieldErrors } from "@/lib/form-state";
import { loginSchema } from "@/lib/validation/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialFormState);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const errors = { ...state.fieldErrors, ...clientErrors };
  return (
    <form
      action={action}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
        if (!parsed.success) { e.preventDefault(); setClientErrors(zodFieldErrors(parsed.error)); } else setClientErrors({});
      }}
    >
      {state.message && <Alert tone={state.status === "success" ? "success" : "error"}>{state.message}</Alert>}
      <Field id="email" label="Email" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field id="password" label="Password" required error={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
