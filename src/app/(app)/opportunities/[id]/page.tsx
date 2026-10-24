import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { getOpportunity } from "@/server/services/opportunities";
import { isAppError } from "@/server/errors";
import { DetailList, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { AttachmentList } from "@/components/projects/attachment-list";
import { ScoreBreakdownView } from "@/components/projects/match-card";
import { QuotationForm, WithdrawQuotationButton } from "@/components/quotations/quotation-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ScoreBreakdown } from "@/lib/matching";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatDateTime, formatMoney, formatNumber, isoDateInDays } from "@/lib/format";

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

  return (
    <>
      <PageHeader
        title={project.name}
        breadcrumbs={[{ href: "/opportunities", label: "Opportunities" }]}
        meta={quotation ? <StatusBadge map={QUOTATION_STATUS} value={quotation.status} /> : <StatusBadge map={PROJECT_STATUS} value={project.status} />}
        description={`${project.brand.brandProfile?.companyName ?? "Brand"} (${project.brand.brandProfile?.country || "—"}) · ${categoryLabel(project.category)} · ${formatNumber(project.quantity)} units · deliver by ${formatDate(project.deadline)}`}
        actions={
          <>
            {wonOrder && <Button asChild variant="accent"><Link href={`/orders/${wonOrder}`}>Open order <ArrowRight /></Link></Button>}
            {quotation && editable && <WithdrawQuotationButton quotationId={quotation.id} projectId={id} />}
          </>
        }
      />

      {quotation?.status === "REVISION_REQUESTED" && quotation.revisionRequest && (
        <Alert tone="info" className="mb-6"><span className="font-medium">The brand asked for a revision:</span> {quotation.revisionRequest}</Alert>
      )}
      {quotation?.status === "REJECTED" && <Alert tone="error" className="mb-6">This quotation was declined{quotation.revisionRequest ? `: ${quotation.revisionRequest}` : "."}</Alert>}
      {quotation?.status === "EXPIRED" && <Alert tone="info" className="mb-6">This quotation expired on {formatDate(quotation.validUntil)} and can no longer be accepted.</Alert>}
      {!open && !wonOrder && !quotation && <Alert tone="info" className="mb-6">This project is no longer accepting quotations.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
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
            <Panel title={`Your quotation · v${quotation.version}`}>
              <DetailList
                columns={3}
                items={[
                  { label: "Total", value: formatMoney(quotation.totalAmount, quotation.currency) },
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

          <Panel title="Requirements">
            <DetailList
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
            {project.description && <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm">{project.description}</p>}
            {project.sustainabilityNotes && <p className="mt-3 text-sm"><span className="font-medium text-navy">Sustainability: </span>{project.sustainabilityNotes}</p>}
            {project.additionalInstructions && <p className="mt-3 text-sm"><span className="font-medium text-navy">Instructions: </span>{project.additionalInstructions}</p>}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Why you were matched" description={`Score ${Number(match.score).toFixed(0)}/100 · ${match.algorithm}`}>
            <ScoreBreakdownView breakdown={match.breakdown as unknown as ScoreBreakdown} />
          </Panel>
          <Panel title="Tech pack and files" description="Always quote against the current tech pack version.">
            <AttachmentList items={project.attachments} projectId={id} />
          </Panel>
          {project.revisions.length > 0 && (
            <Panel title="Requirement changes">
              <ul className="space-y-2 text-sm">
                {project.revisions.map((r) => (
                  <li key={r.id}>
                    <span className="text-xs text-muted">{formatDateTime(r.createdAt)}: </span>
                    {Object.keys(r.changes as object).join(", ")} changed
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {quotation && quotation.revisions.length > 0 && (
            <Panel title="Your earlier versions">
              <ul className="space-y-1 text-sm">
                {quotation.revisions.map((r) => {
                  const snap = (r.snapshot ?? {}) as { totalAmount?: string };
                  return <li key={r.id}>v{r.version} · {formatDate(r.createdAt)} · {snap.totalAmount ? formatMoney(snap.totalAmount, quotation.currency) : "—"}</li>;
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
