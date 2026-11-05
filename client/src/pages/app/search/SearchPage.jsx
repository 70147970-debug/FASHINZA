import { Link, useLoaderData } from "react-router";
import { ChevronRight, ClipboardList, FileSearch, PackageSearch, Search, SearchX } from "lucide-react";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { ORDER_STATUS, PROJECT_STATUS, categoryLabel } from "@fashinza/shared/labels.js";

/**
 * /search — port of src/app/(app)/search/page.tsx (gate: onboarded). Searches only what the signed-in user can
 * already access (the server applies tenant scoping). An empty `q` shows the empty state without calling the API.
 */
export async function loader({ request }) {
  const q = (searchOf(request).q ?? "").trim().slice(0, 100);
  if (!q) return { q: "", projects: null, orders: null, opportunities: null, total: 0 };
  return loadData("/api/search", { request, query: { q } });
}

export default function SearchPage() {
  const { q, projects, orders, opportunities, total } = useLoaderData();
  if (!q) {
    return (
      <>
        <PageMeta title="Search" />
        <PageHeader title="Search" description="Type a project name or order reference in the search box above." />
        <EmptyState icon={Search} title="Search your workspace" description="Press / anywhere to jump to the search box. Results only include records you can open." />
      </>
    );
  }

  const groups = [];
  if (projects && projects.total > 0) {
    groups.push({
      key: "projects",
      title: "Projects",
      icon: ClipboardList,
      total: projects.total,
      hits: projects.items.map((p) => ({
        id: p.id,
        href: p.status === "DRAFT" ? `/projects/${p.id}/edit` : `/projects/${p.id}`,
        title: p.name,
        meta: categoryLabel(p.category),
        badge: <StatusBadge map={PROJECT_STATUS} value={p.status} />,
      })),
    });
  }
  if (opportunities && opportunities.total > 0) {
    groups.push({
      key: "opportunities",
      title: "Opportunities",
      icon: FileSearch,
      total: opportunities.total,
      hits: opportunities.items.map((m) => ({
        id: m.id,
        href: `/opportunities/${m.project.id}`,
        title: m.project.name,
        meta: categoryLabel(m.project.category),
        badge: <StatusBadge map={PROJECT_STATUS} value={m.project.status} />,
      })),
    });
  }
  if (orders && orders.total > 0) {
    groups.push({
      key: "orders",
      title: "Orders",
      icon: PackageSearch,
      total: orders.total,
      hits: orders.items.map((o) => ({
        id: o.id,
        href: `/orders/${o.id}`,
        title: o.project.name,
        meta: o.reference,
        badge: <StatusBadge map={ORDER_STATUS} value={o.status} />,
      })),
    });
  }

  return (
    <>
      <PageMeta title="Search" />
      <PageHeader eyebrow="Search" title={`Results for “${q}”`} description={`${total} result${total === 1 ? "" : "s"}`} />
      {total === 0 ? (
        <EmptyState icon={SearchX} title="Nothing found" description="Try part of a project name or an order reference such as FZ-2026-…" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {groups.map((g) => (
            <Panel
              key={g.key}
              title={g.title}
              actions={<span className="tabular text-xs text-ink-muted">{g.hits.length < g.total ? `Showing ${g.hits.length} of ${g.total}` : `${g.total} found`}</span>}
              bodyClassName="p-0 sm:p-0"
            >
              <ul className="divide-y divide-line-subtle">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link to={h.href} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover sm:px-5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-canvas text-ink-muted">
                        <g.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{h.title}</span>
                        <span className="block truncate text-xs leading-5 text-ink-muted">{h.meta}</span>
                      </span>
                      <span className="shrink-0">{h.badge}</span>
                      <ChevronRight className="size-4 shrink-0 text-ink-subtle transition-colors duration-150 group-hover:text-accent-strong max-sm:hidden" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
