import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FileSearch, FileText, Pencil, SearchX } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { getProject } from "@/server/services/projects";
import { getProjectMatches } from "@/server/services/matching";
import { listProjectQuotations } from "@/server/services/quotations";
import { isAppError } from "@/server/errors";
import { DetailList, EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { AttachmentList } from "@/components/projects/attachment-list";
import { FileUploader } from "@/components/projects/file-uploader";
import { MatchCard } from "@/components/projects/match-card";
import { QuotationCompare } from "@/components/projects/quotation-compare";
import { CancelProjectButton, RerunMatchingButton } from "@/components/projects/project-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ScoreBreakdown } from "@/lib/matching";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

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

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/orders" : "/projects", label: actor.role === "ADMIN" ? "Admin" : "Projects" }]}
        meta={<StatusBadge map={PROJECT_STATUS} value={project.status} />}
        description={`${categoryLabel(project.category)} · ${formatNumber(project.quantity)} units · delivery by ${formatDate(project.deadline)}${actor.role === "ADMIN" ? ` · ${project.brand.brandProfile?.companyName ?? project.brand.name}` : ""}`}
        actions={
          <>
            {project.order && <Button asChild variant="accent"><Link href={`/orders/${project.order.id}`}>Open order {project.order.reference} <ArrowRight /></Link></Button>}
            {isOwner && preOrder && <Button asChild variant="outline"><Link href={`/projects/${id}/edit?step=1`}><Pencil /> Edit requirements</Link></Button>}
            {isOwner && preOrder && <CancelProjectButton projectId={id} />}
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

      <div className="space-y-6">
        <Panel
          id="quotations"
          title="Quotations"
          description={visibleQuotes.length ? "Totals are calculated by Fashinza from each factory's cost breakdown." : undefined}
        >
          {visibleQuotes.length === 0 ? (
            <EmptyState
              icon={FileText}
              className="border-0 py-6"
              title="No quotations yet"
              description={matchData?.matches.length ? `${matchData.matches.length} matched ${matchData.matches.length === 1 ? "factory has" : "factories have"} been invited. Quotations appear here as soon as they are sent.` : "Quotations arrive from matched factories. There are no matches yet."}
            />
          ) : (
            <QuotationCompare quotes={visibleQuotes} projectId={id} canDecide={isOwner && preOrder} />
          )}
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Panel
            id="matches"
            title="Matched factories"
            description={summary ? `Last run ${formatDateTime(matchData!.lastRun!.at)}: ${summary.reviewed} factories reviewed, ${summary.eligible} eligible.` : undefined}
            actions={isOwner && preOrder ? <RerunMatchingButton projectId={id} /> : undefined}
          >
            {matchData && matchData.matches.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
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
              <EmptyState icon={SearchX} className="border-0 py-6" title="No eligible factories yet" description="Matching only invites verified factories that meet every mandatory requirement. Relaxing the MOQ limit, deadline or certifications widens the search." />
            )}
            {summary && Object.keys(summary.exclusionReasons).length > 0 && (
              <div className="mt-4 rounded-md bg-canvas p-3">
                <p className="text-xs font-semibold text-navy">Why other factories were not matched</p>
                <ul className="mt-1 grid gap-x-4 text-xs text-muted sm:grid-cols-2">
                  {Object.entries(summary.exclusionReasons).map(([reason, n]) => <li key={reason}>{reason}: {n}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-3 flex items-center gap-1 text-xs text-muted"><FileSearch className="size-3.5" aria-hidden /> Rule-based matching (deterministic). Scores show compatibility, not a guarantee of quality.</p>
          </Panel>

          <div className="space-y-6">
            <Panel title="Requirements">
              <DetailList
                items={[
                  { label: "Fabric", value: project.fabricRequirements },
                  { label: "Colours", value: project.colors },
                  { label: "Sizes", value: project.sizes.join(", ") },
                  { label: "Target price", value: project.targetUnitPrice ? `${formatMoney(project.targetUnitPrice, project.currency)} / unit` : "Not shared" },
                  { label: "MOQ limit", value: project.maxMoq ? formatNumber(project.maxMoq) : "Up to the order quantity" },
                  { label: "Preferred country", value: project.preferredCountry ?? "No preference" },
                  { label: "Processes", value: project.requiredCapabilities.join(", ") || "None specified" },
                  { label: "Certifications", value: project.requiredCertifications.join(", ") || "None required" },
                ]}
              />
              {project.description && <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm">{project.description}</p>}
              {project.sustainabilityNotes && <p className="mt-3 text-sm"><span className="font-medium text-navy">Sustainability: </span>{project.sustainabilityNotes}</p>}
              {project.additionalInstructions && <p className="mt-3 text-sm"><span className="font-medium text-navy">Instructions: </span>{project.additionalInstructions}</p>}
            </Panel>
            <Panel id="files" title="Tech pack and files">
              <AttachmentList items={project.attachments} projectId={id} />
              {isOwner && !["CANCELLED", "DELIVERED"].includes(project.status) && (
                <details className="mt-4 border-t border-line pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-teal-700">Upload a new version or file</summary>
                  <div className="mt-4"><FileUploader projectId={id} /></div>
                </details>
              )}
            </Panel>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {project.revisions.length > 0 && (
            <Panel title="Requirement changes">
              <ul className="space-y-3 text-sm">
                {project.revisions.map((r) => (
                  <li key={r.id}>
                    <p className="text-xs text-muted">{formatDateTime(r.createdAt)}</p>
                    <ul className="mt-1 space-y-0.5">
                      {Object.entries(r.changes as Record<string, { from: string | null; to: string | null }>).map(([field, c]) => (
                        <li key={field}><span className="font-medium text-navy">{field}</span>: <span className="text-muted line-through">{c.from ?? "empty"}</span> → {c.to ?? "empty"}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Activity">
            <ActivityTimeline items={activities} />
          </Panel>
        </div>
      </div>
    </>
  );
}
