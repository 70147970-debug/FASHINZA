import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { getFactory } from "@/server/services/admin";
import { isAppError } from "@/server/errors";
import { DetailList, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { DocumentReviewButtons, RevokeVerificationButton, UserStatusButton, VerificationDecision } from "@/components/admin/admin-forms";
import { Alert } from "@/components/ui/alert";
import { DOCUMENT_STATUS, DOCUMENT_TYPE, USER_STATUS, VERIFICATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Review factory" };

export default async function AdminFactoryPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const { id } = await params;
  const { profile: p, history } = await getFactory(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const caps = (k: string) => p.capabilities.filter((c) => c.kind === k).map((c) => c.name).join(", ") || "—";
  const regVerified = p.documents.some((d) => d.type === "BUSINESS_REGISTRATION" && d.status === "VERIFIED");

  return (
    <>
      <PageHeader
        title={p.businessName}
        breadcrumbs={[{ href: "/admin/factories", label: "Factory verification" }]}
        meta={<><StatusBadge map={VERIFICATION_STATUS} value={p.verificationStatus} /><StatusBadge map={USER_STATUS} value={p.user.status} /></>}
        description={`${p.city}, ${p.country} · account ${p.user.email} · registered ${formatDate(p.user.createdAt)}`}
        actions={
          <>
            {p.verificationStatus === "PENDING" && <VerificationDecision profileId={p.id} name={p.businessName} />}
            {p.verificationStatus === "VERIFIED" && <RevokeVerificationButton profileId={p.id} name={p.businessName} />}
            <UserStatusButton userId={p.user.id} name={p.businessName} suspended={p.user.status === "SUSPENDED"} />
          </>
        }
      />
      {p.verificationStatus === "PENDING" && !regVerified && <Alert tone="info" className="mb-6">Verify the business registration document before approving the factory.</Alert>}
      {p.verificationNote && <Alert tone="info" className="mb-6">Last decision note: {p.verificationNote}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Panel title="Documents" description="Open each file and check it before verifying.">
            {p.documents.length === 0 ? (
              <p className="text-sm text-muted">No documents uploaded.</p>
            ) : (
              <ul className="divide-y divide-line">
                {p.documents.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={`/api/files/${d.fileKey}`} target="_blank" rel="noopener" className="font-medium text-navy hover:underline">{d.certificationName ?? DOCUMENT_TYPE[d.type]}</a>
                        <StatusBadge map={DOCUMENT_STATUS} value={d.status} />
                      </div>
                      <p className="text-xs text-muted">{d.fileName} · {formatBytes(d.size)} · uploaded {formatDate(d.createdAt)}{d.reviewNote ? ` · ${d.reviewNote}` : ""}</p>
                    </div>
                    {d.status === "PENDING" && <DocumentReviewButtons documentId={d.id} profileId={p.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Review history">
            {history.length === 0 ? (
              <p className="text-sm text-muted">No decisions recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-medium text-navy">{h.action.replaceAll("_", " ").toLowerCase()}</span> by {h.actor.name}
                    <span className="text-xs text-muted"> · {formatDateTime(h.createdAt)}</span>
                    {h.reason && <p className="text-xs text-muted">{h.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel title="Profile">
          <DetailList
            items={[
              { label: "Categories", value: p.categories.map(categoryLabel).join(", ") },
              { label: "Production", value: caps("PRODUCTION") },
              { label: "Fabrics", value: caps("FABRIC") },
              { label: "Finishing", value: caps("FINISHING") },
              { label: "Minimum order", value: `${formatNumber(p.minOrderQuantity)} units` },
              { label: "Monthly capacity", value: `${formatNumber(p.maxMonthlyCapacity)} units` },
              { label: "Typical lead time", value: `${p.typicalLeadTimeDays} days` },
              { label: "Contact", value: `${p.contactName} · ${p.contactEmail}${p.contactPhone ? ` · ${p.contactPhone}` : ""}` },
              { label: "Website", value: p.website ?? "—" },
              { label: "Requested", value: formatDateTime(p.verificationRequestedAt) },
            ]}
          />
          <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-sm">{p.description}</p>
        </Panel>
      </div>
    </>
  );
}
