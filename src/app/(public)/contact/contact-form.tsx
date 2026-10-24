"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { submitContact } from "./actions";
import { initialFormState, zodFieldErrors } from "@/lib/form-state";
import { contactSchema, INQUIRY_TYPES } from "@/lib/validation/contact";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, initialFormState);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const errors = { ...state.fieldErrors, ...clientErrors };

  if (state.status === "success") {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        const parsed = contactSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
        // Submitted manually so React does not reset the form (and the user's input) after a server error.
        e.preventDefault();
        if (!parsed.success) {
          setClientErrors(zodFieldErrors(parsed.error));
        } else if (!pending) {
          setClientErrors({});
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }
      }}
    >
      {state.status === "error" && state.message && <Alert tone="error">{state.message}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Full name" required error={errors.name}>
          <Input name="name" autoComplete="name" />
        </Field>
        <Field id="email" label="Email" required error={errors.email}>
          <Input name="email" type="email" autoComplete="email" />
        </Field>
        <Field id="company" label="Company" error={errors.company}>
          <Input name="company" autoComplete="organization" />
        </Field>
        <Field id="inquiryType" label="Enquiry type" required error={errors.inquiryType}>
          <Select name="inquiryType" defaultValue="">
            <option value="" disabled>Choose one</option>
            {INQUIRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>
      <Field id="subject" label="Subject" required error={errors.subject}>
        <Input name="subject" />
      </Field>
      <Field id="message" label="Message" required error={errors.message} hint="At least 20 characters.">
        <Textarea name="message" rows={6} />
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
