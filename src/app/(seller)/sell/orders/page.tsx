import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { formatKes } from "@/lib/money";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { OrderStatusBadge } from "@/components/orders/order-summary";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

export default function SellerOrdersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Orders</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Orders />
      </Suspense>
    </div>
  );
}

async function Orders() {
  const user = await requireUserOrRedirect("/sell/orders");
  if (!user.sellerProfileId) redirect("/sell/onboarding");
  // Unpaid orders are hidden: the seller only needs to act once the money is held.
  const orders = await db.order.findMany({
    where: { sellerId: user.sellerProfileId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      status: true,
      totalMinor: true,
      platformFeeMinor: true,
      buyer: { select: { name: true } },
      items: { select: { titleSnapshot: true }, take: 1 },
      _count: { select: { items: true } },
    },
  });
  if (orders.length === 0) {
    return <EmptyState icon={<Package />} title="No orders yet" description="Paid orders show up here." />;
  }
  return (
    <ul className="divide-border border-border bg-surface divide-y rounded-lg border">
      {orders.map((order) => (
        <li key={order.id} className="relative flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="flex min-w-0 flex-col">
            <Link href={`/sell/orders/${order.id}`} className="font-medium after:absolute after:inset-0">
              {order.items[0]?.titleSnapshot}
              {order._count.items > 1 ? ` and ${order._count.items - 1} more` : ""}
            </Link>
            <span className="text-muted text-sm">
              {order.number} · {order.buyer?.name} · you receive {formatKes(order.totalMinor - order.platformFeeMinor)}
            </span>
          </div>
          <OrderStatusBadge status={order.status} />
        </li>
      ))}
    </ul>
  );
}
