import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { requireOnboardedUser } from "@/server/auth/session";
import { listProjects } from "@/server/services/projects";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusTabs } from "@/components/orders/order-parts";
import { ProjectProgress } from "@/components/projects/project-progress";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PROJECT_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

/**
 * Status views (the list's only status filter). "Open" covers every status between submission and delivery,
 * so each project is reachable from a tab; older links with another single status still filter and get a tab.
 */
const VIEWS: { value: string; label: string }[] = [
  { value: "ACTIVE", label: "Open" },
  { value: "DRAFT", label: "Drafts" },
  { value: "QUOTING", label: "Receiving quotes" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

type Row = Awaited<ReturnType<typeof listProjects>>["items"][number];

/** Delivery column: closed projects show what happened instead of a deadline that now reads as "due". */
function deliveryText(p: Row) {
  const deliveredAt = p.order?.deliveredAt;
  if (p.status === "DELIVERED") return deliveredAt ? `Delivered ${formatDate(deliveredAt)}` : "Delivered";
  if (p.status === "CANCELLED") return "Cancelled";
  return null;
}

const lowerFirst = (s: string | null) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : null);

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; deleted?: string }> }) {
  const actor = await requireOnboardedUser(["BRAND", "ADMIN"]);
  const sp = await searchParams;
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in PROJECT_STATUS) ? (sp.status as ProjectStatus | "ACTIVE") : undefined;
  const data = await listProjects(actor, { q: sp.q, status, page: Number(sp.page) || 1 });
  const filtered = !!(sp.q || status);
  const href = (p: (typeof data.items)[number]) => (p.status === "DRAFT" ? `/projects/${p.id}/edit` : p.order ? `/orders/${p.order.id}` : `/projects/${p.id}`);
  const views = status && !VIEWS.some((v) => v.value === status) ? [...VIEWS, { value: status, label: PROJECT_STATUS[status].label }] : VIEWS;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every production brief, from draft to delivery."
        actions={actor.role === "BRAND" && <Button asChild variant="accent"><Link href="/projects/new"><Plus /> Create production project</Link></Button>}
      />
      {sp.deleted && <Alert tone="success" className="mb-4">The draft was deleted.</Alert>}

      <StatusTabs basePath="/projects" label="Project views" value={status} options={views} params={{ q: sp.q }} />
      <FilterBar basePath="/projects" q={sp.q} searchLabel="Search by project name" hidden={{ status }} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "No projects match these filters" : "No projects yet"}
          description={filtered ? "Try a different search or clear the filters." : "Create a production project to describe what you want made. You can save it as a draft and finish it later."}
          action={filtered ? <Button asChild variant="outline"><Link href="/projects">Show all projects</Link></Button> : actor.role === "BRAND" && <Button asChild variant="accent"><Link href="/projects/new"><Plus /> Create production project</Link></Button>}
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
                        {categoryLabel(p.category)} · {p.quantity ? `${formatNumber(p.quantity)} units` : "Quantity not set"} · {lowerFirst(deliveryText(p)) ?? `due ${formatDate(p.deadline)}`}
                        {(p._count.quotations > 0 || p._count.matchResults > 0) && (
                          <span className="block">{p._count.matchResults} matched · {p._count.quotations} open quote{p._count.quotations === 1 ? "" : "s"}</span>
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
                  <th scope="col" className="w-40">Progress</th>
                  <th scope="col" className="num">Quantity</th>
                  <th scope="col">Delivery</th>
                  <th scope="col" className="num">Matches</th>
                  <th scope="col" className="num">Open quotes</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-72">
                      <Link href={href(p)} className="cell-primary block truncate">{p.name}</Link>
                      <p className="text-xs leading-5 text-ink-muted">{categoryLabel(p.category)}</p>
                    </td>
                    <td><StatusBadge map={PROJECT_STATUS} value={p.status} /></td>
                    <td><ProjectProgress status={p.status} /></td>
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
