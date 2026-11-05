import * as React from "react";
import { startTransition, useActionState, useCallback, useContext, useEffect, useRef } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router";
import { Loader2 } from "lucide-react";
import { initialFormState } from "@fashinza/shared/form-state.js";
import { submitForm } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";

export const FormErrorsContext = React.createContext({});
const PendingContext = React.createContext(false);

/**
 * @typedef {import("@fashinza/shared/form-state.js").FormState & { goTo?: string }} ActionResult
 * @typedef {(prev: ActionResult, formData: FormData) => Promise<ActionResult>} FormAction
 */

/**
 * Form bound to an API mutation (it replaces the server-action form of the Next app). Field errors flow to
 * <Field> through context, a summary alert is shown for errors, and success shows a toast (and can reset or
 * call onSuccess).
 * After a failed submit the user is taken to the problem, wherever they are on a long form: the first
 * invalid control is scrolled to the middle of the screen and focused (its error is announced through
 * aria-describedby); without field errors the summary alert is scrolled into view and focused.
 *
 * `action` is either an API path (the form is posted as multipart FormData with `method`, default POST, and
 * the contract response becomes today's FormState) or a function `(prev, formData) => Promise<FormState>`
 * (use `submitForm` from lib/api inside it when a page needs to adjust the request).
 *
 *   <ActionForm action={`/api/orders/${id}/messages`} resetOnSuccess>…</ActionForm>
 *   <ActionForm action="/api/profile/brand" method="PUT">…</ActionForm>
 *
 * After a successful mutation without `redirectTo` the page data and the session (unread badge) are loaded
 * again before the form leaves its pending state, as `revalidatePath` did; with `redirectTo` the client
 * navigates there. Gate errors (signed out, wrong role, profile incomplete) navigate like the server's
 * redirect() did.
 */
export function ActionForm({ action, method = "POST", children, className, resetOnSuccess = false, onSuccess, showSuccessAlert = false, ...props }) {
  const navigate = useNavigate();
  const location = useLocation();
  const revalidator = useRevalidator();
  // Read through refs inside the action so a re-render during the request does not change the callback.
  const live = useRef({ revalidator, location, navigate });
  useEffect(() => {
    live.current = { revalidator, location, navigate };
  });
  // The toast is raised as soon as the action resolves, not in an effect: actions that
  // revalidate the page can unmount this form in the same render that delivers the result
  // (e.g. completing a stage removes its controls). Navigation (`redirectTo`, returned instead
  // of calling redirect()) happens in the effect below, once the action's result is rendered.
  const run = useCallback(
    async (prev, formData) => {
      const { location: here, revalidator: rv, navigate: go } = live.current;
      const result =
        typeof action === "function" ? await action(prev, formData) : await submitForm(action, formData, { method, path: `${here.pathname}${here.search}` });
      if (result.status === "success") {
        if (result.message && !showSuccessAlert) toast.success(result.message);
        // revalidatePath(): the refreshed page arrives together with the result.
        if (!result.redirectTo) await rv.revalidate();
      } else if (result.goTo) {
        go(result.goTo);
      }
      return result;
    },
    [action, method, showSuccessAlert],
  );
  const [state, formAction, pending] = useActionState(run, initialFormState);
  const ref = useRef(null);
  const summary = useRef(null);
  const handled = useRef(null);
  const shownError = useRef(null);
  useEffect(() => {
    if (state.status !== "error" || shownError.current === state) return;
    shownError.current = state;
    const form = ref.current;
    if (!form) return;
    const smooth = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const invalid = form.querySelector('[aria-invalid="true"]');
    if (invalid) {
      invalid.scrollIntoView({ block: "center", behavior: smooth });
      invalid.focus({ preventScroll: true });
      return;
    }
    // Errors on groups without a single control (file pickers, chip sets) carry data-field-error.
    const groupError = form.querySelector("[data-field-error]");
    const target = groupError ?? summary.current;
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: smooth });
    if (!groupError) summary.current?.focus({ preventScroll: true });
  }, [state]);
  useEffect(() => {
    if (state.status !== "success" || handled.current === state) return;
    handled.current = state;
    if (state.redirectTo) {
      navigate(state.redirectTo);
      return;
    }
    if (resetOnSuccess) ref.current?.reset();
    onSuccess?.(state);
  }, [state, resetOnSuccess, onSuccess, navigate]);

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
          const submitter = e.nativeEvent.submitter;
          const data = new FormData(e.currentTarget, submitter);
          startTransition(() => formAction(data));
        }}
        {...props}
      >
        {state.status === "error" && state.message && (
          <Alert ref={summary} tabIndex={-1} tone="error" className="mb-4 scroll-mt-24 outline-none">
            {state.message}
          </Alert>
        )}
        {showSuccessAlert && state.status === "success" && state.message && (
          <Alert tone="success" className="mb-4">
            {state.message}
          </Alert>
        )}
        <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      </form>
    </FormErrorsContext.Provider>
  );
}

/** Submit button that disables itself while the form is pending, preventing duplicate submissions. */
export function SubmitButton({ children, pendingText, ...props }) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
