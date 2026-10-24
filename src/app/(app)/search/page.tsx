import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/session";
import { listProjects } from "@/server/services/projects";
import { listOrders } from "@/server/services/orders";
import { listOpportunities } from "@/server/services/opportunities";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/app/primitives";
import { ORDER_STATUS, PROJECT_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Search" };

/** Searches only what the signed-in user can already access (the services apply tenant scoping). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireOnboardedUser();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  if (!q) return <PageHeader title="Search" description="Type a project name or order reference in the search box above." />;

  const [projects, orders, opportunities] = await Promise.all([
    actor.role === "MANUFACTURER" ? null : listProjects(actor, { q, pageSize: 10 }),
    listOrders(actor, { q, pageSize: 10 }),
    actor.role === "MANUFACTURER" ? listOpportunities(actor, { q, filter: "all" }) : null,
  ]);
  const total = (projects?.total ?? 0) + orders.total + (opportunities?.total ?? 0);
  const orderHref = (id: string) => `/orders/${id}`;

  return (
    <>
      <PageHeader title={`Results for “${q}”`} description={`${total} result${total === 1 ? "" : "s"}`} />
      {total === 0 ? (
        <EmptyState icon={SearchX} title="Nothing found" description="Try part of a project name or an order reference such as FZ-2026-…" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {projects && projects.total > 0 && (
            <Panel title="Projects" bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {projects.items.map((p) => (
                  <li key={p.id}><Link href={p.status === "DRAFT" ? `/projects/${p.id}/edit` : `/projects/${p.id}`} className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-canvas"><span className="truncate text-sm font-medium text-navy">{p.name}</span><StatusBadge map={PROJECT_STATUS} value={p.status} /></Link></li>
                ))}
              </ul>
            </Panel>
          )}
          {opportunities && opportunities.total > 0 && (
            <Panel title="Opportunities" bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {opportunities.items.map((m) => (
                  <li key={m.id}><Link href={`/opportunities/${m.project.id}`} className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-canvas"><span className="truncate text-sm font-medium text-navy">{m.project.name}</span><StatusBadge map={PROJECT_STATUS} value={m.project.status} /></Link></li>
                ))}
              </ul>
            </Panel>
          )}
          {orders.total > 0 && (
            <Panel title="Orders" bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {orders.items.map((o) => (
                  <li key={o.id}><Link href={orderHref(o.id)} className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-canvas"><span className="min-w-0 truncate text-sm"><span className="font-medium text-navy">{o.project.name}</span> <span className="text-muted">· {o.reference}</span></span><StatusBadge map={ORDER_STATUS} value={o.status} /></Link></li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
