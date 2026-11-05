import { Link, useLoaderData } from "react-router";
import { PackageSearch } from "lucide-react";
import { EmptyState, PageHeader, Pagination } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { StatusTabs } from "@/components/orders/order-parts";
import { OrderTable } from "@/components/orders/order-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/meta";
import { loadData, searchOf } from "@/lib/data";
import { ORDER_STATUS } from "@fashinza/shared/labels.js";

/** /orders — port of src/app/(app)/orders/page.tsx (gate: onboarded; ADMIN is sent to /admin/orders by the router). */

const ATTENTION = { samples: "Samples awaiting your review", qc: "QC reports awaiting your decision" };

/** Status views: "Active" groups every open status; each status also has its own tab. */
const VIEWS = [{ value: "ACTIVE", label: "Active" }, ...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label }))];

export async function loader({ request, user }) {
  const sp = searchOf(request);
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in ORDER_STATUS) ? sp.status : undefined;
  const attention = sp.attention === "samples" || sp.attention === "qc" ? sp.attention : undefined;
  const delayed = sp.delayed === "1";
  const data = await loadData("/api/orders", {
    request,
    query: { q: sp.q, status, delayed: delayed ? "1" : undefined, attention, page: Number(sp.page) || 1 },
  });
  return { data, sp, status, attention, delayed, actor: user };
}

export default function OrdersPage() {
  const { data, sp, status, attention, delayed, actor } = useLoaderData();
  const filtered = !!(sp.q || status || delayed || attention);
  /** The status tab and search kept, the delayed / attention narrowing removed. */
  const withoutToggles = (() => {
    const q = new URLSearchParams(Object.entries({ q: sp.q, status }).filter((e) => !!e[1]));
    return q.size ? `/orders?${q}` : "/orders";
  })();

  return (
    <>
      <PageMeta title="Orders" />
      <PageHeader
        title="Orders"
        meta={
          delayed || attention ? (
            <>
              {delayed && (
                <Badge tone="danger" dot>
                  Delayed only
                </Badge>
              )}
              {attention && (
                <Badge tone="warning" dot>
                  {ATTENTION[attention]}
                </Badge>
              )}
              <Link
                to={withoutToggles}
                className="inline-flex min-h-10 items-center rounded-sm text-[13px] font-medium text-accent-strong underline-offset-4 hover:underline sm:min-h-0"
              >
                Clear filter
              </Link>
            </>
          ) : undefined
        }
        description={actor.role === "BRAND" ? "Production orders created from accepted quotations." : "Orders your factory is producing."}
      />
      <StatusTabs basePath="/orders" label="Order status" value={status} options={VIEWS} params={{ q: sp.q, delayed: delayed ? "1" : undefined, attention }} />
      <FilterBar basePath="/orders" q={sp.q} searchLabel="Search by reference or project" hidden={{ status, delayed: delayed ? "1" : undefined, attention }} />
      {data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={filtered ? "No orders match these filters" : "No orders yet"}
          description={
            delayed || attention
              ? "Nothing needs attention here right now."
              : filtered
                ? "Try another status tab or a different search."
                : actor.role === "BRAND"
                  ? "An order is created when you accept a quotation on one of your projects."
                  : "An order is created when a brand accepts one of your quotations."
          }
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link to="/orders">Show all orders</Link>
              </Button>
            ) : (
              <Button asChild variant="accent">
                <Link to={actor.role === "BRAND" ? "/projects" : "/opportunities"}>{actor.role === "BRAND" ? "Go to projects" : "View opportunities"}</Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <OrderTable items={data.items} counterpart={actor.role === "BRAND" ? "factory" : "brand"} />
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            basePath="/orders"
            params={{ q: sp.q, status, delayed: delayed ? "1" : undefined, attention }}
          />
        </>
      )}
    </>
  );
}
