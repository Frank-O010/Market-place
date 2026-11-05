import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatKes } from "@/lib/money";
import { fraudFlagLabels, type FraudFlag } from "@/lib/trust/fraud";
import { requireStaffPage } from "@/server/auth/staff";
import { can } from "@/server/policy/can";
import { loadOrderForViewer } from "@/server/queries/orders";
import { AdminNav, when } from "@/components/admin/admin-nav";
import { FraudReview } from "@/components/admin/moderation-actions";
import { OrderItems, OrderStatusBadge, OrderTimeline } from "@/components/orders/order-summary";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Order", robots: { index: false, follow: false } };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AdminOrder params={params} />
    </Suspense>
  );
}

async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaffPage(`/admin/orders/${id}`);
  if (!/^[a-z0-9]{20,40}$/i.test(id)) notFound();
  const order = await loadOrderForViewer(user, id);
  if (!order) notFound();
  const isAdmin = can(user, "manage_settings", "platform", {});
  const flagged = order.fraudFlags.length > 0 && !order.fraudReviewedAt;

  return (
    <div className="flex flex-col gap-4">
      <AdminNav current="/admin/orders" isAdmin={isAdmin} />
      <Link href="/admin/orders" className="text-muted flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> All orders
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Order {order.number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Buyer</dt>
        <dd>
          {order.buyerId ? (
            <Link href={`/admin/users/${order.buyerId}`} className="underline">
              {order.buyer?.name}
            </Link>
          ) : (
            "Deleted account"
          )}
        </dd>
        <dt className="text-muted">Seller</dt>
        <dd>{order.seller.displayName}</dd>
        <dt className="text-muted">Placed</dt>
        <dd>{when(order.createdAt)}</dd>
        <dt className="text-muted">Total</dt>
        <dd>
          {formatKes(order.totalMinor)} (commission {formatKes(order.platformFeeMinor)}
          {order.refundedMinor > 0 && `, refunded ${formatKes(order.refundedMinor)}`})
        </dd>
        <dt className="text-muted">Payout</dt>
        <dd>
          {order.payout
            ? `${formatKes(order.payout.amountMinor)}: ${order.payout.status.toLowerCase()}${order.payout.failureReason ? ` (${order.payout.failureReason})` : ""}`
            : "Not yet due"}
        </dd>
        {order.dispute && (
          <>
            <dt className="text-muted">Dispute</dt>
            <dd>
              <Link href={`/admin/disputes/${order.dispute.id}`} className="underline">
                Open the dispute ({order.dispute.status.toLowerCase().replace("_", " ")})
              </Link>
            </dd>
          </>
        )}
      </dl>
      {flagged && (
        <section aria-labelledby="flags-heading" className="border-warning flex flex-col gap-2 rounded-lg border p-4">
          <h2 id="flags-heading" className="font-semibold">
            Payout on hold for a safety check
          </h2>
          <ul className="list-disc pl-5 text-sm">
            {order.fraudFlags.map((f) => (
              <li key={f}>{fraudFlagLabels[f as FraudFlag] ?? f}</li>
            ))}
          </ul>
          <FraudReview orderId={order.id} canRefund={order.status === "PAID_HELD"} />
        </section>
      )}
      <section aria-labelledby="payments-heading" className="flex flex-col gap-2">
        <h2 id="payments-heading" className="text-xl font-semibold">
          Payments
        </h2>
        {order.payments.length === 0 ? (
          <p className="text-muted text-sm">No payment attempts.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {order.payments.map((p) => (
              <li key={p.providerReference} className="flex flex-wrap justify-between gap-2 p-3">
                <code>{p.providerReference}</code>
                <span>
                  {p.method === "MPESA" ? "M-Pesa" : "Card"} · {formatKes(p.amountMinor)} · {p.status.toLowerCase()}
                </span>
                <span className="text-muted">{when(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <OrderItems order={order} perspective="seller" />
      <OrderTimeline order={order} />
    </div>
  );
}
