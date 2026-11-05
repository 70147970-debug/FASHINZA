import { Link, redirect, useLoaderData } from "react-router";
import { ArrowRight, CalendarDays, CheckCircle2, Clock, FileSearch, FileText, Hash, ListChecks, Pencil, SearchX, XCircle } from "lucide-react";
import { loadJson } from "@/lib/api";
import { DescriptionList, EmptyState, MetaItem, PageHeader, Panel, StageStepper, StatusBadge } from "@/components/app/primitives";
import { PageTabs, resolveTab } from "@/components/app/page-tabs";
import { LegacyHashTab } from "@/components/app/legacy-hash-tab";
import { ProjectProgress, lifecycleStep } from "@/components/projects/project-progress";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { AttachmentList } from "@/components/projects/attachment-list";
import { FileUploader } from "@/components/projects/file-uploader";
import { MatchCard } from "@/components/projects/match-card";
import { cn } from "@fashinza/shared/utils.js";
import { QuotationCompare } from "@/components/projects/quotation-compare";
import { RevisionChanges } from "@/components/projects/revision-changes";
import { CancelProjectButton, RerunMatchingButton } from "@/components/projects/project-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel, sampleRequestSummary } from "@fashinza/shared/labels.js";
import { formatDate, formatDateTime, formatMoney, formatNumber, relativeDays } from "@fashinza/shared/format.js";
import { PageMeta } from "@/components/meta";

/** Static page title, also shown when the record is not found (AppErrorBoundary). */
export const handle = { title: "Project" };

const TAB_KEYS = ["quotations", "matches", "requirements", "files", "activity"];
/** Old in-page anchors (stored notification links) → the tab that now holds that section. */
const LEGACY_HASHES = {
  quotations: "quotations",
  matches: "matches",
  requirements: "requirements",
  files: "files",
  activity: "activity",
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* -------------------------------------------------------------------------------------------------
 * "Your next step" card: the one place the viewer's primary action lives.
 * -----------------------------------------------------------------------------------------------*/

const NEXT_STEP_ICON = { action: ListChecks, waiting: Clock, done: CheckCircle2, stopped: XCircle };

function NextStepCard({ step, eyebrow, progress }) {
  const Icon = NEXT_STEP_ICON[step.tone];
  const action = step.tone === "action";
  return (
    <section aria-labelledby="next-step-title" className="mb-6 min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
      <div className={cn("flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between md:gap-6", action && "bg-accent-soft/40")}>
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md border",
              action && "border-accent-line bg-accent-soft text-accent-strong",
              step.tone === "waiting" && "border-line bg-canvas text-ink-muted",
              step.tone === "done" && "border-success-line bg-success-soft text-success-strong",
              step.tone === "stopped" && "border-line bg-surface-muted text-ink-muted",
            )}
            aria-hidden
          >
            <Icon className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className={cn("eyebrow", action ? "text-accent-strong" : "text-ink-muted")}>{eyebrow}</p>
            <h2 id="next-step-title" className="type-heading mt-1 break-words text-ink">
              {step.title}
            </h2>
            {step.body && <div className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">{step.body}</div>}
            {step.when && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] leading-5 text-ink-muted">
                <CalendarDays className="size-3.5 shrink-0 text-ink-subtle" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 break-words">{step.when}</span>
              </p>
            )}
          </div>
        </div>
        {step.actions && <div className="flex flex-wrap items-center gap-2 max-sm:[&>*]:grow md:shrink-0 md:justify-end">{step.actions}</div>}
      </div>
      <div className="border-t border-line px-4 py-4 sm:px-5">{progress}</div>
    </section>
  );
}

/**
 * GET /api/projects/:id/detail: the project, its matches (with the last matching run), the quotations and the
 * project activity. Manufacturers were already sent to /opportunities/:id by the router; a brand's draft opens
 * in the wizard.
 */
export async function loader({ request, params, user }) {
  const { id } = params;
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { project, matchData, quotations, activities } = await loadJson(`/api/projects/${encodeURIComponent(id)}/detail`, { request });
  if (project.status === "DRAFT" && user.role === "BRAND") throw redirect(`/projects/${id}/edit`);
  return { actor: { role: user.role }, id, sp, project, matchData, quotes: quotations, activities };
}

export default function ProjectPage() {
  const { actor, id, sp, project, matchData, quotes, activities } = useLoaderData();
  const isOwner = actor.role === "BRAND";
  const preOrder = ["SUBMITTED", "QUOTING"].includes(project.status);
  const canDecide = isOwner && preOrder;
  const basePath = `/projects/${id}`;

  const visibleQuotes = quotes.filter((q) => q.status !== "DRAFT");
  const quoteStatusBy = new Map(visibleQuotes.map((q) => [q.manufacturerId, QUOTATION_STATUS[q.status]?.label ?? q.status]));
  const summary = matchData?.lastRun?.summary;
  const matches = matchData?.matches ?? [];
  const matchCount = matches.length;
  const techPacks = project.attachments.filter((a) => a.kind === "TECH_PACK").length;
  const sampleSummary = sampleRequestSummary(project);

  const toDecide = visibleQuotes.filter((q) => q.status === "SUBMITTED");
  const beingRevised = visibleQuotes.filter((q) => q.status === "REVISION_REQUESTED");
  const openQuotes = toDecide.length + beingRevised.length;
  const awaitingQuote = matches.filter((m) => !quoteStatusBy.has(m.manufacturerId)).length;

  // Right after submitting there are no quotations yet; land on the matching result the alert refers to.
  const tab = resolveTab(sp.tab, TAB_KEYS, sp.submitted && !sp.tab ? "matches" : "quotations");

  /* ---- Progress: the lifecycle stepper (md and up) or a compact bar (phones) ---- */
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
  const stages = lifecycle.map((l, i) => {
    const next = lifecycle[i + 1]?.at ?? Infinity;
    const state = project.status === "DELIVERED" || step >= next ? "done" : step >= l.at ? "current" : "upcoming";
    return { key: l.key, label: l.label, state, hint: l.key === "brief" && project.submittedAt ? `Submitted ${formatDate(project.submittedAt)}` : undefined };
  });
  const progress = (
    <>
      <StageStepper stages={stages} label="Project lifecycle" className="max-md:hidden" />
      <ProjectProgress status={project.status} className="md:hidden" />
    </>
  );

  /* ---- Next step for this viewer ---- */
  const deadlineText = project.deadline ? `Delivery needed by ${formatDate(project.deadline)}` : undefined;
  const latest = (dates) =>
    dates
      .filter((d) => !!d)
      .map((d) => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime())[0];
  const order = project.order;
  const orderButton = (variant, verb) =>
    order ? (
      <Button asChild variant={variant}>
        <Link to={`/orders/${order.id}`}>
          {verb} order {order.reference} <ArrowRight />
        </Link>
      </Button>
    ) : undefined;
  const widenActions = isOwner ? (
    <>
      <Button asChild variant="accent">
        <Link to={`/projects/${id}/edit?step=1`}>
          <Pencil /> Edit requirements
        </Link>
      </Button>
      <RerunMatchingButton projectId={id} />
    </>
  ) : undefined;

  let next;
  if (project.status === "CANCELLED") {
    next = {
      tone: "stopped",
      title: "This project was cancelled",
      body: "Open quotations were closed and the factories were notified. Nothing more is needed.",
      when: `Cancelled ${formatDate(project.updatedAt)}`,
      actions: orderButton("outline", "View"),
    };
  } else if (project.status === "DRAFT") {
    next = {
      tone: "waiting",
      title: "Waiting for the brand to submit this brief",
      body: "Drafts are not visible to factories until they are submitted.",
      when: `Last edited ${formatDate(project.updatedAt)}`,
    };
  } else if (project.status === "DELIVERED") {
    next = {
      tone: "done",
      title: "Delivered — this project is complete",
      body: "Production records, documents and payments stay available on the order.",
      actions: orderButton("outline", "View"),
    };
  } else if (!preOrder) {
    const titles = {
      QUOTATION_ACCEPTED: order ? `Order ${order.reference} is placed` : "The quotation was accepted",
      IN_PRODUCTION: "Production is under way",
      QUALITY_CHECK: "The goods are in quality check",
      READY_TO_SHIP: "The goods are ready to ship",
      SHIPPED: "The goods are on their way",
    };
    next = {
      tone: "waiting",
      title: titles[project.status] ?? PROJECT_STATUS[project.status]?.label ?? project.status,
      body: isOwner
        ? "Samples, production updates, payments and messages are handled on the order. Anything that needs you is flagged there."
        : "Follow production, payments and messages on the order.",
      when: deadlineText && project.deadline ? `${deadlineText} (${relativeDays(project.deadline)})` : undefined,
      actions: orderButton("accent", "Open"),
    };
  } else if (toDecide.length > 0) {
    next = isOwner
      ? {
          tone: "action",
          title: `${plural(toDecide.length, "quotation", "quotations")} to review`,
          body: (
            <>
              Compare totals, production time and terms side by side, then accept one to create the order — or ask a factory to revise.
              {beingRevised.length > 0 && ` ${plural(beingRevised.length, "more is", "more are")} being revised.`}
              {tab === "quotations" && " Your decision buttons are under each factory's summary below."}
            </>
          ),
          when: deadlineText,
          actions:
            tab === "quotations" ? undefined : (
              <Button asChild variant="accent">
                <Link to={`${basePath}?tab=quotations`} preventScrollReset>
                  Compare quotations <ArrowRight />
                </Link>
              </Button>
            ),
        }
      : {
          tone: "waiting",
          title: `Waiting for the brand to review ${plural(toDecide.length, "quotation", "quotations")}`,
          when: `Latest received ${formatDate(latest(toDecide.map((q) => q.submittedAt)) ?? toDecide[0].updatedAt)}`,
        };
  } else if (beingRevised.length > 0) {
    next = {
      tone: "waiting",
      title: `Waiting for ${plural(beingRevised.length, "factory", "factories")} to send a revised quotation`,
      body: isOwner ? "You will be notified as soon as a revision arrives." : undefined,
      when: `Revision requested ${formatDate(latest(beingRevised.map((q) => q.updatedAt)))}`,
    };
  } else if (matchCount === 0) {
    next = isOwner
      ? {
          tone: "action",
          title: "No eligible factories yet",
          body: (
            <>
              No verified factory meets every mandatory requirement. Relax the MOQ limit, deadline or certifications, then run matching again.{" "}
              {tab !== "matches" && (
                <Link to={`${basePath}?tab=matches`} preventScrollReset className="font-medium text-accent-strong underline-offset-4 hover:underline">
                  See why factories were excluded
                </Link>
              )}
            </>
          ),
          when: matchData?.lastRun ? `Matching last ran ${formatDate(matchData.lastRun.at)}` : undefined,
          actions: widenActions,
        }
      : {
          tone: "waiting",
          title: "No eligible factories yet",
          body: "Waiting for the brand to relax the requirements or run matching again.",
          when: matchData?.lastRun ? `Matching last ran ${formatDate(matchData.lastRun.at)}` : undefined,
        };
  } else if (awaitingQuote > 0) {
    next = {
      tone: "waiting",
      title: `Waiting for quotations from ${plural(awaitingQuote, "invited factory", "invited factories")}`,
      body: isOwner ? "You will be notified as soon as a quotation arrives." : undefined,
      when: [matchData?.lastRun ? `Invited ${formatDate(matchData.lastRun.at)}` : null, deadlineText].filter(Boolean).join(" · ") || undefined,
    };
  } else {
    next = isOwner
      ? {
          tone: "action",
          title: "No open quotations",
          body: `All ${plural(visibleQuotes.length, "quotation was", "quotations were")} declined, expired or withdrawn. Widen the requirements and run matching again to invite more factories.`,
          actions: widenActions,
        }
      : { tone: "waiting", title: "No open quotations", body: "Waiting for the brand to widen the requirements or run matching again." };
  }
  // The card owns Edit requirements / Run matching again whenever it shows them, so they are not repeated elsewhere.
  const cardOwnsWiden = next.actions === widenActions && !!widenActions;

  const tabs = [
    { key: "quotations", label: "Quotations", count: openQuotes, attention: canDecide && toDecide.length > 0 },
    { key: "matches", label: "Matched factories", count: matchCount },
    { key: "requirements", label: "Requirements" },
    { key: "files", label: "Files", count: project.attachments.length },
    { key: "activity", label: "Activity" },
  ];

  return (
    <>
      <PageMeta title="Project" />
      <LegacyHashTab map={LEGACY_HASHES} />
      <PageHeader
        eyebrow="Production project"
        title={project.name}
        breadcrumbs={[{ href: actor.role === "ADMIN" ? "/admin/orders" : "/projects", label: actor.role === "ADMIN" ? "Admin" : "Projects" }]}
        meta={<StatusBadge map={PROJECT_STATUS} value={project.status} />}
        description={`${categoryLabel(project.category)} · ${formatNumber(project.quantity)} units · delivery by ${formatDate(project.deadline)}${
          project.deadline && !["DELIVERED", "CANCELLED"].includes(project.status) ? ` (${relativeDays(project.deadline)})` : ""
        }${actor.role === "ADMIN" ? ` · ${project.brand.brandProfile?.companyName ?? project.brand.name}` : ""}`}
        metaRow={
          <>
            {order && <MetaItem icon={Hash}>{order.reference}</MetaItem>}
            <MetaItem icon={CalendarDays}>Updated {formatDate(project.updatedAt)}</MetaItem>
            <MetaItem icon={FileText}>{plural(techPacks, "tech pack version", "tech pack versions")}</MetaItem>
          </>
        }
        actions={
          isOwner && preOrder ? (
            <>
              <CancelProjectButton projectId={id} />
              {!cardOwnsWiden && (
                <Button asChild variant="outline">
                  <Link to={`/projects/${id}/edit?step=1`}>
                    <Pencil /> Edit requirements
                  </Link>
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {sp.submitted && summary && (
        <Alert tone={summary.eligible ? "success" : "info"} className="mb-6">
          {summary.eligible
            ? `Project submitted. ${summary.eligible} verified ${summary.eligible === 1 ? "factory was" : "factories were"} invited to quote. You will be notified as quotations arrive.`
            : "Project submitted, but no verified factory currently meets every requirement. The matching summary shows what excluded them."}
        </Alert>
      )}
      {sp.updated && (
        <Alert tone="success" className="mb-6">
          Requirements updated. Quoting factories have been notified and the change is recorded in the history.
        </Alert>
      )}

      <NextStepCard step={next} eyebrow={isOwner ? "Your next step" : "Next step"} progress={progress} />

      <PageTabs tabs={tabs} active={tab} basePath={basePath} label="Project sections" />

      {tab === "quotations" && (
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
              description={
                matchCount
                  ? `${plural(matchCount, "matched factory has", "matched factories have")} been invited. Quotations appear here as soon as they are sent.`
                  : "Quotations arrive from matched factories. There are no matches yet."
              }
            />
          ) : (
            <QuotationCompare quotes={visibleQuotes} projectId={id} canDecide={canDecide} samplesRequested={project.sampleRequired} />
          )}
        </Panel>
      )}

      {tab === "matches" && (
        <Panel
          id="matches"
          title="Matched factories"
          description={
            summary ? `Last run ${formatDateTime(matchData.lastRun.at)}: ${summary.reviewed} factories reviewed, ${summary.eligible} eligible.` : undefined
          }
          actions={isOwner && preOrder && !cardOwnsWiden ? <RerunMatchingButton projectId={id} /> : undefined}
          footer={
            <p className="flex items-start gap-1.5 text-xs leading-5 text-ink-muted">
              <FileSearch className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Rule-based matching (deterministic). Scores show compatibility, not a guarantee of
              quality.
            </p>
          }
        >
          {matchCount > 0 ? (
            <div className={cn("grid gap-3", matchCount > 1 && "md:grid-cols-2 xl:grid-cols-3")}>
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  m={{
                    id: m.id,
                    score: m.score.toString(),
                    breakdown: m.breakdown,
                    quoteStatus: quoteStatusBy.get(m.manufacturerId) ?? "not sent yet",
                    profile: m.manufacturer.manufacturerProfile && {
                      ...m.manufacturer.manufacturerProfile,
                      certifications: m.manufacturer.manufacturerProfile.documents.map((d) => d.certificationName).filter(Boolean),
                    },
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              variant="plain"
              icon={SearchX}
              className="py-6"
              title="No eligible factories yet"
              description="Matching only invites verified factories that meet every mandatory requirement. Relaxing the MOQ limit, deadline or certifications widens the search."
            />
          )}
          {summary && Object.keys(summary.exclusionReasons).length > 0 && (
            <div className="mt-4 rounded-md border border-line-subtle bg-surface-muted p-3.5">
              <p className="label-caps text-ink-muted">Why other factories were not matched</p>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-[13px] text-ink sm:grid-cols-2">
                {Object.entries(summary.exclusionReasons).map(([reason, n]) => (
                  <li key={reason} className="tabular">
                    {reason}: {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {tab === "requirements" && (
        <Panel id="requirements" title="Requirements">
          <DescriptionList
            columns={3}
            items={[
              { label: "Fabric", value: project.fabricRequirements },
              { label: "Colours", value: project.colors },
              { label: "Sizes", value: project.sizes.join(", ") },
              { label: "Target price", value: project.targetUnitPrice ? `${formatMoney(project.targetUnitPrice, project.currency)} per unit` : "Not shared" },
              { label: "MOQ limit", value: project.maxMoq ? formatNumber(project.maxMoq) : "Up to the order quantity" },
              { label: "Preferred country", value: project.preferredCountry ?? "No preference" },
              { label: "Processes", value: project.requiredCapabilities.join(", ") || "None specified" },
              { label: "Certifications", value: project.requiredCertifications.join(", ") || "None required" },
              { label: "Samples", value: sampleSummary },
            ]}
          />
          {(project.description || project.sustainabilityNotes || project.additionalInstructions || (project.sampleRequired && project.sampleNotes)) && (
            <div className="mt-5 max-w-3xl space-y-3 border-t border-line-subtle pt-4 text-sm leading-6">
              {project.description && <p className="whitespace-pre-line break-words text-ink">{project.description}</p>}
              {project.sustainabilityNotes && (
                <p className="break-words">
                  <span className="font-medium text-ink">Sustainability: </span>
                  {project.sustainabilityNotes}
                </p>
              )}
              {project.additionalInstructions && (
                <p className="break-words">
                  <span className="font-medium text-ink">Instructions: </span>
                  {project.additionalInstructions}
                </p>
              )}
              {project.sampleRequired && project.sampleNotes && (
                <p className="whitespace-pre-line break-words">
                  <span className="font-medium text-ink">Sample notes: </span>
                  {project.sampleNotes}
                </p>
              )}
            </div>
          )}
        </Panel>
      )}

      {tab === "files" && (
        <Panel id="files" title="Tech pack and files">
          <AttachmentList items={project.attachments} projectId={id} />
          {isOwner && !["CANCELLED", "DELIVERED"].includes(project.status) && (
            <details className="group mt-4 border-t border-line-subtle pt-4" open={project.attachments.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-accent-strong hover:underline hover:underline-offset-4">
                Upload a new version or file
              </summary>
              <div className="mt-4">
                <FileUploader projectId={id} />
              </div>
            </details>
          )}
        </Panel>
      )}

      {tab === "activity" && (
        <div className={cn("grid gap-6", project.revisions.length > 0 && "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]")}>
          <Panel id="activity" title="Activity">
            <ActivityTimeline items={activities} />
          </Panel>
          {project.revisions.length > 0 && (
            <Panel title="Requirement changes">
              <ul className="space-y-4 text-sm">
                {project.revisions.map((r) => (
                  <li key={r.id}>
                    <p className="text-xs text-ink-muted">{formatDateTime(r.createdAt)}</p>
                    <RevisionChanges changes={r.changes} currency={project.currency} className="mt-1 space-y-0.5" />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
