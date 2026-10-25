import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, KeyRound, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { DescriptionList, PageHeader } from "@/components/app/primitives";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordForm } from "./password-form";
import { ROLE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireUser();
  return (
    <div className="max-w-5xl">
      <PageHeader title="Settings" description="Your sign-in details and account security." />
      <div className="divide-y divide-line">
        <SettingsSection id="account" icon={UserRound} title="Account" description="The person signed in to this workspace.">
          <div className="flex items-center gap-3 border-b border-line-subtle pb-4">
            <Avatar name={actor.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-medium text-navy">{actor.name}</p>
              <p className="truncate text-[13px] text-muted">{actor.email}</p>
            </div>
          </div>
          <DescriptionList
            layout="rows"
            items={[
              { label: "Account type", value: ROLE_LABEL[actor.role] },
              { label: "Sign-in method", value: "Email and password" },
            ]}
          />
          <p className="mt-4 text-xs leading-5 text-muted">
            To change your email address or account type, contact the Fashinza team from the{" "}
            <Link href="/contact" className="font-medium text-teal-700 underline-offset-2 hover:underline">contact page</Link>.
          </p>
        </SettingsSection>

        <SettingsSection id="password" icon={KeyRound} title="Change password" description="Use at least 8 characters with a letter and a number.">
          <ChangePasswordForm />
        </SettingsSection>

        <SettingsSection id="email" icon={BellRing} title="Email notifications" description="How Fashinza reaches you outside the app.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm leading-6 text-muted">
              Email delivery is not configured in this build. All notifications are kept in your in-app notification centre.
            </p>
            <Badge tone="neutral" className="shrink-0 self-start">Not configured</Badge>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

/** Settings row: title and explanation on the left, the card on the right (stacked on phones). */
function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-4 py-8 first:pt-0 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
      <div>
        <span className="mb-3 grid size-8 place-items-center rounded-md bg-teal-50 text-teal-700 max-lg:hidden">
          <Icon className="size-4" aria-hidden />
        </span>
        <h2 id={`${id}-title`} className="type-heading text-navy">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p>
      </div>
      <div className="rounded-lg border border-line bg-surface p-4 shadow-card sm:p-5">{children}</div>
    </section>
  );
}
