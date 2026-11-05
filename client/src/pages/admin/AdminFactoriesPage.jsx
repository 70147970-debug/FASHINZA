import { Link, useLoaderData } from "react-router";
import { Factory, FileText } from "lucide-react";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { USER_STATUS, VERIFICATION_STATUS } from "@fashinza/shared/labels.js";
import { formatDate, formatNumber } from "@fashinza/shared/format.js";

/** /admin/factories — port of src/app/(app)/admin/factories/page.tsx (gate: user ADMIN). */

export async function loader({ request }) {
  const sp = searchOf(request);
  // The queue defaults to pending requests; "ALL" (or an empty filter) shows every factory.
  const status = sp.status && sp.status in VERIFICATION_STATUS ? sp.status : sp.status === undefined ? "PENDING" : undefined;
  const data = await loadData("/api/admin/factories", { request, query: { status: status ?? "ALL", q: sp.q, page: Number(sp.page) || 1 } });
  return { data, sp, status };
}

/** Days since the factory asked for verification (only meaningful while the request is pending). */
function waitingDays(d) {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

export default function AdminFactoriesPage() {
  const { data, sp, status } = useLoaderData();
  const counts = data.counts;
  const pendingView = status === "PENDING";
  const allCount = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  /** Verification status, plus the account status when the account cannot sign in (e.g. suspended). */
  const statusBadges = (f) => (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusBadge map={VERIFICATION_STATUS} value={f.verificationStatus} />
      {f.user.status !== "ACTIVE" && <StatusBadge map={USER_STATUS} value={f.user.status} />}
    </span>
  );

  const waiting = (f) => {
    const days = f.verificationStatus === "PENDING" ? waitingDays(f.verificationRequestedAt) : null;
    if (days === null) return null;
    return days === 0 ? "Requested today" : `Waiting ${days} day${days === 1 ? "" : "s"}`;
  };

  return (
    <>
      <PageMeta title="Factory verification" />
      <PageHeader eyebrow="Administration" title="Factory verification" description="Review documents before approving. Only verified factories are matched to brand projects." />
      <StatusTabs
        basePath="/admin/factories"
        label="Verification status"
        value={status}
        allValue="ALL"
        allLabel="All"
        allCount={allCount}
        allPosition="end"
        params={{ q: sp.q }}
        options={["PENDING", "VERIFIED", "REJECTED", "UNSUBMITTED"].map((v) => ({ value: v, label: VERIFICATION_STATUS[v].label, count: counts[v] ?? 0, attention: v === "PENDING" }))}
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
                <Link to="/admin/factories?status=ALL">Show all factories</Link>
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
                    badge={statusBadges(f)}
                    meta={
                      <>
                        {f.city}, {f.country} · <span className="break-all">{f.user.email}</span>
                      </>
                    }
                  >
                    <span className="tabular flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>MOQ {formatNumber(f.minOrderQuantity)}</span>
                      <span>{formatNumber(f.maxMonthlyCapacity)} / mo</span>
                      <span>
                        {f._count.documents} document{f._count.documents === 1 ? "" : "s"}
                      </span>
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
                  <th scope="col" className="num">
                    MOQ
                  </th>
                  <th scope="col" className="num">
                    Capacity / mo
                  </th>
                  <th scope="col" className="num">
                    Documents
                  </th>
                  <th scope="col">Requested</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link to={`/admin/factories/${f.id}`} className="cell-primary rounded-sm">
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
                    <td>{statusBadges(f)}</td>
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
