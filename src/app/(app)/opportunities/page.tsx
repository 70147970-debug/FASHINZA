import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { listOpportunities } from "@/server/services/opportunities";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { ScoreRing } from "@/components/projects/match-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatNumber, relativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Opportunities" };

const FILTERS = [
  { value: "new", label: "New — not quoted" },
  { value: "open", label: "Open for quotes" },
  { value: "all", label: "All, including closed" },
] as const;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const sp = await searchParams;
  const filter = (["new", "open", "all"].includes(sp.filter ?? "") ? sp.filter : "open") as "new" | "open" | "all";
  const [data, profile] = await Promise.all([
    listOpportunities(actor, { filter, q: sp.q, page: Number(sp.page) || 1 }),
    db.manufacturerProfile.findUnique({ where: { userId: actor.id }, select: { verificationStatus: true } }),
  ]);
  const verified = profile?.verificationStatus === "VERIFIED";
  const viewHref = (f: string) => {
    const q = new URLSearchParams(Object.entries({ filter: f === "open" ? undefined : f, q: sp.q }).filter(([, x]) => x) as [string, string][]);
    return q.size ? `/opportunities?${q}` : "/opportunities";
  };
  const isNew = (m: (typeof data.items)[number]) => !m.project.quotations[0] && ["SUBMITTED", "QUOTING"].includes(m.project.status);
  const status = (m: (typeof data.items)[number]) => {
    const q = m.project.quotations[0];
    return q ? <StatusBadge map={QUOTATION_STATUS} value={q.status} /> : <StatusBadge map={PROJECT_STATUS} value={m.project.status} />;
  };

  return (
    <>
      <PageHeader title="Opportunities" description="Projects whose requirements your verified factory meets. Only matched factories can see these projects." />

      <nav aria-label="Opportunity views" className="-mx-4 mb-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-5">
          {FILTERS.map((f) => (
            <li key={f.value} className="shrink-0">
              <Link
                href={viewHref(f.value)}
                aria-current={filter === f.value ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 text-sm transition-colors duration-150",
                  filter === f.value ? "border-teal font-medium text-navy" : "border-transparent text-muted hover:border-line-strong hover:text-navy",
                )}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <FilterBar basePath="/opportunities" q={sp.q} searchLabel="Search by project name" hidden={{ filter: filter === "open" ? undefined : filter }} />

      {data.items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title={verified ? "No opportunities here yet" : "Get verified to receive opportunities"}
          description={
            verified
              ? "When a brand submits a project that matches your categories, capacity, lead time and certifications, it appears here and you are notified."
              : "Matching only considers verified factories. Upload your documents and request verification from your factory profile."
          }
          action={
            verified ? (
              filter !== "all" && <Button asChild variant="outline"><Link href="/opportunities?filter=all">Show closed opportunities</Link></Button>
            ) : (
              <Button asChild variant="accent"><Link href="/factory#verification">Go to verification</Link></Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            label="Opportunities"
            cards={
              <MobileCardList>
                {data.items.map((m) => (
                  <MobileCard
                    key={m.id}
                    href={`/opportunities/${m.project.id}`}
                    title={m.project.name}
                    badge={status(m)}
                    meta={`${m.project.brand.brandProfile?.companyName ?? "Brand"} · ${categoryLabel(m.project.category)} · ${formatNumber(m.project.quantity)} units · deliver by ${formatDate(m.project.deadline)}`}
                  >
                    <span className="flex items-center justify-between gap-3 text-xs text-muted">
                      <span className="tabular">Match score <span className="font-semibold text-navy">{Number(m.score).toFixed(0)}</span>/100</span>
                      {isNew(m) && <Badge tone="warning" dot>New</Badge>}
                    </span>
                  </MobileCard>
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">Quantity</th>
                  <th scope="col">Deliver by</th>
                  <th scope="col">Match</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="max-w-80">
                      <span className="flex items-center gap-2">
                        <Link href={`/opportunities/${m.project.id}`} className="cell-primary truncate">{m.project.name}</Link>
                        {isNew(m) && <Badge tone="warning">New</Badge>}
                      </span>
                      <p className="truncate text-xs leading-5 text-muted">
                        {m.project.brand.brandProfile?.companyName ?? "Brand"}{m.project.brand.brandProfile?.country ? ` · ${m.project.brand.brandProfile.country}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">{categoryLabel(m.project.category)}</td>
                    <td className="num">{formatNumber(m.project.quantity)}</td>
                    <td className="tabular whitespace-nowrap">
                      {formatDate(m.project.deadline)}
                      {m.project.deadline && ["SUBMITTED", "QUOTING"].includes(m.project.status) && <p className="text-xs text-muted">{relativeDays(m.project.deadline)}</p>}
                    </td>
                    <td><ScoreRing score={Number(m.score)} size="sm" /></td>
                    <td>{status(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/opportunities" params={{ filter, q: sp.q }} />
        </>
      )}
    </>
  );
}
