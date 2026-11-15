import { Link, useLoaderData } from "react-router";
import { Store } from "lucide-react";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { BrandApprovalBadge } from "@/components/app/brand-approval";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { APPROVAL_STATUS, USER_STATUS } from "@fashinza/shared/labels.js";
import { formatDate, formatNumber } from "@fashinza/shared/format.js";

/**
 * /admin/brands — brand approval queue (gate: user ADMIN). New brands wait here until an administrator approves
 * or rejects them; newest registrations first. GET /api/admin/brands (status absent → pending queue).
 */

const TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export async function loader({ request }) {
  const sp = searchOf(request);
  const status = sp.status && sp.status in APPROVAL_STATUS ? sp.status : sp.status === undefined ? "PENDING" : undefined;
  const data = await loadData("/api/admin/brands", { request, query: { status: status ?? "ALL", q: sp.q, page: Number(sp.page) || 1 } });
  return { data, sp, status };
}

/** "Registered today" / "Waiting 3 days" for brands still waiting. */
function waiting(b) {
  if (b.approvalStatus !== "PENDING") return null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 86400000));
  return days === 0 ? "Registered today" : `Waiting ${days} day${days === 1 ? "" : "s"}`;
}

const location = (p) => [p?.city, p?.country].filter(Boolean).join(", ") || "Not given yet";

export default function AdminBrandsPage() {
  const { data, sp, status } = useLoaderData();
  const counts = data.counts;
  const pendingView = status === "PENDING";
  const allCount = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  const badges = (b) => (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <BrandApprovalBadge status={b.approvalStatus} />
      {b.status !== "ACTIVE" && <StatusBadge map={USER_STATUS} value={b.status} />}
    </span>
  );
  const name = (b) => b.brandProfile?.companyName ?? b.name;

  return (
    <>
      <PageMeta title="Brand approvals" />
      <PageHeader
        eyebrow="Administration"
        title="Brand approvals"
        description="Every new brand waits here until you check that the company is genuine. Brands can't create projects until they are approved; aim to decide within 24–48 hours."
      />
      <StatusTabs
        basePath="/admin/brands"
        label="Approval status"
        value={status}
        allValue="ALL"
        allLabel="All"
        allCount={allCount}
        allPosition="end"
        params={{ q: sp.q }}
        options={TABS.map((t) => ({ ...t, count: counts[t.value] ?? 0, attention: t.value === "PENDING" }))}
      />
      <FilterBar basePath="/admin/brands" q={sp.q} searchLabel="Search brands" hidden={{ status: pendingView ? undefined : (status ?? "ALL") }} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={Store}
          title={pendingView ? "No brands waiting for approval" : "No brands found"}
          description={pendingView ? "New brands appear here as soon as they register." : "Try a different search or another tab."}
          action={
            pendingView ? (
              <Button asChild variant="outline">
                <Link to="/admin/brands?status=ALL">Show all brands</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            label="Brands"
            cards={
              <MobileCardList>
                {data.items.map((b) => (
                  <MobileCard
                    key={b.id}
                    href={`/admin/brands/${b.id}`}
                    title={name(b)}
                    badge={badges(b)}
                    meta={
                      <>
                        {b.name} · <span className="break-all">{b.email}</span>
                      </>
                    }
                  >
                    <span className="tabular flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>{location(b.brandProfile)}</span>
                      <span>Registered {formatDate(b.createdAt)}</span>
                      <span>{b.profileCompleted ? "Profile complete" : "Profile not completed"}</span>
                      {waiting(b) && <span className="font-medium text-warning-strong">{waiting(b)}</span>}
                    </span>
                  </MobileCard>
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Brand</th>
                  <th scope="col">Location</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Profile</th>
                  <th scope="col" className="num">
                    Projects
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td className="max-w-72">
                      <Link to={`/admin/brands/${b.id}`} className="cell-primary rounded-sm">
                        {name(b)}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {b.name} · {b.email}
                      </p>
                    </td>
                    <td className="text-[13px]">{location(b.brandProfile)}</td>
                    <td className="whitespace-nowrap">
                      <p className="tabular text-[13px] text-ink">{formatDate(b.createdAt)}</p>
                      {waiting(b) && <p className="text-xs font-medium text-warning-strong">{waiting(b)}</p>}
                    </td>
                    <td className="text-[13px]">
                      {b.profileCompleted ? "Complete" : <span className="text-ink-muted">Not completed</span>}
                      {(b.brandProfile?.website || b.brandProfile?.socialLinks > 0) && (
                        <p className="text-xs text-ink-muted">
                          {[b.brandProfile.website && "Website", b.brandProfile.socialLinks > 0 && `${b.brandProfile.socialLinks} social link${b.brandProfile.socialLinks === 1 ? "" : "s"}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="num">{formatNumber(b.projectCount)}</td>
                    <td>{badges(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/brands" params={{ status: status ?? "ALL", q: sp.q }} />
        </>
      )}
    </>
  );
}
