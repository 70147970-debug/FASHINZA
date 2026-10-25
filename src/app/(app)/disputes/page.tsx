import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { IssueStatus } from "@/generated/prisma/enums";
import { requireOnboardedUser } from "@/server/auth/session";
import { listDisputes } from "@/server/services/disputes";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ROLE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Disputes" };

const VIEWS: { value?: IssueStatus; label: string }[] = [
  { value: undefined, label: "All" },
  ...Object.entries(DISPUTE_STATUS).map(([value, s]) => ({ value: value as IssueStatus, label: s.label })),
];

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireOnboardedUser();
  if (actor.role === "ADMIN") redirect("/admin/disputes");
  const sp = await searchParams;
  const status = sp.status && sp.status in DISPUTE_STATUS ? (sp.status as IssueStatus) : undefined;
  const data = await listDisputes(actor, { status, page: Number(sp.page) || 1 });
  const related = (d: (typeof data.items)[number]) => (d.order ? d.order.reference : d.project?.name ?? "—");

  return (
    <>
      <PageHeader title="Disputes" description="Disputes you raised or that concern your orders. Raise a new one from the order page." />

      <nav aria-label="Dispute status" className="-mx-4 mb-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-5">
          {VIEWS.map((v) => {
            const active = status === v.value;
            return (
              <li key={v.label} className="shrink-0">
                <Link
                  href={v.value ? `/disputes?status=${v.value}` : "/disputes"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex h-10 items-center border-b-2 text-sm transition-colors duration-150",
                    active ? "border-teal font-medium text-navy" : "border-transparent text-muted hover:border-line-strong hover:text-navy",
                  )}
                >
                  {v.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {data.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={status ? `No ${DISPUTE_STATUS[status].label.toLowerCase()} disputes` : "No disputes"}
          description="If something goes wrong with quality, delivery or payment on an order, use “Raise a dispute” on that order. The Fashinza team reviews it with the full order history."
          action={status && <Button asChild variant="outline"><Link href="/disputes">Show all disputes</Link></Button>}
        />
      ) : (
        <>
          <DataTable
            label="Disputes"
            cards={
              <MobileCardList>
                {data.items.map((d) => (
                  <MobileCard
                    key={d.id}
                    href={`/disputes/${d.id}`}
                    title={d.subject}
                    badge={<StatusBadge map={DISPUTE_STATUS} value={d.status} />}
                    meta={`${DISPUTE_CATEGORY[d.category]} · ${related(d)} · opened ${formatDate(d.createdAt)} by ${d.reporter.name}`}
                  />
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Dispute</th>
                  <th scope="col">Category</th>
                  <th scope="col">Order or project</th>
                  <th scope="col">Raised by</th>
                  <th scope="col">Opened</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((d) => (
                  <tr key={d.id}>
                    <td className="max-w-80">
                      <Link href={`/disputes/${d.id}`} className="cell-primary block truncate">{d.subject}</Link>
                    </td>
                    <td>{DISPUTE_CATEGORY[d.category]}</td>
                    <td className="tabular whitespace-nowrap">
                      {d.order ? (
                        <Link href={`/orders/${d.order.id}`} className="text-teal-700 hover:underline">{d.order.reference}</Link>
                      ) : d.project ? (
                        <Link href={`${actor.role === "MANUFACTURER" ? "/opportunities" : "/projects"}/${d.project.id}`} className="text-teal-700 hover:underline">{d.project.name}</Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="block">{d.reporter.name}</span>
                      <span className="block text-xs leading-5 text-muted">{ROLE_LABEL[d.reporter.role]}</span>
                    </td>
                    <td className="tabular whitespace-nowrap text-muted">{formatDate(d.createdAt)}</td>
                    <td><StatusBadge map={DISPUTE_STATUS} value={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/disputes" params={{ status }} />
        </>
      )}
    </>
  );
}
