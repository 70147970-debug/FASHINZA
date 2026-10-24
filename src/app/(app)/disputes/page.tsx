import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { IssueStatus } from "@/generated/prisma/enums";
import { requireOnboardedUser } from "@/server/auth/session";
import { listDisputes } from "@/server/services/disputes";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { DISPUTE_CATEGORY, DISPUTE_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Disputes" };

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireOnboardedUser();
  if (actor.role === "ADMIN") redirect("/admin/disputes");
  const sp = await searchParams;
  const status = sp.status && sp.status in DISPUTE_STATUS ? (sp.status as IssueStatus) : undefined;
  const data = await listDisputes(actor, { status, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Disputes" description="Disputes you raised or that concern your orders. Raise a new one from the order page." />
      <FilterBar basePath="/disputes" selects={[{ name: "status", label: "Status", value: status, options: Object.entries(DISPUTE_STATUS).map(([value, s]) => ({ value, label: s.label })) }]} />
      {data.items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No disputes" description="If something goes wrong with quality, delivery or payment on an order, use “Raise a dispute” on that order. The Fashinza team reviews it with the full order history." />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((d) => (
              <li key={d.id}>
                <Link href={`/disputes/${d.id}`} className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4 shadow-card hover:border-slate-blue/40 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-navy">{d.subject}</p>
                    <p className="text-xs text-muted">{DISPUTE_CATEGORY[d.category]} · {d.order ? d.order.reference : d.project?.name} · opened {formatDate(d.createdAt)} by {d.reporter.name}</p>
                  </div>
                  <StatusBadge map={DISPUTE_STATUS} value={d.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/disputes" params={{ status }} />
        </>
      )}
    </>
  );
}
