import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/auth/session";
import { PageHeader, Panel } from "@/components/app/primitives";
import { BasicsStep, WizardSteps } from "@/components/projects/wizard";

export const metadata: Metadata = { title: "New production project" };

export default async function NewProjectPage() {
  await requireOnboardedUser(["BRAND"]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New production project"
        breadcrumbs={[{ href: "/projects", label: "Projects" }]}
        description="Your project is saved as a private draft after this step. Factories only see it once you submit it."
      />
      <WizardSteps current={1} reached={1} submitted={false} />
      <Panel>
        <BasicsStep project={null} />
      </Panel>
    </div>
  );
}
