import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, PackageSearch, X } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/server/auth/session";
import { listOrders, refreshDelays } from "@/server/services/orders";
import { EmptyState, PageHeader, Pagination } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { OrderTable } from "@/components/orders/order-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Order monitoring" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; delayed?: string; page?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  await refreshDelays();
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in ORDER_STATUS) ? (sp.status as OrderStatus | "ACTIVE") : undefined;
  const delayed = sp.delayed === "1";
  const data = await listOrders(actor, { q: sp.q, status, delayed, page: Number(sp.page) || 1, pageSize: 20 });
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Order monitoring"
        meta={delayed ? <Badge tone="danger" dot>Delayed only</Badge> : undefined}
        description="All orders on the platform. Delays are flagged when a stage passes its planned end date or an order passes its agreed date."
        actions={
          delayed ? (
            <Button asChild variant="outline">
              <Link href={sp.status ? `/admin/orders?status=${encodeURIComponent(sp.status)}` : "/admin/orders"}>
                <X /> Clear delayed filter
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/admin/orders?delayed=1">
                <AlertTriangle /> Show delayed orders
              </Link>
            </Button>
          )
        }
      />
      <FilterBar
        basePath="/admin/orders"
        q={sp.q}
        searchLabel="Search by reference or project"
        hidden={{ delayed: delayed ? "1" : undefined }}
        selects={[{ name: "status", label: "Status", value: status, options: [{ value: "ACTIVE", label: "All active" }, ...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label }))] }]}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders match"
          description={delayed ? "No orders are running late right now." : "Orders appear when brands accept quotations."}
          action={sp.q || status || delayed ? <Button asChild variant="outline"><Link href="/admin/orders">Show all orders</Link></Button> : undefined}
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
