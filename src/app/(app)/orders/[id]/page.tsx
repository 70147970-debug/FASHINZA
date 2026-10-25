import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/server/auth/session";
import { getOrder } from "@/server/services/orders";
import { isAppError } from "@/server/errors";
import { OrderDetail } from "@/components/orders/order-detail";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; payment?: string }> }) {
  const actor = await requireOnboardedUser();
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrder(actor, id).catch((e) => {
    if (isAppError(e)) notFound();
    throw e;
  });
  return <OrderDetail order={order} actor={actor} sp={sp} />;
}
