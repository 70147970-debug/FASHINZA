import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { requireOnboardedUser } from "@/server/auth/session";
import { listProjects } from "@/server/services/projects";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PROJECT_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; deleted?: string }> }) {
  const actor = await requireOnboardedUser(["BRAND", "ADMIN"]);
  const sp = await searchParams;
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in PROJECT_STATUS) ? (sp.status as ProjectStatus | "ACTIVE") : undefined;
  const data = await listProjects(actor, { q: sp.q, status, page: Number(sp.page) || 1 });
  const filtered = !!(sp.q || status);
  const href = (p: (typeof data.items)[number]) => (p.status === "DRAFT" ? `/projects/${p.id}/edit` : p.order ? `/orders/${p.order.id}` : `/projects/${p.id}`);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every production brief, from draft to delivery."
        actions={actor.role === "BRAND" && <Button asChild variant="accent"><Link href="/projects/new"><Plus /> Create production project</Link></Button>}
      />
      {sp.deleted && <Alert tone="success" className="mb-4">The draft was deleted.</Alert>}
      <FilterBar
        basePath="/projects"
        q={sp.q}
        searchLabel="Search by project name"
        selects={[{ name: "status", label: "Status", value: status, options: [{ value: "ACTIVE", label: "All open" }, ...Object.entries(PROJECT_STATUS).map(([value, s]) => ({ value, label: s.label }))] }]}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "No projects match these filters" : "No projects yet"}
          description={filtered ? "Try a different search or clear the filters." : "Create a production project to describe what you want made. You can save it as a draft and finish it later."}
          action={filtered ? <Button asChild variant="outline"><Link href="/projects">Clear filters</Link></Button> : <Button asChild variant="accent"><Link href="/projects/new"><Plus /> Create production project</Link></Button>}
        />
      ) : (
        <>
          {/* Cards on phones */}
          <ul className="space-y-3 md:hidden">
            {data.items.map((p) => (
              <li key={p.id}>
                <Link href={href(p)} className="block rounded-lg border border-line bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-navy">{p.name}</span>
                    <StatusBadge map={PROJECT_STATUS} value={p.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {categoryLabel(p.category)} · {p.quantity ? `${formatNumber(p.quantity)} units` : "Quantity not set"} · due {formatDate(p.deadline)}
                  </p>
                  {(p._count.quotations > 0 || p._count.matchResults > 0) && (
                    <p className="mt-1 text-xs text-muted">{p._count.matchResults} matched · {p._count.quotations} open quote{p._count.quotations === 1 ? "" : "s"}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {/* Table from tablet up */}
          <div className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Project</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Quantity</th>
                  <th scope="col" className="px-4 py-3 font-medium">Delivery</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Matches</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Open quotes</th>
                  <th scope="col" className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-canvas">
                    <td className="px-4 py-3">
                      <Link href={href(p)} className="font-medium text-navy hover:underline">{p.name}</Link>
                      <p className="text-xs text-muted">{categoryLabel(p.category)}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge map={PROJECT_STATUS} value={p.status} /></td>
                    <td className="tabular px-4 py-3 text-right">{formatNumber(p.quantity)}</td>
                    <td className="px-4 py-3">{formatDate(p.deadline)}</td>
                    <td className="tabular px-4 py-3 text-right">{p._count.matchResults}</td>
                    <td className="tabular px-4 py-3 text-right">{p._count.quotations}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/projects" params={{ q: sp.q, status }} />
        </>
      )}
    </>
  );
}
