import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/app/primitives";
import { BrandApprovalNotice, brandIsApproved } from "@/components/app/brand-approval";
import { BasicsStep } from "@/components/projects/wizard";
import { STEP_INFO, WizardSteps } from "@/components/projects/wizard-steps";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { useSessionUser } from "@/lib/session";

export default function NewProjectPage() {
  const user = useSessionUser();
  // Brands waiting for approval (or rejected) cannot create projects yet; the server refuses with BRAND_NOT_APPROVED.
  const approved = brandIsApproved(user);
  return (
    <div className="max-w-5xl">
      <PageMeta title="New production project" />
      <PageHeader
        eyebrow="Project brief"
        title="New production project"
        breadcrumbs={[{ href: "/projects", label: "Projects" }]}
        description={
          approved
            ? "Your project is saved as a private draft after this step. Factories only see it once you submit it."
            : "You can brief your first project as soon as Fashinza has approved your brand."
        }
      />
      {approved ? (
        <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
          <WizardSteps current={1} reached={1} submitted={false} />
          <Panel title="Basics" description={STEP_INFO[1]}>
            <BasicsStep project={null} />
          </Panel>
        </div>
      ) : (
        <>
          <BrandApprovalNotice user={user} />
          <Button asChild variant="outline">
            <Link to="/dashboard">
              <ArrowLeft /> Back to dashboard
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
