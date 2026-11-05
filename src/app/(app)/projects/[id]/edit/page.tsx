import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Check, Circle, Pencil, Send } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { getProject } from "@/server/services/projects";
import { isAppError } from "@/server/errors";
import { DescriptionList, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { BasicsStep, QuantityStep, SamplesStep, SpecificationsStep, SustainabilityStep, type WizardProject } from "@/components/projects/wizard";
import { STEP_INFO, WizardSteps } from "@/components/projects/wizard-steps";
import { FileUploader } from "@/components/projects/file-uploader";
import { AttachmentList } from "@/components/projects/attachment-list";
import { DeleteDraftButton, SubmitProjectForm } from "@/components/projects/project-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FILES_STEP, LAST_FIELD_STEP, projectSubmitSchema, PROJECT_STEPS, REVIEW_STEP } from "@/lib/validation/project";
import { ATTACHMENT_KINDS } from "@/lib/constants";
import { PROJECT_FIELD_LABEL, PROJECT_STATUS, categoryLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Edit project" };

const FIELD_STEP: Record<string, number> = Object.fromEntries(PROJECT_STEPS.flatMap((s) => s.fields.map((f) => [f, s.step])));
const FIELD_LABEL: Record<string, string> = { ...PROJECT_FIELD_LABEL, fabricRequirements: "Fabric type and composition", techPack: "Tech pack" };

/** What the files step asks for, per kind: the tech pack is required, the rest help factories quote. */
const FILE_EXPECTATION: Partial<Record<string, string>> = { TECH_PACK: "Required", MEASUREMENT_CHART: "Recommended", REFERENCE_IMAGE: "Optional" };

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
  const maxStep = isDraft ? REVIEW_STEP : LAST_FIELD_STEP;
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

  const stepTitle = (n: number) => PROJECT_STEPS.find((x) => x.step === n)?.title ?? "";
  const stepPanel = (n: number, form: React.ReactNode) => (
    <Panel title={stepTitle(n)} description={STEP_INFO[n]}>
      {form}
    </Panel>
  );
  const editLink = (n: number, label: string) => (
    <Button asChild variant="link" size="sm">
      <Link href={`/projects/${id}/edit?step=${n}`} aria-label={`Edit ${label}`}><Pencil className="size-3.5" /> Edit</Link>
    </Button>
  );
  const techPacks = project.attachments.filter((a) => a.kind === "TECH_PACK").length;
  const fileCount = (kind: string) => project.attachments.filter((a) => a.kind === kind).length;

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow={isDraft ? "Project brief" : "Edit requirements"}
        title={isDraft ? project.name : `Edit ${project.name}`}
        breadcrumbs={[{ href: "/projects", label: "Projects" }, ...(isDraft ? [] : [{ href: `/projects/${id}`, label: project.name }])]}
        meta={<StatusBadge map={PROJECT_STATUS} value={project.status} />}
        description={isDraft ? "Draft — only you can see this project until you submit it." : "Changes are recorded in the project history and quoting factories are notified."}
        actions={isDraft ? <DeleteDraftButton projectId={id} /> : undefined}
      />
      {sp.saved && <Alert tone="success" className="mb-6">Draft saved. You can leave and continue later from your projects list.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <WizardSteps
          projectId={id}
          current={step}
          reached={isDraft ? (project.wizardStep >= FILES_STEP && techPacks > 0 ? REVIEW_STEP : project.wizardStep) : LAST_FIELD_STEP}
          submitted={!isDraft}
        />

        <div className="min-w-0">
          {step === 1 && stepPanel(1, <BasicsStep project={wp} />)}
          {step === 2 && stepPanel(2, <SpecificationsStep project={wp} />)}
          {step === 3 && stepPanel(3, <QuantityStep project={wp} />)}
          {step === 4 && stepPanel(4, <SustainabilityStep project={wp} />)}
          {step === LAST_FIELD_STEP && stepPanel(LAST_FIELD_STEP, <SamplesStep project={wp} />)}

          {step === FILES_STEP && (
            <Panel
              title="Tech pack and files"
              description="Upload your tech pack (required to submit), a measurement chart and any reference images or sketches. Every new tech pack upload becomes the next version; earlier versions are kept."
              footer={
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-ink-muted">{techPacks ? `${techPacks} tech pack version${techPacks === 1 ? "" : "s"} uploaded` : "A tech pack is required before you can submit."}</p>
                  <Button asChild variant="accent"><Link href={`/projects/${id}/edit?step=${REVIEW_STEP}`}>Continue to review <ArrowRight /></Link></Button>
                </div>
              }
            >
              <div className="space-y-6">
                <ul aria-label="Files factories look for" className="grid gap-2 sm:grid-cols-3">
                  {ATTACHMENT_KINDS.filter((k) => FILE_EXPECTATION[k.value]).map((k) => {
                    const n = fileCount(k.value);
                    return (
                      <li key={k.value} className={cn("flex items-start gap-2.5 rounded-md border px-3 py-2.5", n ? "border-line bg-surface" : "border-line-strong border-dashed bg-surface-muted/60")}>
                        {n ? (
                          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-fg" aria-hidden><Check className="size-2.5" strokeWidth={3} /></span>
                        ) : (
                          <Circle className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                        )}
                        <span className="min-w-0 text-[13px] leading-5">
                          <span className="block font-medium text-ink">{k.label}</span>
                          <span className="block text-ink-muted">{n ? `${n} uploaded` : FILE_EXPECTATION[k.value]}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <FileUploader projectId={id} />
                <div className="border-t border-line-subtle pt-5">
                  <AttachmentList items={project.attachments} canDelete projectId={id} />
                </div>
              </div>
            </Panel>
          )}

          {step === REVIEW_STEP && (
            <div className="space-y-6">
              {issues.length > 0 ? (
                <Alert tone="error">
                  <p className="font-medium">Complete these before submitting:</p>
                  <ul className="mt-2 space-y-1">
                    {issues.map((i) => (
                      <li key={i.field + i.message}>
                        <Link href={`/projects/${id}/edit?step=${i.field === "techPack" ? FILES_STEP : (FIELD_STEP[i.field] ?? 1)}`} className="font-medium underline underline-offset-2">
                          {FIELD_LABEL[i.field] ?? i.field}
                        </Link>
                        : {i.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              ) : (
                <Alert tone="success">Everything factories need is in place.</Alert>
              )}
              <Panel title="Review" description="This is what matched factories will see." bodyClassName="p-0 sm:p-0">
                <div className="divide-y divide-line-subtle">
                  {[
                    {
                      n: 1, label: "basics",
                      items: [
                        { label: "Category", value: categoryLabel(project.category) },
                        { label: "Product description", value: project.description ? <span className="whitespace-pre-line">{project.description}</span> : "—", full: true },
                      ],
                    },
                    {
                      n: 2, label: "specifications",
                      items: [
                        { label: "Fabric", value: project.fabricRequirements },
                        { label: "Fabrics to match", value: project.fabrics.join(", ") || "—" },
                        { label: "Colours", value: project.colors },
                        { label: "Sizes", value: project.sizes.join(", ") || "—" },
                        { label: "Manufacturing requirements", value: project.requiredCapabilities.join(", ") || "None", full: true },
                      ],
                    },
                    {
                      n: 3, label: "quantity and budget",
                      items: [
                        { label: "Quantity", value: project.quantity ? `${formatNumber(project.quantity)} units` : "—" },
                        { label: "Target price", value: project.targetUnitPrice ? `${formatMoney(project.targetUnitPrice, project.currency)} / unit` : "Not shared" },
                        { label: "Delivery date", value: formatDate(project.deadline) },
                        { label: "Preferred country", value: project.preferredCountry ?? "No preference" },
                      ],
                    },
                    {
                      n: 4, label: "sustainability",
                      items: [{ label: "Required certifications", value: project.requiredCertifications.join(", ") || "None" }],
                    },
                    {
                      n: LAST_FIELD_STEP, label: "samples",
                      items: project.sampleRequired
                        ? [
                            { label: "Samples", value: project.sampleQuantity ? `${formatNumber(project.sampleQuantity)} piece${project.sampleQuantity === 1 ? "" : "s"}` : "Requested" },
                            { label: "Sample sizes", value: project.sampleSizes.join(", ") || "Not specified" },
                            ...(project.sampleNotes ? [{ label: "Sample notes", value: <span className="whitespace-pre-line">{project.sampleNotes}</span>, full: true }] : []),
                          ]
                        : [{ label: "Samples", value: "Not requested — pre-production sample only", full: true }],
                    },
                    {
                      n: FILES_STEP, label: "files",
                      items: ATTACHMENT_KINDS.filter((k) => k.value === "TECH_PACK" || fileCount(k.value) > 0 || FILE_EXPECTATION[k.value]).map((k) => ({
                        label: k.group,
                        value: fileCount(k.value) ? `${fileCount(k.value)} uploaded` : k.value === "TECH_PACK" ? "None yet" : "None",
                      })),
                    },
                  ].map((g) => (
                    <div key={g.n} className="grid gap-3 px-4 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6 sm:px-5">
                      <div className="flex items-start justify-between gap-3 sm:block">
                        <p className="flex items-baseline gap-2">
                          <span className="tabular font-display text-base leading-none text-accent-strong" aria-hidden>{String(g.n).padStart(2, "0")}</span>
                          <span className="label-caps text-ink-muted">{stepTitle(g.n)}</span>
                        </p>
                        <div className="sm:mt-1.5">{editLink(g.n, g.label)}</div>
                      </div>
                      <DescriptionList items={g.items} columns={2} />
                    </div>
                  ))}
                </div>
              </Panel>
              <section aria-label="Submit project" className="rounded-lg border border-accent-line bg-accent-soft/40 p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex max-w-xl gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md border border-accent-line bg-surface text-accent-strong"><Send className="size-[18px]" strokeWidth={1.75} aria-hidden /></span>
                    <p className="text-sm leading-6 text-ink">
                      Submitting runs factory matching. Verified factories that meet every requirement are invited to quote and can see this project and its files.
                    </p>
                  </div>
                  <SubmitProjectForm projectId={id} disabled={issues.length > 0} />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
