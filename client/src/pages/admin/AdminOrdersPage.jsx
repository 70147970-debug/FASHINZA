import { Link, useLoaderData } from "react-router";
import { AlertTriangle, PackageSearch, X } from "lucide-react";
import { EmptyState, PageHeader, Pagination } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusTabs } from "@/components/orders/order-parts";
import { OrderTable } from "@/components/orders/order-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { ORDER_STATUS } from "@fashinza/shared/labels.js";

/** /admin/orders — port of src/app/(app)/admin/orders/page.tsx (gate: ADMIN). */

const VIEWS = [{ value: "ACTIVE", label: "Active" }, ...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label }))];

export async function loader({ request }) {
  const sp = searchOf(request);
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in ORDER_STATUS) ? sp.status : undefined;
  const delayed = sp.delayed === "1";
  const data = await loadData("/api/admin/orders", { request, query: { q: sp.q, status, delayed: delayed ? "1" : undefined, page: Number(sp.page) || 1 } });
  return { data, sp, status, delayed };
}

export default function AdminOrdersPage() {
  const { data, sp, status, delayed } = useLoaderData();
  const keep = new URLSearchParams(Object.entries({ q: sp.q, status }).filter((e) => !!e[1]));
  const withoutDelayed = keep.size ? `/admin/orders?${keep}` : "/admin/orders";
  return (
    <>
      <PageMeta title="Order monitoring" />
      <PageHeader
        eyebrow="Administration"
        title="Order monitoring"
        meta={
          delayed ? (
            <Badge tone="danger" dot>
              Delayed only
            </Badge>
          ) : undefined
        }
        description="All orders on the platform. Delays are flagged when a stage passes its planned end date or an order passes its agreed date."
        actions={
          delayed ? (
            <Button asChild variant="outline">
              <Link to={withoutDelayed}>
                <X /> Clear delayed filter
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/admin/orders?delayed=1">
                <AlertTriangle /> Show delayed orders
              </Link>
            </Button>
          )
        }
      />
      <StatusTabs basePath="/admin/orders" label="Order status" value={status} options={VIEWS} params={{ q: sp.q, delayed: delayed ? "1" : undefined }} />
      <FilterBar basePath="/admin/orders" q={sp.q} searchLabel="Search by reference or project" hidden={{ status, delayed: delayed ? "1" : undefined }} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders match"
          description={delayed ? "No orders are running late right now." : "Orders appear when brands accept quotations."}
          action={
            sp.q || status || delayed ? (
              <Button asChild variant="outline">
                <Link to="/admin/orders">Show all orders</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <OrderTable items={data.items} counterpart="both" />
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/admin/orders" params={{ q: sp.q, status, delayed: delayed ? "1" : undefined }} />
        </>
      )}
    </>
  );
}
