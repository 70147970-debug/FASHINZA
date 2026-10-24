import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch } from "lucide-react";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/server/auth/session";
import { listOpportunities } from "@/server/services/opportunities";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS, QUOTATION_STATUS, categoryLabel } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Opportunities" };

const FILTERS = [
  { value: "new", label: "New — not quoted" },
  { value: "open", label: "Open for quotes" },
  { value: "all", label: "All, including closed" },
];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; page?: string }> }) {
  const actor = await requireOnboardedUser(["MANUFACTURER"]);
  const sp = await searchParams;
  const filter = (["new", "open", "all"].includes(sp.filter ?? "") ? sp.filter : "open") as "new" | "open" | "all";
  const [data, profile] = await Promise.all([
    listOpportunities(actor, { filter, q: sp.q, page: Number(sp.page) || 1 }),
    db.manufacturerProfile.findUnique({ where: { userId: actor.id }, select: { verificationStatus: true } }),
  ]);
  const verified = profile?.verificationStatus === "VERIFIED";

  return (
    <>
      <PageHeader title="Opportunities" description="Projects whose requirements your verified factory meets. Only matched factories can see these projects." />
      <FilterBar basePath="/opportunities" q={sp.q} searchLabel="Search by project name" selects={[{ name: "filter", label: "Show", value: filter, options: FILTERS }]} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title={verified ? "No opportunities here yet" : "Get verified to receive opportunities"}
          description={
            verified
              ? "When a brand submits a project that matches your categories, capacity, lead time and certifications, it appears here and you are notified."
              : "Matching only considers verified factories. Upload your documents and request verification from your factory profile."
          }
          action={!verified && <Button asChild variant="accent"><Link href="/factory#verification">Go to verification</Link></Button>}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((m) => {
              const q = m.project.quotations[0];
              return (
                <li key={m.id}>
                  <Link href={`/opportunities/${m.project.id}`} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-card hover:border-slate-blue/40 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-navy">{m.project.name}</span>
                        {!q && ["SUBMITTED", "QUOTING"].includes(m.project.status) && <Badge tone="warning">New</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {m.project.brand.brandProfile?.companyName ?? "Brand"} · {categoryLabel(m.project.category)} · {formatNumber(m.project.quantity)} units · deliver by {formatDate(m.project.deadline)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      <span className="tabular text-sm"><span className="font-display text-lg font-semibold text-navy">{Number(m.score).toFixed(0)}</span><span className="text-xs text-muted">/100</span></span>
                      {q ? <StatusBadge map={QUOTATION_STATUS} value={q.status} /> : <StatusBadge map={PROJECT_STATUS} value={m.project.status} />}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/opportunities" params={{ filter, q: sp.q }} />
        </>
      )}
    </>
  );
}
