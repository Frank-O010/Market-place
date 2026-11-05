import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { formatKes } from "@/lib/money";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { OrderStatusBadge } from "@/components/orders/order-summary";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">My orders</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Orders />
      </Suspense>
    </div>
  );
}

async function Orders() {
  const user = await requireUserOrRedirect("/account/orders");
  const orders = await db.order.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      totalMinor: true,
      createdAt: true,
      seller: { select: { displayName: true } },
      items: { select: { titleSnapshot: true }, take: 1 },
      _count: { select: { items: true } },
    },
  });
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package />}
        title="No orders yet"
        description="When you buy something, you can track it here."
        action={
          <Button asChild>
            <Link href="/">Start shopping</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="divide-border border-border bg-surface divide-y rounded-lg border">
      {orders.map((order) => (
        <li key={order.id} className="relative flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="flex min-w-0 flex-col">
            <Link href={`/account/orders/${order.id}`} className="font-medium after:absolute after:inset-0">
              {order.items[0]?.titleSnapshot}
              {order._count.items > 1 ? ` and ${order._count.items - 1} more` : ""}
            </Link>
            <span className="text-muted text-sm">
              {order.number} · {order.seller.displayName} · {formatKes(order.totalMinor)}
            </span>
          </div>
          <OrderStatusBadge status={order.status} />
        </li>
      ))}
    </ul>
  );
}
