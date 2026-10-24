import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/app/primitives";
import { BrandProfileForm } from "@/components/profile/profile-forms";

export const metadata: Metadata = { title: "Company profile" };

export default async function BrandProfilePage() {
  const actor = await requireOnboardedUser(["BRAND"]);
  const p = await db.brandProfile.findUniqueOrThrow({ where: { userId: actor.id } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Company profile" description="Factories you are matched with see your company name, country and description." />
      <Panel>
        <BrandProfileForm values={p} />
      </Panel>
    </div>
  );
}
