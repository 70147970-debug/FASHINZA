import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/app/primitives";
import { BasicsStep } from "@/components/projects/wizard";
import { STEP_INFO, WizardSteps } from "@/components/projects/wizard-steps";

export const metadata: Metadata = { title: "New production project" };

export default async function NewProjectPage() {
  await requireOnboardedUser(["BRAND"]);
  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Project brief"
        title="New production project"
        breadcrumbs={[{ href: "/projects", label: "Projects" }]}
        description="Your project is saved as a private draft after this step. Factories only see it once you submit it."
      />
      <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <WizardSteps current={1} reached={1} submitted={false} />
        <Panel title="Basics" description={STEP_INFO[1]}>
          <BasicsStep project={null} />
        </Panel>
      </div>
    </div>
  );
}
