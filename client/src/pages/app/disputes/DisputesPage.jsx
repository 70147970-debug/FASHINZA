import { Link, useLoaderData } from "react-router";
import { ShieldCheck } from "lucide-react";
import { DataTable, EmptyState, MobileCard, MobileCardList, PageHeader, Pagination, StatusBadge } from "@/components/app/primitives";
import { StatusTabs } from "@/components/orders/order-parts";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { DISPUTE_CATEGORY, DISPUTE_STATUS, ROLE_LABEL } from "@fashinza/shared/labels.js";
import { formatDate } from "@fashinza/shared/format.js";

/** /disputes — port of src/app/(app)/disputes/page.tsx (gate: onboarded; ADMIN is sent to /admin/disputes by the router). */

const VIEWS = Object.entries(DISPUTE_STATUS).map(([value, s]) => ({ value, label: s.label }));

export async function loader({ request, user }) {
  const sp = searchOf(request);
  const status = sp.status && sp.status in DISPUTE_STATUS ? sp.status : undefined;
  const data = await loadData("/api/disputes", { request, query: { status, page: Number(sp.page) || 1 } });
  return { data, status, actor: user };
}

export default function DisputesPage() {
  const { data, status, actor } = useLoaderData();
  const related = (d) => (d.order ? d.order.reference : (d.project?.name ?? "—"));

  return (
    <>
      <PageMeta title="Disputes" />
      <PageHeader title="Disputes" description="Disputes you raised or that concern your orders. Raise a new one from the order page." />

      <StatusTabs basePath="/disputes" label="Dispute status" value={status} options={VIEWS} />

      {data.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={status ? `No ${DISPUTE_STATUS[status].label.toLowerCase()} disputes` : "No disputes"}
          description="If something goes wrong with quality, delivery or payment on an order, use “Raise a dispute” on that order. The Fashinza team reviews it with the full order history."
          action={
            status && (
              <Button asChild variant="outline">
                <Link to="/disputes">Show all disputes</Link>
              </Button>
            )
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
                      <Link to={`/disputes/${d.id}`} className="cell-primary block truncate">
                        {d.subject}
                      </Link>
                    </td>
                    <td>{DISPUTE_CATEGORY[d.category]}</td>
                    <td className="tabular whitespace-nowrap">
                      {d.order ? (
                        <Link to={`/orders/${d.order.id}`} className="text-accent-strong underline-offset-4 hover:underline">
                          {d.order.reference}
                        </Link>
                      ) : d.project ? (
                        <Link
                          to={`${actor.role === "MANUFACTURER" ? "/opportunities" : "/projects"}/${d.project.id}`}
                          className="text-accent-strong underline-offset-4 hover:underline"
                        >
                          {d.project.name}
                        </Link>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="block">{d.reporter.name}</span>
                      <span className="block text-xs leading-5 text-ink-muted">{ROLE_LABEL[d.reporter.role]}</span>
                    </td>
                    <td className="tabular whitespace-nowrap text-ink-muted">{formatDate(d.createdAt)}</td>
                    <td>
                      <StatusBadge map={DISPUTE_STATUS} value={d.status} />
                    </td>
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
