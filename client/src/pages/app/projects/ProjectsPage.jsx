import { Link, useLoaderData } from "react-router";
import { ClipboardList, Plus } from "lucide-react";
import { loadJson } from "@/lib/api";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusTabs } from "@/components/orders/order-parts";
import { ProjectProgress } from "@/components/projects/project-progress";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PROJECT_STATUS, categoryLabel } from "@fashinza/shared/labels.js";
import { formatDate, formatNumber } from "@fashinza/shared/format.js";
import { cn } from "@fashinza/shared/utils.js";
import { PageMeta } from "@/components/meta";

/**
 * Status views (the list's only status filter). "Open" covers every status between submission and delivery,
 * so each project is reachable from a tab; older links with another single status still filter and get a tab.
 */
const VIEWS = [
  { value: "ACTIVE", label: "Open" },
  { value: "DRAFT", label: "Drafts" },
  { value: "QUOTING", label: "Receiving quotes" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

/** Delivery column: closed projects show what happened instead of a deadline that now reads as "due". */
function deliveryText(p) {
  const deliveredAt = p.order?.deliveredAt;
  if (p.status === "DELIVERED") return deliveredAt ? `Delivered ${formatDate(deliveredAt)}` : "Delivered";
  if (p.status === "CANCELLED") return "Cancelled";
  return null;
}

const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : null);

/** GET /api/projects (listProjects: q, status view, page). */
export async function loader({ request, user }) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in PROJECT_STATUS) ? sp.status : undefined;
  const data = await loadJson("/api/projects", { request, query: { q: sp.q, status, page: Number(sp.page) || 1 } });
  return { actor: { role: user.role }, sp, status, data };
}

export default function ProjectsPage() {
  const { actor, sp, status, data } = useLoaderData();
  const filtered = !!(sp.q || status);
  const href = (p) => (p.status === "DRAFT" ? `/projects/${p.id}/edit` : p.order ? `/orders/${p.order.id}` : `/projects/${p.id}`);
  const views = status && !VIEWS.some((v) => v.value === status) ? [...VIEWS, { value: status, label: PROJECT_STATUS[status].label }] : VIEWS;

  return (
    <>
      <PageMeta title="Projects" />
      <PageHeader
        title="Projects"
        description="Every production brief, from draft to delivery."
        actions={
          actor.role === "BRAND" && (
            <Button asChild variant="accent">
              <Link to="/projects/new">
                <Plus /> Create production project
              </Link>
            </Button>
          )
        }
      />
      {sp.deleted && (
        <Alert tone="success" className="mb-4">
          The draft was deleted.
        </Alert>
      )}

      <StatusTabs basePath="/projects" label="Project views" value={status} options={views} params={{ q: sp.q }} />
      <FilterBar basePath="/projects" q={sp.q} searchLabel="Search by project name" hidden={{ status }} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "No projects match these filters" : "No projects yet"}
          description={
            filtered
              ? "Try a different search or clear the filters."
              : "Create a production project to describe what you want made. You can save it as a draft and finish it later."
          }
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link to="/projects">Show all projects</Link>
              </Button>
            ) : (
              actor.role === "BRAND" && (
                <Button asChild variant="accent">
                  <Link to="/projects/new">
                    <Plus /> Create production project
                  </Link>
                </Button>
              )
            )
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
                    href={href(p)}
                    title={p.name}
                    badge={<StatusBadge map={PROJECT_STATUS} value={p.status} />}
                    meta={
                      <>
                        {categoryLabel(p.category)} · {p.quantity ? `${formatNumber(p.quantity)} units` : "Quantity not set"} ·{" "}
                        {lowerFirst(deliveryText(p)) ?? `due ${formatDate(p.deadline)}`}
                        {(p._count.quotations > 0 || p._count.matchResults > 0) && (
                          <span className="block">
                            {p._count.matchResults} matched · {p._count.quotations} open quote{p._count.quotations === 1 ? "" : "s"}
                          </span>
                        )}
                      </>
                    }
                  >
                    <ProjectProgress status={p.status} />
                  </MobileCard>
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="w-40">
                    Progress
                  </th>
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
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-72">
                      <Link to={href(p)} className="cell-primary block truncate">
                        {p.name}
                      </Link>
                      <p className="text-xs leading-5 text-ink-muted">{categoryLabel(p.category)}</p>
                    </td>
                    <td>
                      <StatusBadge map={PROJECT_STATUS} value={p.status} />
                    </td>
                    <td>
                      <ProjectProgress status={p.status} />
                    </td>
                    <td className="num">{formatNumber(p.quantity)}</td>
                    <td className={cn("tabular whitespace-nowrap", deliveryText(p) && "text-ink-muted")}>{deliveryText(p) ?? formatDate(p.deadline)}</td>
                    <td className={cn("num", !p._count.matchResults && "text-ink-muted")}>{p._count.matchResults}</td>
                    <td className={cn("num", p._count.quotations ? "font-semibold text-warning-strong" : "text-ink-muted")}>{p._count.quotations}</td>
                    <td className="tabular whitespace-nowrap text-ink-muted">{formatDate(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/projects" params={{ q: sp.q, status }} />
        </>
      )}
    </>
  );
}
