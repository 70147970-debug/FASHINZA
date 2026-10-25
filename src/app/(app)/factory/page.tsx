import type { Metadata } from "next";
import { Check, Factory, FileText, MapPin, Package, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { MetaItem, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { FactoryProfileForm } from "@/components/profile/profile-forms";
import { DeleteDocumentButton, RequestVerificationButton, UploadDocumentForm } from "@/components/profile/document-forms";
import { Alert } from "@/components/ui/alert";
import { DOCUMENT_STATUS, DOCUMENT_TYPE, VERIFICATION_STATUS } from "@/lib/labels";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const location = [p.city, p.country].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        title="Factory profile"
        description="Keep your capabilities and capacity up to date — matching uses them to decide which projects you see."
        meta={<StatusBadge map={VERIFICATION_STATUS} value={p.verificationStatus} />}
        metaRow={
          <>
            {location && <MetaItem icon={MapPin}>{location}</MetaItem>}
            {p.minOrderQuantity > 0 && <MetaItem icon={Package}>MOQ {formatNumber(p.minOrderQuantity)} units</MetaItem>}
            {p.maxMonthlyCapacity > 0 && <MetaItem icon={Factory}>{formatNumber(p.maxMonthlyCapacity)} units / month</MetaItem>}
          </>
        }
      />
      {welcome && <Alert tone="success" className="mb-6">Profile saved. Step 2 of 2: upload your business registration (and any certificates), then request verification.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Profile" description="Changes apply to the next matching run.">
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

        <div className={cn("space-y-6", p.verificationStatus !== "VERIFIED" && "max-xl:order-first")}>
          <Panel id="verification" title="Verification">
            {p.verificationStatus === "VERIFIED" && (
              <Alert tone="success" title={`Verified on ${formatDate(p.verifiedAt)}`}>You can be matched to projects and send quotations.</Alert>
            )}
            {p.verificationStatus === "PENDING" && (
              <Alert tone="info">Your request from {formatDate(p.verificationRequestedAt)} is being reviewed. You will be notified of the decision.</Alert>
            )}
            {p.verificationStatus === "REJECTED" && (
              <Alert tone="error" title="Not approved.">{p.verificationNote ?? "Update your documents and request verification again."}</Alert>
            )}
            {canRequest && (
              <div className={cn("space-y-4 text-sm", p.verificationStatus === "REJECTED" && "mt-4")}>
                <p className="text-muted">Only verified factories are matched to brand projects. To request verification:</p>
                <ol className="space-y-3">
                  <ChecklistItem n={1} done={hasRegistration}>Upload your business registration document</ChecklistItem>
                  <ChecklistItem n={2}>Optionally upload certifications (GOTS, OEKO-TEX…). Each is checked individually.</ChecklistItem>
                  <ChecklistItem n={3}>Send the request.</ChecklistItem>
                </ol>
                <div className="[&>button]:w-full">
                  <RequestVerificationButton disabled={!hasRegistration} />
                </div>
              </div>
            )}
          </Panel>

          <Panel id="documents" title="Documents" description="Certifications count in matching only after an administrator verifies them." bodyClassName="p-0 sm:p-0">
            {p.documents.length === 0 ? (
              <p className="flex items-center gap-3 px-4 py-4 text-sm text-muted sm:px-5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700">
                  <FileText className="size-4" aria-hidden />
                </span>
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {p.documents.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-muted text-neutral-500">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <a href={`/api/files/${d.fileKey}`} target="_blank" rel="noopener" className="min-w-0 truncate text-sm font-medium text-navy hover:underline">
                          {d.certificationName ?? DOCUMENT_TYPE[d.type]}
                        </a>
                        <StatusBadge map={DOCUMENT_STATUS} value={d.status} />
                      </div>
                      <p className="truncate text-xs leading-5 text-muted">{d.fileName} · {formatBytes(d.size)} · {formatDate(d.createdAt)}</p>
                      {d.status === "REJECTED" && d.reviewNote && (
                        <p className="mt-1 flex gap-1 text-xs text-danger-700"><ShieldAlert className="size-3.5 shrink-0" aria-hidden />{d.reviewNote}</p>
                      )}
                    </div>
                    {d.status !== "VERIFIED" && <DeleteDocumentButton id={d.id} name={d.fileName} />}
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line bg-surface-muted px-4 py-4 sm:px-5">
              <h3 className="mb-3 text-sm font-semibold text-navy">Add a document</h3>
              <UploadDocumentForm />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function ChecklistItem({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "tabular grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
          done ? "bg-teal text-white" : "border border-line-strong bg-surface text-muted",
        )}
        aria-hidden
      >
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <span className={cn("pt-0.5 leading-5", done ? "text-muted" : "text-ink")}>
        {children}
        {done && <span className="sr-only"> (done)</span>}
      </span>
    </li>
  );
}
