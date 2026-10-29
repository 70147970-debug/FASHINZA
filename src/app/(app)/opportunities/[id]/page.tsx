import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { getOpportunity } from "@/server/services/opportunities";
import { isAppError } from "@/server/errors";
import { DescriptionList, Metric, MetricStrip, PageHeader, Panel, StatusBadge, Timeline } from "@/components/app/primitives";
import { AttachmentList } from "@/components/projects/attachment-list";
import { ScoreBreakdownView, ScoreRing } from "@/components/projects/match-card";
import { QuotationForm, WithdrawQuotationButton } from "@/components/quotations/quotation-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ScoreBreakdown } from "@/lib/matching";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatDateTime, formatMoney, formatNumber, isoDateInDays, relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const { id } = await params;
  const { match, project, quotation, profile } = await getOpportunity(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const open = ["SUBMITTED", "QUOTING"].includes(project.status);
  const editable = open && profile?.verificationStatus === "VERIFIED" && (!quotation || ["DRAFT", "SUBMITTED", "REVISION_REQUESTED"].includes(quotation.status));
  const wonOrder = project.order?.manufacturerId === actor.id ? project.order.id : null;
  const s = (v: { toFixed(n: number): string } | null | undefined) => (v ? v.toFixed(2) : "");

  const brand = project.brand.brandProfile;
  const score = Number(match.score);
  const quoteValue = quotation && quotation.status !== "DRAFT" ? formatMoney(quotation.totalAmount, quotation.currency) : quotation ? "Draft" : "Not sent";

  const requirements = (
    <Panel id="requirements" title="Requirements">
      <DescriptionList
        items={[
          { label: "Fabric", value: project.fabricRequirements },
          { label: "Fabrics", value: project.fabrics.join(", ") || "—" },
          { label: "Colours", value: project.colors },
          { label: "Sizes", value: project.sizes.join(", ") },
          { label: "Target price", value: project.targetUnitPrice ? `${formatMoney(project.targetUnitPrice, project.currency)} / unit` : "Not shared" },
          { label: "Processes", value: project.requiredCapabilities.join(", ") || "None specified" },
          { label: "Certifications", value: project.requiredCertifications.join(", ") || "None required" },
          { label: "Preferred country", value: project.preferredCountry ?? "No preference" },
        ]}
      />
      {(project.description || project.sustainabilityNotes || project.additionalInstructions) && (
        <div className="mt-5 space-y-3 border-t border-line-subtle pt-4 text-sm leading-6">
          {project.description && <p className="whitespace-pre-line text-ink">{project.description}</p>}
          {project.sustainabilityNotes && <p><span className="font-medium text-ink">Sustainability: </span>{project.sustainabilityNotes}</p>}
          {project.additionalInstructions && <p><span className="font-medium text-ink">Instructions: </span>{project.additionalInstructions}</p>}
        </div>
      )}
    </Panel>
  );

  return (
    <>
      <PageHeader
        eyebrow="Opportunity"
        title={project.name}
        breadcrumbs={[{ href: "/opportunities", label: "Opportunities" }]}
        meta={quotation ? <StatusBadge map={QUOTATION_STATUS} value={quotation.status} /> : <StatusBadge map={PROJECT_STATUS} value={project.status} />}
        description={`${brand?.companyName ?? "Brand"} (${brand?.country || "—"}) · ${categoryLabel(project.category)} · ${formatNumber(project.quantity)} units · deliver by ${formatDate(project.deadline)}`}
        actions={
          <>
            {quotation && editable && <WithdrawQuotationButton quotationId={quotation.id} projectId={id} />}
            {wonOrder && <Button asChild variant="accent"><Link href={`/orders/${wonOrder}`}>Open order <ArrowRight /></Link></Button>}
          </>
        }
      />

      {quotation?.status === "REVISION_REQUESTED" && quotation.revisionRequest && (
        <Alert tone="warning" title="The brand asked for a revision" className="mb-6">{quotation.revisionRequest}</Alert>
      )}
      {quotation?.status === "REJECTED" && <Alert tone="error" className="mb-6">This quotation was declined{quotation.revisionRequest ? `: ${quotation.revisionRequest}` : "."}</Alert>}
      {quotation?.status === "EXPIRED" && <Alert tone="info" className="mb-6">This quotation expired on {formatDate(quotation.validUntil)} and can no longer be accepted.</Alert>}
      {!open && !wonOrder && !quotation && <Alert tone="info" className="mb-6">This project is no longer accepting quotations.</Alert>}

      <MetricStrip label="Key facts">
        <Metric label="Quantity" value={project.quantity ? formatNumber(project.quantity) : "—"} hint="units" muted={!project.quantity} />
        <Metric label="Deliver by" value={formatDate(project.deadline)} hint={project.deadline && open ? relativeDays(project.deadline) : undefined} />
        <Metric label="Target price" value={project.targetUnitPrice ? formatMoney(project.targetUnitPrice, project.currency) : "—"} hint={project.targetUnitPrice ? "per unit" : "Not shared"} muted={!project.targetUnitPrice} />
        <Metric label="Match score" value={`${score.toFixed(0)}/100`} tone={score >= 70 ? "accent" : undefined} />
        <Metric label="Your quotation" value={quoteValue} muted={!quotation || quotation.status === "DRAFT"} hint={quotation && quotation.status !== "DRAFT" ? `v${quotation.version}` : undefined} />
      </MetricStrip>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {editable && requirements}
          {editable ? (
            <Panel id="quote" title={quotation?.submittedAt ? `Revise quotation (currently v${quotation.version})` : "Your quotation"} description="Fashinza calculates the total from your breakdown. The brand sees every line.">
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
          ) : quotation && quotation.status !== "DRAFT" ? (
            <Panel title={`Your quotation · v${quotation.version}`} actions={<StatusBadge map={QUOTATION_STATUS} value={quotation.status} />}>
              <DescriptionList
                columns={3}
                items={[
                  { label: "Total", value: <span className="tabular font-display text-xl font-medium text-ink">{formatMoney(quotation.totalAmount, quotation.currency)}</span> },
                  { label: "Quantity", value: formatNumber(quotation.quantity) },
                  { label: "Production", value: `${quotation.productionDays} days` },
                  { label: "Sent", value: formatDateTime(quotation.submittedAt) },
                  { label: "Valid until", value: formatDate(quotation.validUntil) },
                  { label: "Decided", value: formatDateTime(quotation.decidedAt) },
                ]}
              />
            </Panel>
          ) : profile?.verificationStatus !== "VERIFIED" ? (
            <Alert tone="info">Your factory must be verified before you can send quotations.</Alert>
          ) : null}

          {!editable && requirements}
        </div>

        <div className="space-y-6">
          <Panel title="Why you were matched" description={`Score ${score.toFixed(0)}/100 · ${match.algorithm}`}>
            <div className="mb-5 flex items-center gap-4 border-b border-line-subtle pb-5">
              <ScoreRing score={score} size="lg" />
              <p className="text-[13px] leading-5 text-ink-muted">Each criterion adds points up to its weight. Only factories that meet every mandatory requirement are matched.</p>
            </div>
            <ScoreBreakdownView breakdown={match.breakdown as unknown as ScoreBreakdown} />
          </Panel>
          <Panel title="Tech pack and files" description="Always quote against the current tech pack version.">
            <AttachmentList items={project.attachments} projectId={id} />
          </Panel>
          {project.revisions.length > 0 && (
            <Panel title="Requirement changes">
              <Timeline
                items={project.revisions.map((r) => ({
                  id: r.id,
                  title: `${Object.keys(r.changes as object).join(", ")} changed`,
                  meta: formatDateTime(r.createdAt),
                  tone: "warning" as const,
                }))}
              />
            </Panel>
          )}
          {quotation && quotation.revisions.length > 0 && (
            <Panel title="Your earlier versions" bodyClassName="p-0 sm:p-0">
              <ul className="divide-y divide-line-subtle">
                {quotation.revisions.map((r) => {
                  const snap = (r.snapshot ?? {}) as { totalAmount?: string };
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                      <span><span className="font-medium text-ink">v{r.version}</span> <span className="text-ink-muted">· {formatDate(r.createdAt)}</span></span>
                      <span className="tabular text-ink">{snap.totalAmount ? formatMoney(snap.totalAmount, quotation.currency) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
