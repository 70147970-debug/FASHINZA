import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList, Eye, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/app/primitives";
import { BrandProfileForm, FactoryProfileForm } from "@/components/profile/profile-forms";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function OnboardingPage() {
  const actor = await requireUser();
  if (actor.role === "ADMIN") redirect("/admin");
  if (actor.profileCompleted) redirect(actor.role === "BRAND" ? "/dashboard" : "/factory");

  if (actor.role === "BRAND") {
    const p = await db.brandProfile.findUnique({ where: { userId: actor.id } });
    return (
      <OnboardingLayout
        steps={["Company profile", "First production project"]}
        title="Tell us about your company"
        description="Factories see your company name and country with the projects you send them. Next you can create your first production project."
        aside={[
          { icon: Eye, title: "What factories see", text: "Your company name, country and description — shown only with projects you submit." },
          { icon: ClipboardList, title: "Next: brief a project", text: "Describe the product, quantity and deadline. Drafts stay private until you submit." },
          { icon: Sparkles, title: "Then get matched", text: "Verified factories that meet every requirement are invited to quote." },
        ]}
      >
        <BrandProfileForm values={{ ...p, country: p?.country || "" }} submitLabel="Save and continue" />
      </OnboardingLayout>
    );
  }

  const p = await db.manufacturerProfile.findUnique({ where: { userId: actor.id }, include: { capabilities: true } });
  return (
    <OnboardingLayout
      steps={["Factory profile", "Documents and verification"]}
      title="Set up your factory profile"
      description="Your profile decides which projects you are matched to. Next you will upload documents and request verification — only verified factories receive opportunities."
      aside={[
        { icon: Sparkles, title: "Matching uses this profile", text: "Categories, processes, minimum order, capacity and lead time decide which projects you see." },
        { icon: FileCheck2, title: "Next: documents", text: "Upload your business registration and any certifications such as GOTS or OEKO-TEX." },
        { icon: ShieldCheck, title: "Then verification", text: "An administrator reviews your documents. Only verified factories receive opportunities." },
      ]}
    >
      <FactoryProfileForm
        values={{
          businessName: p?.businessName,
          contactName: p?.contactName ?? actor.name,
          contactEmail: p?.contactEmail ?? actor.email,
        }}
        submitLabel="Save and continue"
      />
    </OnboardingLayout>
  );
}

function OnboardingLayout({
  steps,
  title,
  description,
  aside,
  children,
}: {
  steps: [string, string];
  title: string;
  description: string;
  aside: { icon: LucideIcon; title: string; text: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <ol aria-label="Setup progress" className="mb-6 flex items-center gap-3 text-[13px]">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            {i > 0 && <span className="h-px w-6 bg-line-strong sm:w-10" aria-hidden />}
            <span className="flex items-center gap-2" aria-current={i === 0 ? "step" : undefined}>
              <span
                className={cn(
                  "tabular grid size-6 place-items-center rounded-full text-xs font-semibold",
                  i === 0 ? "bg-navy text-white" : "border border-line-strong bg-surface text-muted",
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className={i === 0 ? "font-medium text-navy" : "text-muted max-sm:sr-only"}>
                <span className="sr-only">Step {i + 1} of 2{i === 0 ? " (current)" : ""}: </span>
                {s}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <PageHeader title={title} description={description} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Panel>{children}</Panel>
        <aside aria-label="What happens next" className="lg:sticky lg:top-20 lg:self-start lg:pt-1">
          <p className="label-caps text-muted">What happens next</p>
          <ul className="mt-3 space-y-4">
            {aside.map((a) => (
              <li key={a.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700">
                  <a.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy">{a.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-muted">{a.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
