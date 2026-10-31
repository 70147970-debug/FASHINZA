import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Award, CalendarX, CheckCircle2, Clock, Lock, PencilLine, RefreshCw, Send, ShieldAlert, Undo2, XCircle } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { getOpportunity } from "@/server/services/opportunities";
import { isAppError } from "@/server/errors";
import { DescriptionList, EmptyState, PageHeader, Panel, StatusBadge, Timeline } from "@/components/app/primitives";
import { PageTabs, resolveTab, type PageTab } from "@/components/app/page-tabs";
import { LegacyHashTab } from "@/components/app/legacy-hash-tab";
import { AttachmentList } from "@/components/projects/attachment-list";
import { ScoreBreakdownView, ScoreRing } from "@/components/projects/match-card";
import { QuotationForm, WithdrawQuotationButton } from "@/components/quotations/quotation-form";
import { BriefSummary, NextStepCard, TabLink, type BriefItem } from "@/components/quotations/opportunity-parts";
import { Button } from "@/components/ui/button";
import type { ScoreBreakdown } from "@/lib/matching";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatDateTime, formatMoney, formatNumber, isoDateInDays, relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Opportunity" };

const TABS = ["quote", "brief", "files", "match"] as const;
type TabKey = (typeof TABS)[number];

/** Old in-page anchors (stored notifications, bookmarks) → the tab that now holds that section. */
const LEGACY_HASHES: Record<string, TabKey> = { quote: "quote", requirements: "brief" };

export default async function OpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const { id } = await params;
  const sp = await searchParams;
  const { match, project, quotation, profile } = await getOpportunity(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const tab = resolveTab(typeof sp.tab === "string" ? sp.tab : undefined, TABS, "quote");
  const basePath = `/opportunities/${id}`;
  const tabHref = (key: TabKey) => `${basePath}?tab=${key}`;

  const open = ["SUBMITTED", "QUOTING"].includes(project.status);
  const verified = profile?.verificationStatus === "VERIFIED";
  const editable = open && verified && (!quotation || ["DRAFT", "SUBMITTED", "REVISION_REQUESTED"].includes(quotation.status));
  const wonOrder = project.order?.manufacturerId === actor.id ? project.order.id : null;
  const sent = quotation && quotation.status !== "DRAFT" ? quotation : null;
  const s = (v: { toFixed(n: number): string } | null | undefined) => (v ? v.toFixed(2) : "");

  const brand = project.brand.brandProfile;
  const score = Number(match.score);
  const targetPrice = project.targetUnitPrice ? `${formatMoney(project.targetUnitPrice, project.currency)} / unit` : "Not shared";

  // Changes the brand made after this factory last sent its quotation: worth a look before the brand decides.
  const lastSentAt = editable && sent?.submittedAt ? sent.submittedAt : null;
  const briefChangedSince = lastSentAt ? project.revisions.filter((r) => r.createdAt > lastSentAt) : [];
  const filesChangedSince = lastSentAt ? project.attachments.filter((a) => a.createdAt > lastSentAt) : [];
  const mustQuote = editable && (!quotation || quotation.status === "DRAFT" || quotation.status === "REVISION_REQUESTED");

  const tabs: PageTab[] = [
    { key: "quote", label: "Your quotation", attention: mustQuote },
    { key: "brief", label: "Brief", attention: briefChangedSince.length > 0 },
    { key: "files", label: "Tech pack & files", count: project.attachments.length, attention: filesChangedSince.length > 0 },
    { key: "match", label: "Why you were matched" },
  ];

  /* ---------------------------------------------------------------------------------------------
   * Your next step — the single place the primary action lives.
   * -------------------------------------------------------------------------------------------*/

  // The quotation form lives in the quote tab: jump to it on that tab, switch to it from the others.
  const toForm = (label: string) => (
    <Button asChild variant="accent">
      {tab === "quote" ? (
        <a href="#quote">
          {label} <ArrowRight />
        </a>
      ) : (
        <Link href={tabHref("quote")} scroll={false}>
          {label} <ArrowRight />
        </Link>
      )}
    </Button>
  );

  let nextStep: ReactNode;
  if (wonOrder) {
    nextStep = (
      <NextStepCard
        tone="success"
        icon={Award}
        title="You won this order"
        actions={
          <Button asChild variant="accent">
            <Link href={`/orders/${wonOrder}`}>
              Open order <ArrowRight />
            </Link>
          </Button>
        }
      >
        {sent
          ? `The brand accepted v${sent.version} (${formatMoney(sent.totalAmount, sent.currency)}). Production, payments and samples are tracked on the order.`
          : "Production, payments and samples are tracked on the order."}
      </NextStepCard>
    );
  } else if (quotation?.status === "ACCEPTED") {
    nextStep = (
      <NextStepCard tone="success" icon={CheckCircle2} title="The brand accepted your quotation">
        The order is being set up. It will appear under Orders as soon as it is ready.
      </NextStepCard>
    );
  } else if (quotation?.status === "REJECTED") {
    nextStep = (
      <NextStepCard tone="closed" icon={XCircle} title="The brand declined your quotation">
        {quotation.revisionRequest ? (
          <>
            Reason: <span className="text-ink">{quotation.revisionRequest}</span>
          </>
        ) : (
          "Nothing more is needed from you on this project."
        )}
      </NextStepCard>
    );
  } else if (quotation?.status === "EXPIRED") {
    nextStep = (
      <NextStepCard tone="closed" icon={CalendarX} title="Your quotation expired">
        v{quotation.version} expired on {formatDate(quotation.validUntil)} and can no longer be accepted.
      </NextStepCard>
    );
  } else if (quotation?.status === "WITHDRAWN") {
    nextStep = (
      <NextStepCard tone="closed" icon={Undo2} title="You withdrew your quotation">
        The brand can no longer accept v{quotation.version}. Nothing more is needed from you.
      </NextStepCard>
    );
  } else if (!open) {
    nextStep = (
      <NextStepCard tone="closed" icon={Lock} title="This project is no longer accepting quotations">
        {quotation ? "Your draft was never sent to the brand." : "No quotation was sent."} Project status: {PROJECT_STATUS[project.status]?.label ?? project.status}.
      </NextStepCard>
    );
  } else if (!verified) {
    nextStep = (
      <NextStepCard
        tone="warning"
        icon={ShieldAlert}
        title={sent ? "Get verified to revise your quotation" : "Get verified before you can quote"}
        actions={
          <Button asChild variant="accent">
            <Link href="/factory#verification">
              Get verified <ArrowRight />
            </Link>
          </Button>
        }
      >
        {sent
          ? `The brand can still review v${sent.version}, but only verified factories can change or send quotations.`
          : "Your factory must be verified before you can send quotations."}
      </NextStepCard>
    );
  } else if (quotation?.status === "REVISION_REQUESTED") {
    nextStep = (
      <NextStepCard tone="warning" icon={RefreshCw} title="The brand asked for a revision" actions={toForm("Revise quotation")}>
        {quotation.revisionRequest && (
          <blockquote className="mt-1 border-l-2 border-warning pl-3 text-ink">{quotation.revisionRequest}</blockquote>
        )}
        <p className="mt-1">Update v{quotation.version} and send it again{project.deadline ? ` · delivery needed by ${formatDate(project.deadline)}` : ""}.</p>
      </NextStepCard>
    );
  } else if (sent && (briefChangedSince.length > 0 || filesChangedSince.length > 0)) {
    nextStep = (
      <NextStepCard
        tone="action"
        icon={RefreshCw}
        title={`The brief changed after you sent v${sent.version}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={tabHref(briefChangedSince.length > 0 ? "brief" : "files")} scroll={false}>
                Review changes
              </Link>
            </Button>
            {toForm("Revise quotation")}
          </>
        }
      >
        The brand updated {briefChangedSince.length > 0 && filesChangedSince.length > 0 ? "the requirements and files" : briefChangedSince.length > 0 ? "the requirements" : "the files"}. Check
        that your prices still hold; revise if they don&apos;t.
      </NextStepCard>
    );
  } else if (sent) {
    nextStep = (
      <NextStepCard
        tone="waiting"
        icon={Clock}
        title={`Waiting for the brand to decide on v${sent.version}`}
        actions={
          tab !== "quote" ? (
            <Button asChild variant="outline">
              <Link href={tabHref("quote")} scroll={false}>
                View quotation
              </Link>
            </Button>
          ) : undefined
        }
      >
        Sent {formatDate(sent.submittedAt)} · {formatMoney(sent.totalAmount, sent.currency)} · valid until {formatDate(sent.validUntil)} ({relativeDays(sent.validUntil)}).
        You can still revise it until the brand decides.
      </NextStepCard>
    );
  } else if (quotation?.status === "DRAFT") {
    nextStep = (
      <NextStepCard tone="action" icon={PencilLine} title="Finish and send your quotation" actions={toForm("Finish quotation")}>
        Your draft was saved {formatDate(quotation.updatedAt)}. The brand cannot see it until you send it
        {project.deadline ? ` · delivery needed by ${formatDate(project.deadline)} (${relativeDays(project.deadline)})` : ""}.
      </NextStepCard>
    );
  } else {
    nextStep = (
      <NextStepCard tone="action" icon={Send} title="Send your quotation" actions={toForm("Start quotation")}>
        Price the job from your cost breakdown; the brand compares every line.
        {project.deadline ? ` Delivery is needed by ${formatDate(project.deadline)} (${relativeDays(project.deadline)}).` : ""}
      </NextStepCard>
    );
  }

  /* ---------------------------------------------------------------------------------------------
   * Tab sections
   * -------------------------------------------------------------------------------------------*/

  const earlierVersions =
    quotation && quotation.revisions.length > 0 ? (
      <Panel title="Your earlier versions" bodyClassName="p-0 sm:p-0">
        <ul className="divide-y divide-line-subtle">
          {quotation.revisions.map((r) => {
            const snap = (r.snapshot ?? {}) as { totalAmount?: string };
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span>
                  <span className="font-medium text-ink">v{r.version}</span> <span className="text-ink-muted">· {formatDate(r.createdAt)}</span>
                </span>
                <span className="tabular text-ink">{snap.totalAmount ? formatMoney(snap.totalAmount, quotation.currency) : "—"}</span>
              </li>
            );
          })}
        </ul>
      </Panel>
    ) : null;

  const briefItems: BriefItem[] = [
    { label: "Quantity", value: project.quantity ? `${formatNumber(project.quantity)} units` : "—" },
    { label: "Deliver by", value: formatDate(project.deadline) },
    { label: "Target price", value: targetPrice },
    { label: "Fabric", value: project.fabricRequirements || project.fabrics.join(", ") || "—" },
    { label: "Colours", value: project.colors || "—" },
    { label: "Sizes", value: project.sizes.join(", ") || "—" },
    { label: "Certifications", value: project.requiredCertifications.join(", ") || "None required" },
  ];
  const briefFooter = (
    <div className="space-y-1.5">
      {project.revisions.length > 0 && (
        <p className="text-ink-muted">Requirements last changed {formatDate(project.revisions[0].createdAt)}.</p>
      )}
      <TabLink href={tabHref("brief")}>Full brief and instructions</TabLink>
    </div>
  );

  let section: ReactNode;
  if (tab === "quote") {
    if (editable) {
      section = (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-6">
            <BriefSummary variant="disclosure" items={briefItems} footer={briefFooter} />
            <Panel
              id="quote"
              title={quotation?.submittedAt ? `Revise quotation (currently v${quotation.version})` : "Your quotation"}
              description="Fashinza calculates the total from your breakdown. The brand sees every line."
              actions={quotation ? <WithdrawQuotationButton quotationId={quotation.id} projectId={id} /> : undefined}
            >
              <QuotationForm
                projectId={id}
                currency={project.currency}
                hasBeenSent={!!quotation?.submittedAt}
                defaults={{
                  quantity: quotation?.quantity || project.quantity || 0,
                  unitPrice: s(quotation?.unitPrice),
                  fabricCostPerUnit: s(quotation?.fabricCostPerUnit),
                  finishingCostPerUnit: s(quotation?.finishingCostPerUnit),
                  packagingCostPerUnit: s(quotation?.packagingCostPerUnit),
                  samplingCost: s(quotation?.samplingCost),
                  logisticsCost: s(quotation?.logisticsCost),
                  taxPercent: quotation ? quotation.taxPercent.toString() : "0",
                  minQuantity: quotation?.minQuantity ?? Math.min(profile?.minOrderQuantity || 1, project.quantity ?? 1),
                  productionDays: quotation?.productionDays ?? profile?.typicalLeadTimeDays ?? 45,
                  validUntil: quotation ? quotation.validUntil.toISOString().slice(0, 10) : isoDateInDays(30),
                  notes: quotation?.notes ?? "",
                }}
              />
            </Panel>
            {earlierVersions}
          </div>
          <BriefSummary variant="aside" items={briefItems} footer={briefFooter} />
        </div>
      );
    } else if (sent) {
      section = (
        <div className="space-y-6">
          <Panel id="quote" title={`Your quotation · v${sent.version}`}>
            <DescriptionList
              columns={3}
              items={[
                { label: "Total", value: <span className="tabular font-display text-xl font-medium text-ink">{formatMoney(sent.totalAmount, sent.currency)}</span> },
                { label: "Quantity", value: formatNumber(sent.quantity) },
                { label: "Production", value: `${sent.productionDays} days` },
                { label: "Sent", value: formatDateTime(sent.submittedAt) },
                { label: "Valid until", value: formatDate(sent.validUntil) },
                { label: "Decided", value: formatDateTime(sent.decidedAt) },
              ]}
            />
          </Panel>
          {earlierVersions}
        </div>
      );
    } else {
      section = (
        <EmptyState
          icon={Lock}
          title={!open ? "Quoting has closed" : "Quoting is locked"}
          description={
            !open
              ? "This project closed before a quotation was sent."
              : "The quotation form appears here once your factory is verified."
          }
          action={
            <Button asChild variant="outline">
              <Link href={tabHref("brief")} scroll={false}>
                Read the brief
              </Link>
            </Button>
          }
        />
      );
    }
  } else if (tab === "brief") {
    section = (
      <div className="space-y-6">
        <Panel id="requirements" title="Requirements">
          <DescriptionList
            items={[
              { label: "Fabric", value: project.fabricRequirements || "—" },
              { label: "Fabrics", value: project.fabrics.join(", ") || "—" },
              { label: "Colours", value: project.colors || "—" },
              { label: "Sizes", value: project.sizes.join(", ") || "—" },
              { label: "Target price", value: targetPrice },
              { label: "Processes", value: project.requiredCapabilities.join(", ") || "None specified" },
              { label: "Certifications", value: project.requiredCertifications.join(", ") || "None required" },
              { label: "Preferred country", value: project.preferredCountry ?? "No preference" },
            ]}
          />
          {(project.description || project.sustainabilityNotes || project.additionalInstructions) && (
            <div className="mt-5 space-y-3 border-t border-line-subtle pt-4 text-sm leading-6">
              {project.description && <p className="whitespace-pre-line text-ink">{project.description}</p>}
              {project.sustainabilityNotes && (
                <p>
                  <span className="font-medium text-ink">Sustainability: </span>
                  {project.sustainabilityNotes}
                </p>
              )}
              {project.additionalInstructions && (
                <p>
                  <span className="font-medium text-ink">Instructions: </span>
                  {project.additionalInstructions}
                </p>
              )}
            </div>
          )}
        </Panel>
        {project.revisions.length > 0 && (
          <Panel title="Requirement changes" description={lastSentAt ? `Changes after you sent v${sent?.version} are marked.` : undefined}>
            <Timeline
              items={project.revisions.map((r) => ({
                id: r.id,
                title: `${Object.keys(r.changes as object).join(", ")} changed${lastSentAt && r.createdAt > lastSentAt ? " · after your quotation" : ""}`,
                meta: formatDateTime(r.createdAt),
                tone: "warning" as const,
              }))}
            />
          </Panel>
        )}
      </div>
    );
  } else if (tab === "files") {
    section = (
      <Panel title="Tech pack and files" description="Always quote against the current tech pack version.">
        <AttachmentList items={project.attachments} projectId={id} />
      </Panel>
    );
  } else {
    section = (
      <Panel title="Why you were matched" description={`Algorithm: ${match.algorithm}`}>
        <div className="mb-5 flex items-center gap-4 border-b border-line-subtle pb-5">
          <ScoreRing score={score} size="lg" />
          <p className="text-[13px] leading-5 text-ink-muted">
            Each criterion adds points up to its weight. Only factories that meet every mandatory requirement are matched.
          </p>
        </div>
        <ScoreBreakdownView breakdown={match.breakdown as unknown as ScoreBreakdown} />
      </Panel>
    );
  }

  return (
    <>
      <LegacyHashTab map={LEGACY_HASHES} />
      <PageHeader
        eyebrow="Opportunity"
        title={project.name}
        breadcrumbs={[{ href: "/opportunities", label: "Opportunities" }]}
        meta={quotation ? <StatusBadge map={QUOTATION_STATUS} value={quotation.status} /> : <StatusBadge map={PROJECT_STATUS} value={project.status} />}
        description={`${brand?.companyName ?? "Brand"} (${brand?.country || "—"}) · ${categoryLabel(project.category)} · ${project.quantity ? `${formatNumber(project.quantity)} units` : "Quantity not set"} · deliver by ${formatDate(project.deadline)}`}
      />

      {nextStep}

      <PageTabs tabs={tabs} active={tab} basePath={basePath} label="Opportunity sections" />

      {section}
    </>
  );
}
