import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, FileSearch, PackageSearch, Search, SearchX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { listProjects } from "@/server/services/projects";
import { listOrders } from "@/server/services/orders";
import { listOpportunities } from "@/server/services/opportunities";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { ORDER_STATUS, PROJECT_STATUS, categoryLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Search" };

type Hit = { id: string; href: string; title: string; meta: string; badge: React.ReactNode };

/** Searches only what the signed-in user can already access (the services apply tenant scoping). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireOnboardedUser();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  if (!q) {
    return (
      <>
        <PageHeader title="Search" description="Type a project name or order reference in the search box above." />
        <EmptyState icon={Search} title="Search your workspace" description="Press / anywhere to jump to the search box. Results only include records you can open." />
      </>
    );
  }

  const [projects, orders, opportunities] = await Promise.all([
    actor.role === "MANUFACTURER" ? null : listProjects(actor, { q, pageSize: 10 }),
    listOrders(actor, { q, pageSize: 10 }),
    actor.role === "MANUFACTURER" ? listOpportunities(actor, { q, filter: "all" }) : null,
  ]);
  const total = (projects?.total ?? 0) + orders.total + (opportunities?.total ?? 0);

  const groups: { key: string; title: string; icon: LucideIcon; total: number; hits: Hit[] }[] = [];
  if (projects && projects.total > 0) {
    groups.push({
      key: "projects", title: "Projects", icon: ClipboardList, total: projects.total,
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
      key: "opportunities", title: "Opportunities", icon: FileSearch, total: opportunities.total,
      hits: opportunities.items.map((m) => ({
        id: m.id,
        href: `/opportunities/${m.project.id}`,
        title: m.project.name,
        meta: categoryLabel(m.project.category),
        badge: <StatusBadge map={PROJECT_STATUS} value={m.project.status} />,
      })),
    });
  }
  if (orders.total > 0) {
    groups.push({
      key: "orders", title: "Orders", icon: PackageSearch, total: orders.total,
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
      <PageHeader eyebrow="Search" title={`Results for “${q}”`} description={`${total} result${total === 1 ? "" : "s"}`} />
      {total === 0 ? (
        <EmptyState icon={SearchX} title="Nothing found" description="Try part of a project name or an order reference such as FZ-2026-…" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {groups.map((g) => (
            <Panel
              key={g.key}
              title={g.title}
              actions={
                <span className="tabular text-xs text-muted">
                  {g.hits.length < g.total ? `Showing ${g.hits.length} of ${g.total}` : `${g.total} found`}
                </span>
              }
              bodyClassName="p-0 sm:p-0"
            >
              <ul className="divide-y divide-line-subtle">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link href={h.href} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-muted sm:px-5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-muted text-neutral-500">
                        <g.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-navy">{h.title}</span>
                        <span className="block truncate text-xs leading-5 text-muted">{h.meta}</span>
                      </span>
                      <span className="shrink-0">{h.badge}</span>
                      <ChevronRight className="size-4 shrink-0 text-subtle transition-colors duration-150 group-hover:text-navy max-sm:hidden" aria-hidden />
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
