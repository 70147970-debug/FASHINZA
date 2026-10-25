"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { loginAction } from "../actions";
import { initialFormState, zodFieldErrors } from "@/lib/form-state";
import { loginSchema } from "@/lib/validation/auth";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialFormState);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const errors = { ...state.fieldErrors, ...clientErrors };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
        // Submitted manually so React does not reset the form (and the user's input) after a server error.
        e.preventDefault();
        if (!parsed.success) { setClientErrors(zodFieldErrors(parsed.error)); return; }
        setClientErrors({});
        if (pending) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {state.message && <Alert tone={state.status === "success" ? "success" : "error"}>{state.message}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="email" label="Email" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <div className="relative">
        <Field id="password" label="Password" required error={errors.password}>
          <Input name="password" type="password" autoComplete="current-password" />
        </Field>
        <Link href="/forgot-password" className="absolute right-0 top-0 rounded-sm text-[13px] font-medium leading-5 text-teal-700 hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
