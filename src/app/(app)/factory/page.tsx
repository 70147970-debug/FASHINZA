import type { Metadata } from "next";
import { BadgeCheck, FileText, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { FactoryProfileForm } from "@/components/profile/profile-forms";
import { DeleteDocumentButton, RequestVerificationButton, UploadDocumentForm } from "@/components/profile/document-forms";
import { Alert } from "@/components/ui/alert";
import { DOCUMENT_STATUS, DOCUMENT_TYPE, VERIFICATION_STATUS } from "@/lib/labels";
import { formatBytes, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Factory profile" };

export default async function FactoryPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const { welcome } = await searchParams;
  const p = await db.manufacturerProfile.findUniqueOrThrow({
    where: { userId: actor.id },
    include: { capabilities: true, documents: { orderBy: { createdAt: "desc" } } },
  });
  const caps = (kind: string) => p.capabilities.filter((c) => c.kind === kind).map((c) => c.name);
  const hasRegistration = p.documents.some((d) => d.type === "BUSINESS_REGISTRATION" && d.status !== "REJECTED");
  const canRequest = ["UNSUBMITTED", "REJECTED"].includes(p.verificationStatus);

  return (
    <>
      <PageHeader
        title="Factory profile"
        description="Keep your capabilities and capacity up to date — matching uses them to decide which projects you see."
        meta={<StatusBadge map={VERIFICATION_STATUS} value={p.verificationStatus} />}
      />
      {welcome && <Alert tone="success" className="mb-6">Profile saved. Step 2 of 2: upload your business registration (and any certificates), then request verification.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel title="Profile">
          <FactoryProfileForm
            values={{
              ...p,
              categories: p.categories,
              production: caps("PRODUCTION"),
              fabrics: caps("FABRIC"),
              finishing: caps("FINISHING"),
            }}
          />
        </Panel>

        <div className="space-y-6">
          <Panel id="verification" title="Verification">
            {p.verificationStatus === "VERIFIED" && (
              <Alert tone="success"><span className="flex items-center gap-1 font-medium"><BadgeCheck className="size-4" /> Verified on {formatDate(p.verifiedAt)}</span> You can be matched to projects and send quotations.</Alert>
            )}
            {p.verificationStatus === "PENDING" && <Alert tone="info">Your request from {formatDate(p.verificationRequestedAt)} is being reviewed. You will be notified of the decision.</Alert>}
            {p.verificationStatus === "REJECTED" && (
              <Alert tone="error"><span className="font-medium">Not approved.</span> {p.verificationNote ?? "Update your documents and request verification again."}</Alert>
            )}
            {canRequest && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-muted">Only verified factories are matched to brand projects. To request verification:</p>
                <ol className="list-decimal space-y-1 pl-5 text-ink">
                  <li className={hasRegistration ? "text-success" : ""}>Upload your business registration document{hasRegistration ? " ✓" : ""}</li>
                  <li>Optionally upload certifications (GOTS, OEKO-TEX…). Each is checked individually.</li>
                  <li>Send the request.</li>
                </ol>
                <RequestVerificationButton disabled={!hasRegistration} />
              </div>
            )}
          </Panel>

          <Panel id="documents" title="Documents" description="Certifications count in matching only after an administrator verifies them.">
            {p.documents.length === 0 ? (
              <p className="mb-4 flex items-center gap-2 text-sm text-muted"><FileText className="size-4" aria-hidden /> No documents uploaded yet.</p>
            ) : (
              <ul className="mb-5 divide-y divide-line">
                {p.documents.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <a href={`/api/files/${d.fileKey}`} target="_blank" rel="noopener" className="block truncate text-sm font-medium text-navy hover:underline">
                        {d.certificationName ?? DOCUMENT_TYPE[d.type]}
                      </a>
                      <p className="truncate text-xs text-muted">{d.fileName} · {formatBytes(d.size)} · {formatDate(d.createdAt)}</p>
                      {d.status === "REJECTED" && d.reviewNote && <p className="mt-1 flex gap-1 text-xs text-danger"><ShieldAlert className="size-3.5 shrink-0" aria-hidden />{d.reviewNote}</p>}
                    </div>
                    <StatusBadge map={DOCUMENT_STATUS} value={d.status} />
                    {d.status !== "VERIFIED" && <DeleteDocumentButton id={d.id} name={d.fileName} />}
                  </li>
                ))}
              </ul>
            )}
            <UploadDocumentForm />
          </Panel>
        </div>
      </div>
    </>
  );
}
