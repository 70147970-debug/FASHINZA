import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageSearch } from "lucide-react";
import type { OrderStatus } from "@/generated/prisma/enums";
import { requireOnboardedUser } from "@/server/auth/session";
import { listOrders, refreshDelays } from "@/server/services/orders";
import { EmptyState, PageHeader, Pagination } from "@/components/app/primitives";
import { FilterBar } from "@/components/app/filter-bar";
import { OrderTable } from "@/components/orders/order-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Orders" };

const ATTENTION: Record<string, string> = { samples: "Samples awaiting your review", qc: "QC reports awaiting your decision" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; delayed?: string; attention?: string; page?: string }> }) {
  const actor = await requireOnboardedUser();
  if (actor.role === "ADMIN") redirect("/admin/orders");
  const sp = await searchParams;
  await refreshDelays();
  const status = sp.status && (sp.status === "ACTIVE" || sp.status in ORDER_STATUS) ? (sp.status as OrderStatus | "ACTIVE") : undefined;
  const attention = sp.attention === "samples" || sp.attention === "qc" ? sp.attention : undefined;
  const delayed = sp.delayed === "1";
  const data = await listOrders(actor, { q: sp.q, status, delayed, attention, page: Number(sp.page) || 1 });
  const filtered = !!(sp.q || status || delayed || attention);

  return (
    <>
      <PageHeader
        title="Orders"
        meta={
          delayed || attention ? (
            <>
              {delayed && <Badge tone="danger" dot>Delayed only</Badge>}
              {attention && <Badge tone="warning" dot>{ATTENTION[attention]}</Badge>}
            </>
          ) : undefined
        }
        description={actor.role === "BRAND" ? "Production orders created from accepted quotations." : "Orders your factory is producing."}
      />
      <FilterBar
        basePath="/orders"
        q={sp.q}
        searchLabel="Search by reference or project"
        hidden={{ delayed: delayed ? "1" : undefined, attention }}
        selects={[{ name: "status", label: "Status", value: status, options: [{ value: "ACTIVE", label: "All active" }, ...Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label }))] }]}
      />
      {data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={filtered ? "No orders match these filters" : "No orders yet"}
          description={filtered ? "Nothing needs attention here right now." : actor.role === "BRAND" ? "An order is created when you accept a quotation on one of your projects." : "An order is created when a brand accepts one of your quotations."}
          action={filtered ? <Button asChild variant="outline"><Link href="/orders">Show all orders</Link></Button> : <Button asChild variant="accent"><Link href={actor.role === "BRAND" ? "/projects" : "/opportunities"}>{actor.role === "BRAND" ? "Go to projects" : "View opportunities"}</Link></Button>}
        />
      ) : (
        <>
          <OrderTable items={data.items} counterpart={actor.role === "BRAND" ? "factory" : "brand"} />
          <Pagination page={data.page} pages={data.pages} total={data.total} basePath="/orders" params={{ q: sp.q, status, delayed: delayed ? "1" : undefined, attention }} />
        </>
      )}
    </>
  );
}
