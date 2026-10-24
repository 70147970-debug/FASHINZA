import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { DetailList, PageHeader, Panel } from "@/components/app/primitives";
import { ChangePasswordForm } from "./password-form";
import { ROLE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireUser();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Your sign-in details and account security." />
      <Panel title="Account">
        <DetailList items={[{ label: "Name", value: actor.name }, { label: "Email", value: actor.email }, { label: "Account type", value: ROLE_LABEL[actor.role] }]} />
        <p className="mt-4 text-xs text-muted">To change your email address or account type, contact the Fashinza team from the contact page.</p>
      </Panel>
      <Panel title="Change password" description="Use at least 8 characters with a letter and a number.">
        <ChangePasswordForm />
      </Panel>
      <Panel title="Email notifications">
        <p className="text-sm text-muted">
          Email delivery is not configured in this build. All notifications are kept in your in-app notification centre.
        </p>
      </Panel>
    </div>
  );
}
