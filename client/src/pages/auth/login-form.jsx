import { startTransition, useActionState, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { submitForm } from "@/lib/api";
import { initialFormState, zodFieldErrors } from "@fashinza/shared/form-state.js";
import { loginSchema } from "@fashinza/shared/validation/auth.js";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function LoginForm({ next }) {
  const navigate = useNavigate();
  // POST /api/auth/login; the server action redirected on success, so the pending state lasts until the next page is shown.
  const [state, action, pending] = useActionState(async (_prev, formData) => {
    const result = await submitForm("/api/auth/login", formData);
    if (result.status === "success" && result.redirectTo) await navigate(result.redirectTo);
    return result.status === "success" ? { status: "success" } : result;
  }, initialFormState);
  const [clientErrors, setClientErrors] = useState({});
  const errors = { ...state.fieldErrors, ...clientErrors };
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        const parsed = loginSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
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
      {next && <input type="hidden" name="next" value={next} />}
      <Field id="email" label="Email" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <div className="relative">
        <Field id="password" label="Password" required error={errors.password}>
          <Input name="password" type="password" autoComplete="current-password" />
        </Field>
        <Link
          to="/forgot-password"
          className="absolute right-0 top-0 -mt-3.5 inline-flex rounded-sm pb-1.5 pl-3 pt-3.5 text-[13px] font-medium leading-5 text-accent-strong underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
