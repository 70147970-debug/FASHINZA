import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  return (
    <ActionForm action="/api/auth/forgot-password" className="space-y-5" showSuccessAlert>
      <Field id="email" label="Email" required>
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
      {import.meta.env.MODE !== "production" && (
        <p className="text-xs leading-5 text-ink-muted">Development build: no email service is configured, so the reset link is written to the server log.</p>
      )}
    </ActionForm>
  );
}

export function ResetPasswordForm({ token }) {
  return (
    <ActionForm action="/api/auth/reset-password" className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <Field id="password" label="New password" required hint="At least 8 characters, with a letter and a number.">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" required>
        <Input name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingText="Saving…">
        Set new password
      </SubmitButton>
    </ActionForm>
  );
}
