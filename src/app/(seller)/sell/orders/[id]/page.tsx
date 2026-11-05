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
import { Rating } from "@/components/ui/rating";
import { DisputePanel } from "@/components/trust/dispute-panel";
import { MessageButton } from "@/components/trust/message-seller-button";
import { ReviewReplyForm } from "@/components/trust/review-forms";

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

  const onHold = order.fraudFlags.length > 0 && !order.fraudReviewedAt;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Order {order.number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-muted text-sm">Buyer: {order.buyer?.name}</p>
      {order.status === "PAID_HELD" && <SellerFulfilmentActions orderId={order.id} canShip canCancel />}
      <DisputePanel order={order} perspective="seller" />
      {onHold && order.status !== "REFUNDED" && (
        <p className="border-border rounded-lg border p-4" role="status">
          This order is getting a routine safety check. You can still send it; your payout is released once the check is
          done, usually within a day.
        </p>
      )}
      {order.payout && (
        <p className="border-border rounded-lg border p-4" data-testid="payout-status">
          Payout {formatKes(order.payout.amountMinor)}:{" "}
          {onHold && order.payout.status === "PENDING"
            ? "On hold for a safety check"
            : payoutLabel[order.payout.status]}
          {order.payout.status === "PENDING" && !onHold && (
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
      {order.review && (
        <section aria-labelledby="buyer-review" className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <h2 id="buyer-review" className="font-semibold">
            The buyer&apos;s review
          </h2>
          <Rating value={order.review.rating} />
          {order.review.body && <p className="whitespace-pre-line">{order.review.body}</p>}
          {order.review.sellerReply ? (
            <p className="bg-surface-muted rounded-md p-3 text-sm">
              <strong>Your reply:</strong> {order.review.sellerReply}
            </p>
          ) : (
            <ReviewReplyForm reviewId={order.review.id} />
          )}
        </section>
      )}
      <div>
        <MessageButton orderId={order.id} signedIn label="Message buyer" />
      </div>
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
