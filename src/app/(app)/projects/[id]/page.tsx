import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, CalendarDays, FileSearch, FileText, Hash, Pencil, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { getProject } from "@/server/services/projects";
import { getProjectMatches } from "@/server/services/matching";
import { listProjectQuotations } from "@/server/services/quotations";
import { isAppError } from "@/server/errors";
import { AnchorNav, DescriptionList, EmptyState, MetaItem, Metric, MetricStrip, PageHeader, Panel, StageStepper, StatusBadge, type Step } from "@/components/app/primitives";
import { lifecycleStep } from "@/components/projects/project-progress";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { AttachmentList } from "@/components/projects/attachment-list";
import { FileUploader } from "@/components/projects/file-uploader";
import { MatchCard } from "@/components/projects/match-card";
import { cn } from "@/lib/utils";
import { QuotationCompare } from "@/components/projects/quotation-compare";
import { CancelProjectButton, RerunMatchingButton } from "@/components/projects/project-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ScoreBreakdown } from "@/lib/matching";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatDateTime, formatMoney, formatNumber, relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; updated?: string }> }) {
  const actor = await requireOnboardedUser();
  const { id } = await params;
  if (actor.role === "MANUFACTURER") redirect(`/opportunities/${id}`);
  const sp = await searchParams;
  const project = await getProject(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  if (project.status === "DRAFT" && actor.role === "BRAND") redirect(`/projects/${id}/edit`);

  const [matchData, quotes, activities] = await Promise.all([
    getProjectMatches(actor, id),
    listProjectQuotations(actor, id),
    db.activityLog.findMany({ where: { projectId: id, orderId: null }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } }),
  ]);
  const isOwner = actor.role === "BRAND";
  const preOrder = ["SUBMITTED", "QUOTING"].includes(project.status);
  const visibleQuotes = quotes.filter((q) => q.status !== "DRAFT");
  const quoteStatusBy = new Map(visibleQuotes.map((q) => [q.manufacturerId, QUOTATION_STATUS[q.status]?.label ?? q.status]));
  const summary = matchData?.lastRun?.summary;

  const techPacks = project.attachments.filter((a) => a.kind === "TECH_PACK").length;
  const matchCount = matchData?.matches.length ?? 0;
  const openQuotes = visibleQuotes.filter((q) => ["SUBMITTED", "REVISION_REQUESTED"].includes(q.status)).length;
  const { step } = lifecycleStep(project.status);
  const lifecycle = [
    { key: "brief", label: "Brief", at: 0 },
    { key: "matching", label: "Matching", at: 1 },
    { key: "quoting", label: "Quoting", at: 2 },
    { key: "order", label: "Order placed", at: 3 },
    { key: "production", label: "Production", at: 4 },
    { key: "shipping", label: "Shipping", at: 6 },
    { key: "delivered", label: "Delivered", at: 8 },
  ];
  const stages: Step[] = lifecycle.map((l, i) => {
    const next = lifecycle[i + 1]?.at ?? Infinity;
    const state = project.status === "DELIVERED" || step >= next ? "done" : step >= l.at ? "current" : "upcoming";
    return { key: l.key, label: l.label, state, hint: l.key === "brief" && project.submittedAt ? `Submitted ${formatDate(project.submittedAt)}` : undefined };
  });

  return (
    <>
      <PageHeader
        eyebrow="Production project"
        title={project.name}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/orders" : "/projects", label: actor.role === "ADMIN" ? "Admin" : "Projects" }]}
        meta={<StatusBadge map={PROJECT_STATUS} value={project.status} />}
        description={`${categoryLabel(project.category)} · ${formatNumber(project.quantity)} units · delivery by ${formatDate(project.deadline)}${actor.role === "ADMIN" ? ` · ${project.brand.brandProfile?.companyName ?? project.brand.name}` : ""}`}
        metaRow={
          <>
            {project.order && <MetaItem icon={Hash}>{project.order.reference}</MetaItem>}
            <MetaItem icon={CalendarDays}>Updated {formatDate(project.updatedAt)}</MetaItem>
            <MetaItem icon={FileText}>{techPacks} tech pack version{techPacks === 1 ? "" : "s"}</MetaItem>
          </>
        }
        actions={
          <>
            {isOwner && preOrder && <CancelProjectButton projectId={id} />}
            {isOwner && preOrder && <Button asChild variant="outline"><Link href={`/projects/${id}/edit?step=1`}><Pencil /> Edit requirements</Link></Button>}
            {project.order && <Button asChild variant="accent"><Link href={`/orders/${project.order.id}`}>Open order {project.order.reference} <ArrowRight /></Link></Button>}
          </>
        }
      />
      {sp.submitted && summary && (
        <Alert tone={summary.eligible ? "success" : "info"} className="mb-6">
          {summary.eligible
            ? `Project submitted. ${summary.eligible} verified ${summary.eligible === 1 ? "factory was" : "factories were"} invited to quote. You will be notified as quotations arrive.`
            : "Project submitted, but no verified factory currently meets every requirement. See the matching summary below for what excluded them."}
        </Alert>
      )}
      {sp.updated && <Alert tone="success" className="mb-6">Requirements updated. Quoting factories have been notified and the change is recorded in the history.</Alert>}

      <MetricStrip label="Key facts">
        <Metric label="Quantity" value={project.quantity ? formatNumber(project.quantity) : "—"} hint="units" muted={!project.quantity} />
        <Metric label="Target price" value={project.targetUnitPrice ? formatMoney(project.targetUnitPrice, project.currency) : "—"} hint={project.targetUnitPrice ? "per unit" : "Not shared"} muted={!project.targetUnitPrice} />
        <Metric label="Delivery by" value={formatDate(project.deadline)} hint={project.deadline && project.status !== "DELIVERED" ? relativeDays(project.deadline) : undefined} />
        <Metric label="Matched factories" value={matchCount} hint={summary ? `of ${summary.reviewed} reviewed` : undefined} />
        <Metric label="Open quotations" value={openQuotes} tone={openQuotes && isOwner && preOrder ? "warning" : undefined} hint={visibleQuotes.length ? `${visibleQuotes.length} received` : undefined} />
      </MetricStrip>

      <Panel className="mb-6">
        <StageStepper stages={stages} label="Project lifecycle" />
      </Panel>

      <AnchorNav
        items={[
          { href: "#quotations", label: "Quotations", count: visibleQuotes.length },
          { href: "#matches", label: "Matched factories", count: matchCount },
          { href: "#requirements", label: "Requirements" },
          { href: "#files", label: "Files", count: project.attachments.length },
          { href: "#activity", label: "Activity" },
        ]}
      />

      <div className="space-y-6">
        <Panel
          id="quotations"
          title="Quotations"
          description={visibleQuotes.length ? "Totals are calculated by Fashinza from each factory's cost breakdown." : undefined}
          bodyClassName={visibleQuotes.length ? "p-0 sm:p-0" : undefined}
        >
          {visibleQuotes.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={FileText}
              className="py-6"
              title="No quotations yet"
              description={matchCount ? `${matchCount} matched ${matchCount === 1 ? "factory has" : "factories have"} been invited. Quotations appear here as soon as they are sent.` : "Quotations arrive from matched factories. There are no matches yet."}
            />
          ) : (
            <QuotationCompare quotes={visibleQuotes} projectId={id} canDecide={isOwner && preOrder} />
          )}
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Panel
              id="matches"
              title="Matched factories"
              description={summary ? `Last run ${formatDateTime(matchData!.lastRun!.at)}: ${summary.reviewed} factories reviewed, ${summary.eligible} eligible.` : undefined}
              actions={isOwner && preOrder ? <RerunMatchingButton projectId={id} /> : undefined}
              footer={
                <p className="flex items-start gap-1.5 text-xs leading-5 text-muted">
                  <FileSearch className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Rule-based matching (deterministic). Scores show compatibility, not a guarantee of quality.
                </p>
              }
            >
              {matchData && matchData.matches.length > 0 ? (
                <div className={cn("grid gap-3", matchData.matches.length > 1 && "md:grid-cols-2")}>
                  {matchData.matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      m={{
                        id: m.id,
                        score: m.score.toString(),
                        breakdown: m.breakdown as unknown as ScoreBreakdown,
                        quoteStatus: quoteStatusBy.get(m.manufacturerId) ?? "not sent yet",
                        profile: m.manufacturer.manufacturerProfile && {
                          ...m.manufacturer.manufacturerProfile,
                          certifications: m.manufacturer.manufacturerProfile.documents.map((d) => d.certificationName!).filter(Boolean),
                        },
                      }}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState variant="plain" icon={SearchX} className="py-6" title="No eligible factories yet" description="Matching only invites verified factories that meet every mandatory requirement. Relaxing the MOQ limit, deadline or certifications widens the search." />
              )}
              {summary && Object.keys(summary.exclusionReasons).length > 0 && (
                <div className="mt-4 rounded-md border border-line-subtle bg-surface-muted p-3.5">
                  <p className="label-caps text-muted">Why other factories were not matched</p>
                  <ul className="mt-2 grid gap-x-6 gap-y-1 text-[13px] text-ink sm:grid-cols-2">
                    {Object.entries(summary.exclusionReasons).map(([reason, n]) => <li key={reason} className="tabular">{reason}: {n}</li>)}
                  </ul>
                </div>
              )}
            </Panel>

            <Panel id="activity" title="Activity">
              <ActivityTimeline items={activities} />
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel id="requirements" title="Requirements">
              <DescriptionList
                layout="rows"
                items={[
                  { label: "Fabric", value: project.fabricRequirements },
                  { label: "Colours", value: project.colors },
                  { label: "Sizes", value: project.sizes.join(", ") },
                  { label: "MOQ limit", value: project.maxMoq ? formatNumber(project.maxMoq) : "Up to the order quantity" },
                  { label: "Preferred country", value: project.preferredCountry ?? "No preference" },
                  { label: "Processes", value: project.requiredCapabilities.join(", ") || "None specified" },
                  { label: "Certifications", value: project.requiredCertifications.join(", ") || "None required" },
                ]}
              />
              {(project.description || project.sustainabilityNotes || project.additionalInstructions) && (
                <div className="mt-4 space-y-3 border-t border-line-subtle pt-4 text-sm leading-6">
                  {project.description && <p className="whitespace-pre-line text-ink">{project.description}</p>}
                  {project.sustainabilityNotes && <p><span className="font-medium text-navy">Sustainability: </span>{project.sustainabilityNotes}</p>}
                  {project.additionalInstructions && <p><span className="font-medium text-navy">Instructions: </span>{project.additionalInstructions}</p>}
                </div>
              )}
            </Panel>
            <Panel id="files" title="Tech pack and files">
              <AttachmentList items={project.attachments} projectId={id} />
              {isOwner && !["CANCELLED", "DELIVERED"].includes(project.status) && (
                <details className="group mt-4 border-t border-line-subtle pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-teal-700 hover:underline hover:underline-offset-4">Upload a new version or file</summary>
                  <div className="mt-4"><FileUploader projectId={id} /></div>
                </details>
              )}
            </Panel>
            {project.revisions.length > 0 && (
              <Panel title="Requirement changes">
                <ul className="space-y-4 text-sm">
                  {project.revisions.map((r) => (
                    <li key={r.id}>
                      <p className="text-xs text-muted">{formatDateTime(r.createdAt)}</p>
                      <ul className="mt-1 space-y-0.5">
                        {Object.entries(r.changes as Record<string, { from: string | null; to: string | null }>).map(([field, c]) => (
                          <li key={field} className="break-words"><span className="font-medium text-navy">{field}</span>: <span className="text-muted line-through">{c.from ?? "empty"}</span> → {c.to ?? "empty"}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
