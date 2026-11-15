import { useEffect, useRef, useState } from "react";
import { Check, Circle } from "lucide-react";
import { passwordChecks } from "@fashinza/shared/validation/auth.js";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@fashinza/shared/utils.js";

/**
 * Live checklist of the password policy (PASSWORD_RULES in @fashinza/shared/validation/auth.js), shown under
 * every new-password field. Each rule is ticked as soon as the typed value meets it; nothing is ticked while the
 * field is empty. The field's own error message still comes from validation (zod on the client, then the server).
 * Point the input's aria-describedby at `id` so screen readers read the rules with the field; reaching every rule
 * is announced once, politely.
 * @param {{ id: string, value: string, className?: string }} props
 */
export function PasswordRequirements({ id, value, className }) {
  const checks = passwordChecks(value).map((c) => ({ ...c, met: Boolean(value) && c.met }));
  const done = checks.every((c) => c.met);
  return (
    <div id={id} className={cn("rounded-md border border-line bg-surface-muted/60 px-3 py-2.5", className)}>
      <p className="text-xs font-medium leading-5 text-ink">Your password needs:</p>
      <ul className="mt-1 grid gap-x-4 gap-y-0.5 min-[420px]:grid-cols-2">
        {checks.map((c) => (
          <li key={c.key} data-met={c.met ? "true" : "false"} className={cn("flex items-start gap-1.5 text-xs leading-5", c.met ? "text-success-strong" : "text-ink-muted")}>
            {c.met ? (
              <span className="mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-full border border-success-line bg-success-soft text-success-strong" aria-hidden>
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
            ) : (
              <Circle className="mt-[3px] size-3.5 shrink-0 text-ink-subtle" strokeWidth={2} aria-hidden />
            )}
            <span>
              {c.label}
              <span className="sr-only">{c.met ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {done ? "All password requirements are met." : ""}
      </p>
    </div>
  );
}

/**
 * A new-password field (label, input, error) with the live checklist under it. The input stays uncontrolled, so
 * the form still posts it as FormData; the checklist clears when its form is reset.
 * @param {{ id?: string, name?: string, label?: string, error?: string, autoComplete?: string }} props
 */
export function NewPasswordField({ id = "password", name, label = "Password", error, autoComplete = "new-password" }) {
  const [value, setValue] = useState("");
  const input = useRef(null);
  const checklistId = `${id}-requirements`;
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const clear = () => setValue("");
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);
  return (
    <div className="space-y-2">
      <Field id={id} name={name ?? id} label={label} required error={error}>
        <Input
          ref={input}
          name={name ?? id}
          type="password"
          autoComplete={autoComplete}
          aria-describedby={checklistId}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <PasswordRequirements id={checklistId} value={value} />
    </div>
  );
}
