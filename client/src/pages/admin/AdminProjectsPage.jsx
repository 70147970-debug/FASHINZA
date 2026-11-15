import { Link, useLoaderData } from "react-router";
import { ClipboardList } from "lucide-react";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { PROJECT_STATUS, categoryLabel } from "@fashinza/shared/labels.js";
import { formatDate, formatNumber } from "@fashinza/shared/format.js";
import { cn } from "@fashinza/shared/utils.js";

/**
 * /admin/projects — every brand's projects, read-only (gate: user ADMIN). Each row opens the project page, which
 * administrators can see in full. GET /api/admin/projects.
 */

const VIEWS = [
  { value: "ACTIVE", label: "Open" },
  { value: "DRAFT", label: "Drafts" },
  { value: "QUOTING", label: "Receiving quotes" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];
const CLOSED = ["DRAFT", "DELIVERED", "CANCELLED"];

export async function loader({ request }) {
  const sp = searchOf(request);
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in PROJECT_STATUS) ? sp.status : undefined;
  const data = await loadData("/api/admin/projects", { request, query: { status, q: sp.q, page: Number(sp.page) || 1 } });
  return { data, sp, status };
}

export default function AdminProjectsPage() {
  const { data, sp, status } = useLoaderData();
  const counts = data.counts ?? {};
  const all = Object.values(counts).reduce((s, n) => s + n, 0);
  const open = Object.entries(counts)
    .filter(([k]) => !CLOSED.includes(k))
    .reduce((s, [, n]) => s + n, 0);
  const views = status && !VIEWS.some((v) => v.value === status) ? [...VIEWS, { value: status, label: PROJECT_STATUS[status].label }] : VIEWS;
  const filtered = !!(sp.q || status);
  const brandName = (p) => p.brand?.companyName ?? p.brand?.name ?? "Unknown brand";

  return (
    <>
      <PageMeta title="All projects" />
      <PageHeader
        eyebrow="Administration"
        title="All projects"
        description="Every brand's production projects, from draft to delivery. Open a project to see its brief, matches, quotations and files."
      />
      <StatusTabs
        basePath="/admin/projects"
        label="Project status"
        value={status}
        allLabel="All"
        allCount={all}
        params={{ q: sp.q }}
        options={views.map((v) => ({ ...v, count: v.value === "ACTIVE" ? open : (counts[v.value] ?? 0) }))}
      />
      <FilterBar basePath="/admin/projects" q={sp.q} searchLabel="Search projects or brands" hidden={{ status }} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "No projects match these filters" : "No projects yet"}
          description={filtered ? "Try a different search or another tab." : "Projects appear here as soon as a brand saves its first draft."}
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link to="/admin/projects">Show all projects</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            label="Projects"
            cards={
              <MobileCardList>
                {data.items.map((p) => (
                  <MobileCard
                    key={p.id}
                    href={`/projects/${p.id}`}
                    title={p.name}
                    badge={<StatusBadge map={PROJECT_STATUS} value={p.status} />}
                    meta={
                      <>
                        {brandName(p)} · {categoryLabel(p.category)}
                        <span className="block">
                          {p.quantity ? `${formatNumber(p.quantity)} units` : "Quantity not set"} · updated {formatDate(p.updatedAt)}
                          {p.order ? ` · ${p.order.reference}` : ""}
                        </span>
                      </>
                    }
                  />
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Brand</th>
                  <th scope="col">Status · order</th>
                  <th scope="col" className="num">
                    Quantity
                  </th>
                  <th scope="col">Delivery</th>
                  <th scope="col" className="num">
                    Matches
                  </th>
                  <th scope="col" className="num">
                    Open quotes
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-60">
                      <Link to={`/projects/${p.id}`} className="cell-primary block truncate">
                        {p.name}
                      </Link>
                      <p className="truncate text-xs leading-5 text-ink-muted">
                        {categoryLabel(p.category)} · updated {formatDate(p.updatedAt)}
                      </p>
                    </td>
                    <td className="max-w-48 text-[13px]">
                      {p.brand ? (
                        <Link to={`/admin/brands/${p.brand.id}`} className="block truncate rounded-sm text-ink underline-offset-4 hover:underline">
                          {brandName(p)}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">{brandName(p)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge map={PROJECT_STATUS} value={p.status} />
                      {p.order && (
                        <Link
                          to={`/orders/${p.order.id}`}
                          className="tabular mt-1 block w-fit rounded-sm text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline"
                        >
                          <span className="sr-only">Order </span>
                          {p.order.reference}
                        </Link>
                      )}
                    </td>
                    <td className="num">{p.quantity ? formatNumber(p.quantity) : "—"}</td>
                    <td className="tabular whitespace-nowrap">{formatDate(p.deadline)}</td>
                    <td className={cn("num", !p._count.matchResults && "text-ink-muted")}>{p._count.matchResults}</td>
                    <td className={cn("num", !p._count.quotations && "text-ink-muted")}>{p._count.quotations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/projects" params={{ q: sp.q, status }} />
        </>
      )}
    </>
  );
}
