import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/app/primitives";
import { BrandProfileForm, FactoryProfileForm } from "@/components/profile/profile-forms";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function OnboardingPage() {
  const actor = await requireUser();
  if (actor.role === "ADMIN") redirect("/admin");
  if (actor.profileCompleted) redirect(actor.role === "BRAND" ? "/dashboard" : "/factory");

  if (actor.role === "BRAND") {
    const p = await db.brandProfile.findUnique({ where: { userId: actor.id } });
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Tell us about your company" description="Step 1 of 2 · Factories see your company name and country with the projects you send them. Next you can create your first production project." />
        <Panel>
          <BrandProfileForm values={{ ...p, country: p?.country || "" }} submitLabel="Save and continue" />
        </Panel>
      </div>
    );
  }

  const p = await db.manufacturerProfile.findUnique({ where: { userId: actor.id }, include: { capabilities: true } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Set up your factory profile"
        description="Step 1 of 2 · Your profile decides which projects you are matched to. Next you will upload documents and request verification — only verified factories receive opportunities."
      />
      <Panel>
        <FactoryProfileForm
          values={{
            businessName: p?.businessName,
            contactName: p?.contactName ?? actor.name,
            contactEmail: p?.contactEmail ?? actor.email,
          }}
          submitLabel="Save and continue"
        />
      </Panel>
    </div>
  );
}
