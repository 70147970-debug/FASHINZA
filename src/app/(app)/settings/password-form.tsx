"use client";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "../profile-actions";

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess className="max-w-sm space-y-4">
      <Field id="currentPassword" label="Current password" required>
        <Input name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field id="newPassword" label="New password" required>
        <Input name="newPassword" type="password" autoComplete="new-password" />
      </Field>
      <Field id="confirmPassword" label="Confirm new password" required>
        <Input name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </ActionForm>
  );
}
