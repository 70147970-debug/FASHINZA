import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Check, CircleDashed, Clock, FileText, Globe, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getFactory } from "@/server/services/admin";
import { isAppError } from "@/server/errors";
import { DescriptionList, EmptyState, MetaItem, PageHeader, Panel, StatusBadge, Timeline } from "@/components/app/primitives";
import { DocumentReviewButtons, RevokeVerificationButton, UserStatusButton, VerificationDecision } from "@/components/admin/admin-forms";
import { auditTimelineItem } from "@/components/admin/audit-parts";
import { SubHeading } from "@/components/orders/order-parts";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_STATUS, DOCUMENT_TYPE, USER_STATUS, VERIFICATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Review factory" };

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-muted">—</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i}>
          <Badge tone="neutral">{i}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Check1({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-[13px]">
      {done ? (
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary text-primary-fg" aria-hidden>
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      ) : (
        <CircleDashed className="size-4 shrink-0 text-warning" aria-hidden />
      )}
      <span className={done ? "text-ink" : "font-medium text-warning-strong"}>{children}</span>
      <span className="sr-only">{done ? "(done)" : "(to do)"}</span>
    </li>
  );
}

export default async function AdminFactoryPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const { id } = await params;
  const { profile: p, history } = await getFactory(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  const caps = (k: string) => p.capabilities.filter((c) => c.kind === k).map((c) => c.name);
  const regVerified = p.documents.some((d) => d.type === "BUSINESS_REGISTRATION" && d.status === "VERIFIED");
  const hasReg = p.documents.some((d) => d.type === "BUSINESS_REGISTRATION");
  const reviewed = p.documents.filter((d) => d.status !== "PENDING").length;

  return (
    <>
      <PageHeader
        eyebrow="Factory verification"
        title={p.businessName}
        breadcrumbs={[{ href: "/admin/factories", label: "Factory verification" }]}
        meta={
          <>
            <StatusBadge map={VERIFICATION_STATUS} value={p.verificationStatus} />
            {p.user.status !== "ACTIVE" && <StatusBadge map={USER_STATUS} value={p.user.status} />}
          </>
        }
        metaRow={
          <>
            <MetaItem icon={MapPin}>
              {p.city}, {p.country}
            </MetaItem>
            <MetaItem icon={Mail}>{p.user.email}</MetaItem>
            <MetaItem icon={CalendarDays}>Registered {formatDate(p.user.createdAt)}</MetaItem>
            {p.verificationRequestedAt && <MetaItem icon={Clock}>Requested {formatDateTime(p.verificationRequestedAt)}</MetaItem>}
          </>
        }
        actions={
          <>
            {p.verificationStatus === "PENDING" && <VerificationDecision profileId={p.id} name={p.businessName} />}
            {p.verificationStatus === "VERIFIED" && <RevokeVerificationButton profileId={p.id} name={p.businessName} />}
            <UserStatusButton userId={p.user.id} name={p.businessName} suspended={p.user.status === "SUSPENDED"} size="md" />
          </>
        }
      />
      {p.verificationStatus === "PENDING" && !regVerified && (
        <Alert tone="warning" className="mb-6">
          Verify the business registration document before approving the factory.
        </Alert>
      )}
      {p.verificationNote && (
        <Alert tone="info" className="mb-6">
          Last decision note: {p.verificationNote}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel
            id="documents"
            title="Documents"
            description="Open each file and check it before verifying."
            bodyClassName="p-0 sm:p-0"
          >
            <ul className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line bg-surface-muted px-4 py-3 sm:px-5" aria-label="Review checklist">
              <Check1 done={regVerified}>{regVerified ? "Business registration verified" : hasReg ? "Business registration not verified yet" : "No business registration uploaded"}</Check1>
              <Check1 done={p.documents.length > 0 && reviewed === p.documents.length}>
                <span className="tabular">
                  {reviewed} of {p.documents.length}
                </span>{" "}
                documents reviewed
              </Check1>
            </ul>
            {p.documents.length === 0 ? (
              <EmptyState variant="plain" icon={FileText} title="No documents uploaded" description="The factory has not uploaded a registration or any certificates yet." />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {p.documents.map((d) => (
                  <li key={d.id} className={cn("flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5", d.status === "PENDING" && "bg-warning-soft/40")}>
                    <span className="hidden size-9 shrink-0 place-items-center rounded-md border border-line bg-canvas text-ink-muted sm:grid" aria-hidden>
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/files/${d.fileKey}`}
                          target="_blank"
                          rel="noopener"
                          className="rounded-sm text-sm font-medium text-ink underline-offset-4 hover:underline"
                        >
                          {d.certificationName ?? DOCUMENT_TYPE[d.type]}
                        </a>
                        <StatusBadge map={DOCUMENT_STATUS} value={d.status} />
                      </div>
                      <p className="mt-0.5 break-words text-xs leading-5 text-ink-muted">
                        {d.certificationName ? `${DOCUMENT_TYPE[d.type]} · ` : ""}
                        {d.fileName} · {formatBytes(d.size)} · uploaded {formatDate(d.createdAt)}
                      </p>
                      {d.reviewNote && <p className="mt-1 text-[13px] leading-5 text-ink">{d.reviewNote}</p>}
                    </div>
                    {d.status === "PENDING" && <DocumentReviewButtons documentId={d.id} profileId={p.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Review history" description="Decisions on this factory and its documents, newest first.">
            <Timeline items={history.map((h) => auditTimelineItem(h, formatDateTime(h.createdAt)))} empty="No decisions recorded yet." />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Capacity">
            <DescriptionList
              layout="rows"
              items={[
                { label: "Minimum order", value: <span className="tabular">{formatNumber(p.minOrderQuantity)} units</span> },
                { label: "Monthly capacity", value: <span className="tabular">{formatNumber(p.maxMonthlyCapacity)} units</span> },
                { label: "Typical lead time", value: <span className="tabular">{p.typicalLeadTimeDays} days</span> },
              ]}
            />
          </Panel>

          <Panel title="Capabilities">
            <div className="space-y-5">
              <div>
                <SubHeading className="mb-2">Categories</SubHeading>
                <ChipList items={p.categories.map(categoryLabel)} />
              </div>
              <div>
                <SubHeading className="mb-2">Production</SubHeading>
                <ChipList items={caps("PRODUCTION")} />
              </div>
              <div>
                <SubHeading className="mb-2">Fabrics</SubHeading>
                <ChipList items={caps("FABRIC")} />
              </div>
              <div>
                <SubHeading className="mb-2">Finishing</SubHeading>
                <ChipList items={caps("FINISHING")} />
              </div>
            </div>
          </Panel>

          <Panel title="Contact and about">
            <ul className="space-y-2.5 text-[13px]">
              <li className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                <span className="min-w-0 break-words text-ink">{p.contactName}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                <span className="min-w-0 break-all text-ink">{p.contactEmail}</span>
              </li>
              {p.contactPhone && (
                <li className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span className="tabular min-w-0 text-ink">{p.contactPhone}</span>
                </li>
              )}
              <li className="flex items-start gap-2.5">
                <Globe className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                <span className="min-w-0 break-all text-ink">{p.website ?? "—"}</span>
              </li>
            </ul>
            <p className="mt-4 whitespace-pre-line border-t border-line-subtle pt-4 text-sm leading-6 text-ink">{p.description}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
