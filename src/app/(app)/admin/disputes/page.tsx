import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { IssueStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/server/auth/session";
import { listDisputes } from "@/server/services/disputes";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ROLE_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Disputes" };

export default async function AdminDisputesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const status = sp.status && sp.status in DISPUTE_STATUS ? (sp.status as IssueStatus) : undefined;
  const data = await listDisputes(actor, { status, page: Number(sp.page) || 1, pageSize: 20 });
  const subjectOf = (d: (typeof data.items)[number]) => (d.order ? d.order.reference : (d.project?.name ?? "—"));

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Disputes"
        description="Investigate with the order's milestones, QC reports, payments and messages, then record a resolution."
      />
      <StatusTabs basePath="/admin/disputes" label="Dispute status" value={status} options={Object.entries(DISPUTE_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={status ? `No ${DISPUTE_STATUS[status].label.toLowerCase()} disputes` : "No disputes"}
          description="Disputes raised by brands or factories appear here."
          action={
            status ? (
              <Button asChild variant="outline">
                <Link href="/admin/disputes">Show all disputes</Link>
              </Button>
            ) : undefined
          }
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
                    meta={
                      <>
                        {DISPUTE_CATEGORY[d.category]} · <span className="tabular">{subjectOf(d)}</span> · {d.reporter.name} ({ROLE_LABEL[d.reporter.role]}) · {formatDate(d.createdAt)}
                      </>
                    }
                  />
                ))}
              </MobileCardList>
            }
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Category</th>
                  <th scope="col">Order / project</th>
                  <th scope="col">Raised by</th>
                  <th scope="col">Opened</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((d) => (
                  <tr key={d.id}>
                    <td className="max-w-80">
                      <Link href={`/disputes/${d.id}`} className="cell-primary rounded-sm">
                        {d.subject}
                      </Link>
                    </td>
                    <td className="text-[13px]">{DISPUTE_CATEGORY[d.category]}</td>
                    <td className="text-[13px]">
                      {d.order ? (
                        <Link href={`/orders/${d.order.id}`} className="tabular rounded-sm text-navy underline-offset-4 hover:underline">
                          {d.order.reference}
                        </Link>
                      ) : (
                        (d.project?.name ?? <span className="text-muted">—</span>)
                      )}
                    </td>
                    <td className="text-[13px]">
                      {d.reporter.name}
                      <p className="text-xs text-muted">{ROLE_LABEL[d.reporter.role]}</p>
                    </td>
                    <td className="tabular whitespace-nowrap text-[13px] text-muted">{formatDate(d.createdAt)}</td>
                    <td>
                      <StatusBadge map={DISPUTE_STATUS} value={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/disputes" params={{ status }} />
        </>
      )}
    </>
  );
}
