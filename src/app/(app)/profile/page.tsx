import type { Metadata } from "next";
import { Eye, Lock, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/app/primitives";
import { BrandProfileForm } from "@/components/profile/profile-forms";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "Company profile" };

export default async function BrandProfilePage() {
  const actor = await requireOnboardedUser(["BRAND"]);
  const p = await db.brandProfile.findUniqueOrThrow({ where: { userId: actor.id } });
  return (
    <>
      <PageHeader title="Company profile" description="Factories you are matched with see your company name, country and description." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Company details" description="Saved changes apply to every project you send.">
          <BrandProfileForm values={p} />
        </Panel>

        <div className="space-y-6">
          <Panel title="What factories see" description="Shown with each project you submit for matching.">
            <div className="flex items-start gap-3">
              <Avatar name={p.companyName} shape="square" tone="navy" size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold text-navy">{p.companyName}</p>
                {p.country && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                    <MapPin className="size-3.5 shrink-0 text-subtle" aria-hidden /> {p.country}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-4 border-t border-line-subtle pt-4 text-sm leading-6 text-ink">
              {p.description || <span className="text-muted">No description yet. A short introduction helps factories decide how to quote.</span>}
            </p>
          </Panel>

          <Panel title="Privacy">
            <ul className="space-y-3 text-[13px] leading-5 text-muted">
              <li className="flex gap-2.5">
                <Eye className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                Factories see it only once they are matched to one of your submitted projects.
              </li>
              <li className="flex gap-2.5">
                <Lock className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                Your website, city, phone number and draft projects are not shown to factories.
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
