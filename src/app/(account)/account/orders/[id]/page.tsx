import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { loadOrderForViewer } from "@/server/queries/orders";
import { getPaymentGateway } from "@/server/payments";
import { BuyerPendingActions, ConfirmDeliveryButton, PaymentWatcher } from "@/components/orders/order-actions";
import { OrderItems, OrderStatusBadge, OrderTimeline } from "@/components/orders/order-summary";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

const day = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(date);

export default function OrderPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Order params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Order({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUserOrRedirect(`/account/orders/${id}`);
  const order = await loadOrderForViewer(user, id);
  if (!order || order.buyerId !== user.id) notFound();
  // With the mock gateway there's no real phone prompt, so link to the sandbox instead.
  const sandboxReference =
    getPaymentGateway()?.mode === "mock"
      ? order.payments.find((p) => p.status === "PENDING")?.providerReference
      : undefined;
  const paying = order.status === "PENDING_PAYMENT" && (query.paying === "mpesa" || query.paying === "card");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PaymentWatcher active={paying} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Order {order.number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-muted text-sm">From {order.seller.displayName}</p>
      </div>

      {order.status === "PENDING_PAYMENT" && (
        <div className="border-warning bg-warning-subtle flex flex-col gap-3 rounded-lg border p-4" role="status">
          {query.payment_error ? (
            <p>We couldn&apos;t start the payment. Please try again.</p>
          ) : paying && query.paying === "mpesa" ? (
            <p>
              <strong>Check your phone.</strong> Enter your M-Pesa PIN to pay. This page updates by itself once the
              payment arrives.
            </p>
          ) : (
            <p>This order isn&apos;t paid yet.</p>
          )}
          {order.paymentDueAt && (
            <p className="text-sm">
              Pay by{" "}
              {new Intl.DateTimeFormat("en-KE", { timeStyle: "short", timeZone: "Africa/Nairobi" }).format(
                order.paymentDueAt,
              )}{" "}
              or the order is cancelled.
            </p>
          )}
          <BuyerPendingActions orderId={order.id} canCard={Boolean(user.email)} />
          {sandboxReference && (
            <Link
              href={`/dev/payments/${encodeURIComponent(sandboxReference)}`}
              className="text-brand text-sm font-medium underline-offset-4 hover:underline"
            >
              Test mode: open the payment sandbox
            </Link>
          )}
        </div>
      )}
      {order.status === "PAID_HELD" && (
        <p className="border-brand bg-brand-subtle rounded-lg border p-4" role="status">
          Paid. Your money is held safely until you confirm the item arrived. The seller is preparing your order.
        </p>
      )}
      {order.status === "SHIPPED" && (
        <div className="border-brand bg-brand-subtle flex flex-col gap-3 rounded-lg border p-4">
          <p>
            Your order is on the way. When it arrives, check it and confirm.
            {order.autoReleaseAt &&
              ` If you don't report a problem by ${day(order.autoReleaseAt)}, the payment is released automatically.`}
          </p>
          <ConfirmDeliveryButton orderId={order.id} />
        </div>
      )}
      {(order.status === "CANCELLED" || order.status === "REFUNDED") && order.cancelReason && (
        <p className="border-border rounded-lg border p-4">{order.cancelReason}</p>
      )}

      <OrderItems order={order} perspective="buyer" />
      <OrderTimeline order={order} />
      {order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED" && (
        <Link
          href={`/account/orders/${order.id}/receipt`}
          className="text-brand font-medium underline-offset-4 hover:underline"
        >
          View receipt
        </Link>
      )}
    </div>
  );
}
