import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatKes } from "@/lib/money";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { loadOrderForViewer } from "@/server/queries/orders";
import { SellerFulfilmentActions } from "@/components/orders/order-actions";
import { OrderItems, OrderStatusBadge, OrderTimeline } from "@/components/orders/order-summary";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default function SellerOrderPage({ params }: PageProps<"/sell/orders/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Order params={params} />
    </Suspense>
  );
}

async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/sell/orders/${id}`);
  const order = await loadOrderForViewer(user, id);
  // Only the selling shop manages fulfilment here (staff use the admin area).
  if (!order || order.sellerId !== user.sellerProfileId || order.status === "PENDING_PAYMENT") notFound();
  const payoutLabel = {
    PENDING: "Waiting for your M-Pesa details",
    PROCESSING: "Sending to M-Pesa",
    PAID: "Paid",
    FAILED: "Failed",
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Order {order.number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-muted text-sm">Buyer: {order.buyer?.name}</p>
      {order.status === "PAID_HELD" && <SellerFulfilmentActions orderId={order.id} canShip canCancel />}
      {order.payout && (
        <p className="border-border rounded-lg border p-4" data-testid="payout-status">
          Payout {formatKes(order.payout.amountMinor)}: {payoutLabel[order.payout.status]}
          {order.payout.status === "PENDING" && (
            <>
              {" "}
              <Link href="/sell/payouts" className="text-brand underline-offset-4 hover:underline">
                Add your M-Pesa number
              </Link>
            </>
          )}
          {order.payout.failureReason && ` (${order.payout.failureReason})`}
        </p>
      )}
      <OrderItems order={order} perspective="seller" />
      <OrderTimeline order={order} />
      <Link
        href={`/account/orders/${order.id}/receipt`}
        className="text-brand font-medium underline-offset-4 hover:underline"
      >
        View invoice
      </Link>
    </div>
  );
}
