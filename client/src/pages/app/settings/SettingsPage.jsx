import { Link, useLoaderData } from "react-router";
import { BellRing, KeyRound, Palette, UserRound } from "lucide-react";
import { DescriptionList, PageHeader } from "@/components/app/primitives";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ThemeSegmented } from "@/components/theme/theme-toggle";
import { PageMeta } from "@/components/meta";
import { ROLE_LABEL } from "@fashinza/shared/labels.js";

/** /settings — port of src/app/(app)/settings/page.tsx and password-form.tsx (gate: user). */

export async function loader({ user }) {
  return { actor: user };
}

/** Change password (POST /api/auth/change-password); the fields are cleared after a successful change. */
function ChangePasswordForm() {
  return (
    <ActionForm action="/api/auth/change-password" resetOnSuccess className="max-w-sm space-y-4">
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

export default function SettingsPage() {
  const { actor } = useLoaderData();
  return (
    <div className="max-w-5xl">
      <PageMeta title="Settings" />
      <PageHeader title="Settings" description="Your sign-in details and account security." />
      <div className="divide-y divide-line">
        <SettingsSection id="account" icon={UserRound} title="Account" description="The person signed in to this workspace.">
          <div className="flex items-center gap-3 border-b border-line-subtle pb-4">
            <Avatar name={actor.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-medium leading-6 text-ink">{actor.name}</p>
              <p className="truncate text-[13px] text-ink-muted">{actor.email}</p>
            </div>
          </div>
          <DescriptionList
            layout="rows"
            items={[
              { label: "Account type", value: ROLE_LABEL[actor.role] },
              { label: "Sign-in method", value: "Email and password" },
            ]}
          />
          <p className="mt-4 text-xs leading-5 text-ink-muted">
            To change your email address or account type, contact the Fashinza team from the{" "}
            <Link to="/contact" className="font-medium text-accent-strong underline-offset-2 hover:underline">
              contact page
            </Link>
            .
          </p>
        </SettingsSection>

        <SettingsSection id="password" icon={KeyRound} title="Change password" description="Use at least 8 characters with a letter and a number.">
          <ChangePasswordForm />
        </SettingsSection>

        <SettingsSection id="appearance" icon={Palette} title="Appearance" description="Applies to this browser only.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-sm text-sm leading-6 text-ink-muted">Choose a light or dark workspace, or follow your device setting.</p>
            <ThemeSegmented className="shrink-0 self-start sm:self-center" />
          </div>
        </SettingsSection>

        <SettingsSection id="email" icon={BellRing} title="Email notifications" description="How Fashinza reaches you outside the app.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm leading-6 text-ink-muted">
              Email notifications are not switched on yet. All notifications are kept in your in-app notification centre.
            </p>
            <Badge tone="neutral" className="shrink-0 self-start">
              Not configured
            </Badge>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

/** Settings row: title and explanation on the left, the card on the right (stacked on phones). */
function SettingsSection({ id, icon: Icon, title, description, children }) {
  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-4 py-8 first:pt-0 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12 lg:py-10">
      <div>
        <span className="mb-4 grid size-9 place-items-center rounded-md border border-line bg-surface text-ink-muted max-lg:hidden">
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 id={`${id}-title`} className="type-heading text-ink">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-ink-muted">{description}</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4 sm:p-6">{children}</div>
    </section>
  );
}
