import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { getProject } from "@/server/services/projects";
import { isAppError } from "@/server/errors";
import { DetailList, PageHeader, Panel } from "@/components/app/primitives";
import { BasicsStep, QuantityStep, SpecificationsStep, SustainabilityStep, WizardSteps, type WizardProject } from "@/components/projects/wizard";
import { FileUploader } from "@/components/projects/file-uploader";
import { AttachmentList } from "@/components/projects/attachment-list";
import { DeleteDraftButton, SubmitProjectForm } from "@/components/projects/project-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { projectSubmitSchema, PROJECT_STEPS } from "@/lib/validation/project";
import { categoryLabel } from "@/lib/labels";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Edit project" };

const FIELD_STEP: Record<string, number> = Object.fromEntries(PROJECT_STEPS.flatMap((s) => s.fields.map((f) => [f, s.step])));
const FIELD_LABEL: Record<string, string> = {
  name: "Project name", category: "Category", description: "Product description", fabricRequirements: "Fabric type and composition", colors: "Colours", sizes: "Sizes",
  quantity: "Quantity", deadline: "Delivery date", maxMoq: "MOQ limit", techPack: "Tech pack",
};

export default async function EditProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string; saved?: string }> }) {
  const actor = await requireOnboardedUser(["BRAND"]);
  const { id } = await params;
  const sp = await searchParams;
  const project = await getProject(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const isDraft = project.status === "DRAFT";
  if (!isDraft && !["SUBMITTED", "QUOTING"].includes(project.status)) redirect(`/projects/${id}`);
  const maxStep = isDraft ? 6 : 4;
  const step = Math.min(Math.max(Number(sp.step) || (isDraft ? project.wizardStep : 1), 1), maxStep);

  const wp: WizardProject = {
    ...project,
    targetUnitPrice: project.targetUnitPrice?.toFixed(2) ?? null,
    deadline: project.deadline ? project.deadline.toISOString().slice(0, 10) : null,
  };

  // Review step: what still blocks submission, with links to the step that fixes it.
  const check = projectSubmitSchema.safeParse(Object.fromEntries(Object.entries(project).map(([k, v]) => [k, v === null ? undefined : k === "targetUnitPrice" ? String(v) : v])));
  const issues = check.success ? [] : check.error.issues.map((i) => ({ field: String(i.path[0]), message: i.message }));
  if (!project.attachments.some((a) => a.kind === "TECH_PACK")) issues.push({ field: "techPack", message: "Upload at least one tech pack." });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={isDraft ? project.name : `Edit ${project.name}`}
        breadcrumbs={[{ href: "/projects", label: "Projects" }, ...(isDraft ? [] : [{ href: `/projects/${id}`, label: project.name }])]}
        description={isDraft ? "Draft — only you can see this project until you submit it." : "Changes are recorded in the project history and quoting factories are notified."}
        actions={isDraft ? <DeleteDraftButton projectId={id} /> : undefined}
      />
      {sp.saved && <Alert tone="success" className="mb-4">Draft saved. You can leave and continue later from your projects list.</Alert>}
      <WizardSteps projectId={id} current={step} reached={isDraft ? project.wizardStep : 4} submitted={!isDraft} />

      {step === 1 && <Panel><BasicsStep project={wp} /></Panel>}
      {step === 2 && <Panel><SpecificationsStep project={wp} /></Panel>}
      {step === 3 && <Panel><QuantityStep project={wp} /></Panel>}
      {step === 4 && <Panel><SustainabilityStep project={wp} /></Panel>}

      {step === 5 && (
        <Panel title="Tech pack and files" description="Upload your tech pack (required to submit) plus any sketches. Every new tech pack upload becomes the next version; earlier versions are kept.">
          <div className="space-y-6">
            <AttachmentList items={project.attachments} canDelete projectId={id} />
            <FileUploader projectId={id} />
            <div className="flex justify-end border-t border-line pt-5">
              <Button asChild variant="accent"><Link href={`/projects/${id}/edit?step=6`}>Continue to review <ArrowRight /></Link></Button>
            </div>
          </div>
        </Panel>
      )}

      {step === 6 && (
        <div className="space-y-6">
          {issues.length > 0 ? (
            <Alert tone="error">
              <p className="font-medium">Complete these before submitting:</p>
              <ul className="mt-2 space-y-1">
                {issues.map((i) => (
                  <li key={i.field + i.message}>
                    <Link href={`/projects/${id}/edit?step=${i.field === "techPack" ? 5 : (FIELD_STEP[i.field] ?? 1)}`} className="underline">
                      {FIELD_LABEL[i.field] ?? i.field}
                    </Link>
                    : {i.message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert tone="success"><span className="flex items-center gap-1"><CheckCircle2 className="size-4" /> Everything factories need is in place.</span></Alert>
          )}
          <Panel title="Review">
            <DetailList
              items={[
                { label: "Category", value: categoryLabel(project.category) },
                { label: "Quantity", value: project.quantity ? `${formatNumber(project.quantity)} units` : "—" },
                { label: "Target price", value: project.targetUnitPrice ? `${formatMoney(project.targetUnitPrice, project.currency)} / unit` : "Not shared" },
                { label: "Delivery date", value: formatDate(project.deadline) },
                { label: "Fabric", value: project.fabricRequirements },
                { label: "Fabrics to match", value: project.fabrics.join(", ") || "—" },
                { label: "Colours", value: project.colors },
                { label: "Sizes", value: project.sizes.join(", ") || "—" },
                { label: "Manufacturing requirements", value: project.requiredCapabilities.join(", ") || "None" },
                { label: "Required certifications", value: project.requiredCertifications.join(", ") || "None" },
                { label: "Preferred country", value: project.preferredCountry ?? "No preference" },
                { label: "Files", value: `${project.attachments.length} uploaded` },
              ]}
            />
            {project.description && <p className="mt-5 whitespace-pre-line border-t border-line pt-4 text-sm text-ink">{project.description}</p>}
          </Panel>
          <Panel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex max-w-xl gap-2 text-sm text-muted">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                Submitting runs factory matching. Verified factories that meet every requirement are invited to quote and can see this project and its files.
              </p>
              <SubmitProjectForm projectId={id} disabled={issues.length > 0} />
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
