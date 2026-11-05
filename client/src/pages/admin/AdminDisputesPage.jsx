import { Link, useLoaderData } from "react-router";
import { ShieldCheck } from "lucide-react";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ROLE_LABEL } from "@fashinza/shared/labels.js";
import { formatDate } from "@fashinza/shared/format.js";

/** /admin/disputes — port of src/app/(app)/admin/disputes/page.tsx (gate: user ADMIN). */

export async function loader({ request }) {
  const sp = searchOf(request);
  const status = sp.status && sp.status in DISPUTE_STATUS ? sp.status : undefined;
  const data = await loadData("/api/disputes", { request, query: { status, page: Number(sp.page) || 1, pageSize: 20 } });
  return { data, status };
}

export default function AdminDisputesPage() {
  const { data, status } = useLoaderData();
  const subjectOf = (d) => (d.order ? d.order.reference : (d.project?.name ?? "—"));

  return (
    <>
      <PageMeta title="Disputes" />
      <PageHeader
        eyebrow="Administration"
        title="Disputes"
        description="Investigate with the order's milestones, QC reports, payments and messages, then record a resolution."
      />
      <StatusTabs
        basePath="/admin/disputes"
        label="Dispute status"
        value={status}
        options={Object.entries(DISPUTE_STATUS).map(([value, s]) => ({ value, label: s.label }))}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={status ? `No ${DISPUTE_STATUS[status].label.toLowerCase()} disputes` : "No disputes"}
          description="Disputes raised by brands or factories appear here."
          action={
            status ? (
              <Button asChild variant="outline">
                <Link to="/admin/disputes">Show all disputes</Link>
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
                        {DISPUTE_CATEGORY[d.category]} · <span className="tabular">{subjectOf(d)}</span> · {d.reporter.name} ({ROLE_LABEL[d.reporter.role]}) ·{" "}
                        {formatDate(d.createdAt)}
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
                      <Link to={`/disputes/${d.id}`} className="cell-primary rounded-sm">
                        {d.subject}
                      </Link>
                    </td>
                    <td className="text-[13px]">{DISPUTE_CATEGORY[d.category]}</td>
                    <td className="text-[13px]">
                      {d.order ? (
                        <Link to={`/orders/${d.order.id}`} className="tabular rounded-sm text-ink underline-offset-4 hover:underline">
                          {d.order.reference}
                        </Link>
                      ) : (
                        (d.project?.name ?? <span className="text-ink-muted">—</span>)
                      )}
                    </td>
                    <td className="text-[13px]">
                      {d.reporter.name}
                      <p className="text-xs text-ink-muted">{ROLE_LABEL[d.reporter.role]}</p>
                    </td>
                    <td className="tabular whitespace-nowrap text-[13px] text-ink-muted">{formatDate(d.createdAt)}</td>
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
