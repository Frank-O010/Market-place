import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { formatKes } from "@/lib/money";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { AdminNav, pageParam, textParam, when } from "@/components/admin/admin-nav";
import { OrderStatusBadge } from "@/components/orders/order-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

const PER_PAGE = 25;
const statuses: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Waiting for payment",
  PAID_HELD: "Paid, money held",
  SHIPPED: "On the way",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  DISPUTED: "Disputed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Orders</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStaffPage("/admin/orders");
  const params = await searchParams;
  const q = textParam(params.q);
  const status = (Object.keys(statuses) as OrderStatus[]).find((s) => s === params.status);
  const page = pageParam(params.page);
  const where: Prisma.OrderWhereInput = {
    ...(status && { status }),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { buyer: { email: { contains: q, mode: "insensitive" } } },
        { buyer: { name: { contains: q, mode: "insensitive" } } },
        { seller: { displayName: { contains: q, mode: "insensitive" } } },
        { payments: { some: { providerReference: q } } },
      ],
    }),
  };
  const [total, orders] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        number: true,
        status: true,
        totalMinor: true,
        createdAt: true,
        fraudFlags: true,
        fraudReviewedAt: true,
        buyer: { select: { name: true } },
        seller: { select: { displayName: true } },
      },
    }),
  ]);
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (status) s.set("status", status);
    if (p > 1) s.set("page", String(p));
    return `/admin/orders${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminNav current="/admin/orders" isAdmin={can(user, "manage_settings", "platform", {})} />
      <form role="search" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-q">Order number, buyer, shop or payment reference</Label>
          <Input id="order-q" name="q" type="search" defaultValue={q} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-status">Status</Label>
          <NativeSelect id="order-status" name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {(Object.keys(statuses) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {statuses[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">Search</Button>
      </form>
      <p className="text-muted text-sm" aria-live="polite">
        {total} {total === 1 ? "order" : "orders"}
      </p>
      <ul className="divide-y rounded-md border" data-testid="admin-orders">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <Link
                href={`/admin/orders/${o.id}`}
                className="inline-block min-h-6 font-medium underline-offset-2 hover:underline"
              >
                {o.number}
              </Link>
              <p className="text-muted text-sm">
                {o.buyer?.name ?? "Deleted account"} → {o.seller.displayName} · {when(o.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>{formatKes(o.totalMinor)}</span>
              {o.fraudFlags.length > 0 && !o.fraudReviewedAt && <Badge variant="warning">Flagged</Badge>}
              <OrderStatusBadge status={o.status} />
            </div>
          </li>
        ))}
        {orders.length === 0 && <li className="text-muted p-3">No orders match that search.</li>}
      </ul>
      <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} hrefForPage={href} />
    </>
  );
}
