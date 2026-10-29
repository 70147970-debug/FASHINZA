import type { Metadata } from "next";
import Link from "next/link";
import { Factory, FileText } from "lucide-react";
import type { VerificationStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/server/auth/session";
import { listFactories } from "@/server/services/admin";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { VERIFICATION_STATUS } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Factory verification" };

/** Days since the factory asked for verification (only meaningful while the request is pending). */
function waitingDays(d: Date | null) {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

export default async function AdminFactoriesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  // The queue defaults to pending requests; "ALL" (or an empty filter) shows every factory.
  const status = (sp.status && sp.status in VERIFICATION_STATUS ? sp.status : sp.status === undefined ? "PENDING" : undefined) as VerificationStatus | undefined;
  const data = await listFactories(actor, { status, q: sp.q, page: Number(sp.page) || 1 });
  const pendingView = status === "PENDING";

  const waiting = (f: (typeof data.items)[number]) => {
    const days = f.verificationStatus === "PENDING" ? waitingDays(f.verificationRequestedAt) : null;
    if (days === null) return null;
    return days === 0 ? "Requested today" : `Waiting ${days} day${days === 1 ? "" : "s"}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Factory verification"
        description="Review documents before approving. Only verified factories are matched to brand projects."
      />
      <StatusTabs
        basePath="/admin/factories"
        label="Verification status"
        value={status}
        allValue="ALL"
        allLabel="All factories"
        params={{ q: sp.q }}
        options={(["PENDING", "VERIFIED", "REJECTED", "UNSUBMITTED"] as const).map((v) => ({ value: v, label: VERIFICATION_STATUS[v].label }))}
      />
      <FilterBar basePath="/admin/factories" q={sp.q} searchLabel="Search factories" hidden={{ status: pendingView ? undefined : (status ?? "ALL") }} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={Factory}
          title={pendingView ? "No factories waiting for review" : "No factories found"}
          description={pendingView ? "Requests appear here when a factory uploads its documents and asks for verification." : "Factories appear here after completing their profile."}
          action={
            pendingView ? (
              <Button asChild variant="outline">
                <Link href="/admin/factories?status=ALL">Show all factories</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            label="Factories"
            cards={
              <MobileCardList>
                {data.items.map((f) => (
                  <MobileCard
                    key={f.id}
                    href={`/admin/factories/${f.id}`}
                    title={f.businessName}
                    badge={<StatusBadge map={VERIFICATION_STATUS} value={f.verificationStatus} />}
                    meta={
                      <>
                        {f.city}, {f.country} · <span className="break-all">{f.user.email}</span>
                      </>
                    }
                  >
                    <span className="tabular flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>MOQ {formatNumber(f.minOrderQuantity)}</span>
                      <span>{formatNumber(f.maxMonthlyCapacity)} / mo</span>
                      <span>{f._count.documents} document{f._count.documents === 1 ? "" : "s"}</span>
                      {waiting(f) && <span className="font-medium text-warning-strong">{waiting(f)}</span>}
                    </span>
                  </MobileCard>
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Factory</th>
                  <th scope="col">Location</th>
                  <th scope="col" className="num">MOQ</th>
                  <th scope="col" className="num">Capacity / mo</th>
                  <th scope="col" className="num">Documents</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/admin/factories/${f.id}`} className="cell-primary rounded-sm">
                        {f.businessName}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-muted">{f.user.email}</p>
                    </td>
                    <td className="text-[13px]">
                      {f.city}, {f.country}
                    </td>
                    <td className="num">{formatNumber(f.minOrderQuantity)}</td>
                    <td className="num">{formatNumber(f.maxMonthlyCapacity)}</td>
                    <td className="num">
                      <span className="inline-flex items-center justify-end gap-1.5">
                        <FileText className="size-3.5 text-ink-subtle" aria-hidden />
                        {f._count.documents}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <p className="tabular text-[13px] text-ink">{formatDate(f.verificationRequestedAt)}</p>
                      {waiting(f) && <p className="text-xs font-medium text-warning-strong">{waiting(f)}</p>}
                    </td>
                    <td>
                      <StatusBadge map={VERIFICATION_STATUS} value={f.verificationStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/factories" params={{ status: status ?? "ALL", q: sp.q }} />
        </>
      )}
    </>
  );
}
