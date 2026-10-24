"use client";

import * as React from "react";
import { startTransition, useActionState, useCallback, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { type FormState, initialFormState } from "@/lib/form-state";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toaster";
import { Button, type ButtonProps } from "@/components/ui/button";

export type ServerAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export const FormErrorsContext = React.createContext<Record<string, string>>({});
const PendingContext = React.createContext(false);

/**
 * Form bound to a server action. Field errors flow to <Field> through context, a summary
 * alert is shown for errors, and success shows a toast (and can reset or call onSuccess).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  showSuccessAlert = false,
  ...props
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: ServerAction;
  resetOnSuccess?: boolean;
  onSuccess?: (state: FormState) => void;
  showSuccessAlert?: boolean;
}) {
  const router = useRouter();
  // The toast is raised as soon as the action resolves, not in an effect: actions that
  // revalidate the page can unmount this form in the same render that delivers the result
  // (e.g. completing a stage removes its controls). Navigation (`redirectTo`, returned instead
  // of calling redirect()) happens in the effect below, once the action's result is rendered.
  const run = useCallback<ServerAction>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result.status === "success") {
        if (result.message && !showSuccessAlert) toast.success(result.message);
      }
      return result;
    },
    [action, showSuccessAlert],
  );
  const [state, formAction, pending] = useActionState(run, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  const handled = useRef<FormState | null>(null);
  useEffect(() => {
    if (state.status !== "success" || handled.current === state) return;
    handled.current = state;
    if (state.redirectTo) {
      router.push(state.redirectTo);
      return;
    }
    if (resetOnSuccess) ref.current?.reset();
    onSuccess?.(state);
  }, [state, resetOnSuccess, onSuccess, router]);

  return (
    <FormErrorsContext.Provider value={state.status === "error" ? (state.fieldErrors ?? {}) : {}}>
      {/* Submitted via onSubmit + startTransition rather than the `action` prop: React resets
          forms after an action prop submission, which would wipe the user's input whenever the
          server returns validation errors. */}
      <form
        ref={ref}
        noValidate
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const data = new FormData(e.currentTarget, submitter);
          startTransition(() => formAction(data));
        }}
        {...props}
      >
        {state.status === "error" && state.message && <Alert tone="error" className="mb-4">{state.message}</Alert>}
        {showSuccessAlert && state.status === "success" && state.message && <Alert tone="success" className="mb-4">{state.message}</Alert>}
        <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      </form>
    </FormErrorsContext.Provider>
  );
}

/** Submit button that disables itself while the form is pending, preventing duplicate submissions. */
export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
