import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Check, Loader2, Mail, RotateCcw } from "lucide-react";
import { submitForm } from "@/lib/api";
import { zodFieldErrors } from "@fashinza/shared/form-state.js";
import { forgotPasswordSchema, resetPasswordSchema, RESET_CODE_LENGTH } from "@fashinza/shared/validation/auth.js";
import { NewPasswordField } from "@/components/forms/password-requirements";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@fashinza/shared/utils.js";

/*
 * Forgot password with an emailed code (POST /api/auth/forgot-password → /forgot-password/verify →
 * /reset-password). Step 1 asks for the email and always gets the same answer, whether or not an account exists.
 * Step 2 checks the 6-digit code ("Resend code" after a cooldown). The right code unlocks step 3, the new password,
 * which signs the account out everywhere and sends the user to /login?reset=1.
 */

const STEPS = ["Email", "Code", "New password"];

function StepList({ current }) {
  return (
    <ol aria-label="Reset progress" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-3">
            {i > 0 && <span className="h-px w-4 bg-line-strong sm:w-6" aria-hidden />}
            <span className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "tabular grid size-6 place-items-center rounded-full text-xs font-semibold",
                  active && "border-2 border-accent bg-surface text-accent-strong",
                  done && "border border-accent bg-accent text-accent-fg",
                  !active && !done && "border border-line-strong bg-canvas text-ink-muted",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={active ? "font-medium text-ink" : "text-ink-muted"}>
                <span className="sr-only">
                  Step {i + 1} of {STEPS.length}
                  {active ? " (current)" : done ? " (done)" : ""}:{" "}
                </span>
                {s}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const secondsUntil = (until) => Math.max(0, Math.ceil((until - Date.now()) / 1000));

/** Seconds left until `until` (a timestamp), updated every second. */
function useCountdown(until) {
  const [left, setLeft] = useState(() => secondsUntil(until));
  useEffect(() => {
    const update = () => setLeft(secondsUntil(until));
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [until]);
  return left;
}

function Pending({ pending, pendingText, children }) {
  return pending ? (
    <>
      <Loader2 className="animate-spin" aria-hidden /> {pendingText}
    </>
  ) : (
    children
  );
}

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [token, setToken] = useState("");

  const codeSent = (result) => {
    setEmail(result.email);
    setSent(result.message);
    setResendAt(Date.now() + (Number(result.resendAfter) || 60) * 1000);
  };

  return (
    <div>
      <StepList current={step} />
      {step === 0 && (
        <EmailStep
          defaultEmail={email}
          onSent={(result) => {
            codeSent(result);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <CodeStep
          email={email}
          sent={sent}
          resendAt={resendAt}
          onResent={codeSent}
          onChangeEmail={() => setStep(0)}
          onVerified={(t) => {
            setToken(t);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <PasswordStep
          token={token}
          onRestart={() => {
            setToken("");
            setStep(0);
          }}
          onDone={(to) => navigate(to)}
        />
      )}
    </div>
  );
}

function EmailStep({ defaultEmail, onSent }) {
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(data));
        if (!parsed.success) {
          setErrors(zodFieldErrors(parsed.error));
          setMessage("");
          e.currentTarget.querySelector('[name="email"]')?.focus();
          return;
        }
        setErrors({});
        setMessage("");
        setPending(true);
        const result = await submitForm("/api/auth/forgot-password", data);
        setPending(false);
        if (result.status === "success") onSent(result);
        else {
          setErrors(result.fieldErrors ?? {});
          setMessage(result.fieldErrors ? "" : result.message);
        }
      }}
    >
      {message && <Alert tone="error">{message}</Alert>}
      <Field id="email" label="Email" required error={errors.email}>
        <Input name="email" type="email" autoComplete="email" defaultValue={defaultEmail} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        <Pending pending={pending} pendingText="Sending…">
          Send code
        </Pending>
      </Button>
      {import.meta.env.MODE !== "production" && (
        <p className="text-xs leading-5 text-ink-muted">
          Development build: when no email service (SMTP) is configured, the code is written to the server console instead of being emailed.
        </p>
      )}
    </form>
  );
}

function CodeStep({ email, sent, resendAt, onResent, onChangeEmail, onVerified }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState({ tone: "success", text: sent });
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const input = useRef(null);
  const wait = useCountdown(resendAt);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const resend = async () => {
    if (resending || wait > 0) return;
    setResending(true);
    const result = await submitForm("/api/auth/forgot-password", { email });
    setResending(false);
    if (result.status === "success") {
      onResent(result);
      setError("");
      setMessage({ tone: "success", text: `We've sent a new code. ${result.message}` });
      if (input.current) input.current.value = "";
      input.current?.focus();
    } else {
      setMessage({ tone: "error", text: result.message });
    }
  };

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        if (!String(data.get("code") ?? "").trim()) {
          setError("Enter the 6-digit code from the email.");
          input.current?.focus();
          return;
        }
        setPending(true);
        const result = await submitForm("/api/auth/forgot-password/verify", data);
        setPending(false);
        if (result.status === "success" && result.resetToken) {
          onVerified(result.resetToken);
          return;
        }
        // Code problems (incorrect, expired, too many attempts) are shown on the field; anything else above the form.
        if (result.fieldErrors?.code) {
          setError(result.fieldErrors.code);
          setMessage({ tone: "success", text: "" });
          input.current?.select();
          input.current?.focus();
        } else {
          setError("");
          setMessage({ tone: "error", text: result.message });
        }
      }}
    >
      {message.text && <Alert tone={message.tone === "error" ? "error" : "success"}>{message.text}</Alert>}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <Mail className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <span>
          Code sent to <span className="break-all font-medium text-ink">{email}</span>
        </span>
        <button
          type="button"
          onClick={onChangeEmail}
          className="inline-flex min-h-8 items-center rounded-sm font-medium text-accent-strong underline decoration-accent-line underline-offset-4 hover:decoration-accent-strong max-sm:min-h-10"
        >
          Use a different email
        </button>
      </p>
      <input type="hidden" name="email" value={email} />
      <Field id="code" label="6-digit code" required error={error} hint={`Check your inbox (and spam folder) for an email from Fashinza. The code has ${RESET_CODE_LENGTH} digits.`}>
        <Input
          ref={input}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={RESET_CODE_LENGTH + 3}
          spellCheck={false}
          className="tabular text-lg tracking-[0.3em]"
          onInput={() => error && setError("")}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        <Pending pending={pending} pendingText="Checking…">
          Verify code
        </Pending>
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm text-ink-muted">
        <span>Didn't get it?</span>
        <Button type="button" variant="outline" size="sm" onClick={resend} disabled={wait > 0 || resending} aria-busy={resending || undefined}>
          <RotateCcw aria-hidden />
          {wait > 0 ? (
            <>
              Resend code <span className="tabular">in {wait} s</span>
            </>
          ) : resending ? (
            "Sending…"
          ) : (
            "Resend code"
          )}
        </Button>
      </div>
    </form>
  );
}

function PasswordStep({ token, onRestart, onDone }) {
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const form = useRef(null);

  useEffect(() => {
    form.current?.querySelector('[name="password"]')?.focus();
  }, []);

  return (
    <form
      ref={form}
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        const parsed = resetPasswordSchema.safeParse(Object.fromEntries(data));
        if (!parsed.success) {
          const fieldErrors = zodFieldErrors(parsed.error);
          setErrors(fieldErrors);
          setMessage("");
          e.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
          if (!fieldErrors.password && !fieldErrors.confirmPassword) setMessage(parsed.error.issues[0]?.message ?? "");
          return;
        }
        setErrors({});
        setMessage("");
        setPending(true);
        const result = await submitForm("/api/auth/reset-password", data);
        if (result.status === "success") {
          onDone(result.redirectTo ?? "/login?reset=1");
          return;
        }
        setPending(false);
        setErrors(result.fieldErrors ?? {});
        setMessage(result.fieldErrors ? "" : result.message);
        setExpired(!result.fieldErrors && result.code === "INVALID");
      }}
    >
      <Alert tone="success">Code accepted. Choose a new password; setting it signs you out on every other device.</Alert>
      {message && (
        <Alert tone="error">
          {message}
          {expired && (
            <Button type="button" variant="link" size="sm" className="ml-1 align-baseline" onClick={onRestart}>
              Start again
            </Button>
          )}
        </Alert>
      )}
      <input type="hidden" name="token" value={token} />
      <NewPasswordField id="password" label="New password" error={errors.password} />
      <Field id="confirmPassword" label="Confirm new password" required error={errors.confirmPassword}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending || undefined}>
        <Pending pending={pending} pendingText="Saving…">
          Set new password
        </Pending>
      </Button>
    </form>
  );
}
