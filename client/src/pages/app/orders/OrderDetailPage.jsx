import { useLoaderData, useSearchParams } from "react-router";
import { PageMeta } from "@/components/meta";
import { OrderDetail } from "@/components/orders/order-detail";
import { loadData } from "@/lib/data";

/** Static page title, also shown when the record is not found (AppErrorBoundary). */
export const handle = { title: "Order" };

/**
 * /orders/:id — port of src/app/(app)/orders/[id]/page.tsx (gate: onboarded, any role). An unknown or foreign
 * order renders the not-found card. While the order is open the page data is re-fetched every 30 s
 * (LiveRefresh), as `router.refresh()` did.
 */
export async function loader({ request, params, user }) {
  const { order } = await loadData(`/api/orders/${params.id}`, { request });
  return { order, actor: user };
}

export default function OrderDetailPage() {
  const { order, actor } = useLoaderData();
  const [searchParams] = useSearchParams();
  const sp = { created: searchParams.get("created") ?? undefined, payment: searchParams.get("payment") ?? undefined, tab: searchParams.get("tab") ?? undefined };
  return (
    <>
      <PageMeta title="Order" />
      <OrderDetail order={order} actor={actor} sp={sp} />
    </>
  );
}
