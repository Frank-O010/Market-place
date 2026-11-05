import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatKes } from "@/lib/money";
import { sellerPath } from "@/lib/urls";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { AdminNav, when } from "@/components/admin/admin-nav";
import { RolesForm, TierForm } from "@/components/admin/admin-forms";
import { SuspendUserButton } from "@/components/admin/moderation-actions";
import { OrderStatusBadge } from "@/components/orders/order-summary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "User", robots: { index: false, follow: false } };

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <UserDetail params={params} />
    </Suspense>
  );
}

async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireStaffPage(`/admin/users/${id}`);
  if (!/^[a-z0-9]{20,40}$/i.test(id)) notFound();
  const isAdmin = can(viewer, "manage_settings", "platform", {});
  const target = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      phoneVerified: true,
      roles: true,
      status: true,
      createdAt: true,
      sellerProfile: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          verificationTier: true,
          idVerificationStatus: true,
          payoutLabel: true,
          _count: { select: { listings: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
  if (!target || target.status === "DELETED") notFound();
  const seller = target.sellerProfile;
  const [buyerOrders, sellerOrders, auditEntries] = await Promise.all([
    db.order.findMany({
      where: { buyerId: target.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, number: true, status: true, totalMinor: true, createdAt: true },
    }),
    seller
      ? db.order.findMany({
          where: { sellerId: seller.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, number: true, status: true, totalMinor: true, createdAt: true },
        })
      : [],
    isAdmin
      ? db.auditLog.findMany({
          where: {
            OR: [{ targetId: target.id }, ...(seller ? [{ targetId: seller.id }] : []), { actorId: target.id }],
          },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } },
        })
      : [],
  ]);
  const isStaffTarget = target.roles.includes("ADMIN") || target.roles.includes("MODERATOR");
  const canSuspend = viewer.id !== target.id && (!isStaffTarget || isAdmin);

  const orderList = (orders: typeof buyerOrders) =>
    orders.length === 0 ? (
      <p className="text-muted text-sm">None yet.</p>
    ) : (
      <ul className="divide-y">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <Link href={`/admin/orders/${o.id}`} className="underline-offset-2 hover:underline">
              {o.number}
            </Link>
            <span className="text-muted text-sm">{when(o.createdAt)}</span>
            <span>{formatKes(o.totalMinor)}</span>
            <OrderStatusBadge status={o.status} />
          </li>
        ))}
      </ul>
    );

  return (
    <div className="flex flex-col gap-4">
      <AdminNav current="/admin/users" isAdmin={isAdmin} />
      <Link href="/admin/users" className="text-muted flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" aria-hidden /> All users
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold">{target.name}</h1>
        {target.status === "SUSPENDED" && <Badge variant="danger">Suspended</Badge>}
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Email</dt>
        <dd>{target.email ?? "None"}</dd>
        <dt className="text-muted">Phone</dt>
        <dd>
          {target.phone ? `+${target.phone}` : "None"}{" "}
          {target.phoneVerified && <Badge variant="success">Verified</Badge>}
        </dd>
        <dt className="text-muted">Joined</dt>
        <dd>{when(target.createdAt)}</dd>
        <dt className="text-muted">Roles</dt>
        <dd data-testid="user-roles">{target.roles.map((r) => r.charAt(0) + r.slice(1).toLowerCase()).join(", ")}</dd>
        {seller && (
          <>
            <dt className="text-muted">Shop</dt>
            <dd>
              <Link href={sellerPath(seller.slug)} className="underline">
                {seller.displayName}
              </Link>{" "}
              · {seller._count.listings} live listings · tier {seller.verificationTier.toLowerCase().replace("_", " ")}
              {seller.idVerificationStatus === "PENDING" && " · ID waiting for review"}
            </dd>
            <dt className="text-muted">Payouts to</dt>
            <dd>{seller.payoutLabel ?? "Not set up"}</dd>
          </>
        )}
      </dl>
      {canSuspend && (
        <div>
          <SuspendUserButton userId={target.id} suspended={target.status === "SUSPENDED"} />
        </div>
      )}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <RolesForm userId={target.id} roles={target.roles} />
            </CardContent>
          </Card>
          {seller && (
            <Card>
              <CardContent className="pt-6">
                <TierForm userId={target.id} tier={seller.verificationTier} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Orders as buyer</CardTitle>
          </CardHeader>
          <CardContent>{orderList(buyerOrders)}</CardContent>
        </Card>
        {seller && (
          <Card>
            <CardHeader>
              <CardTitle>Orders as seller</CardTitle>
            </CardHeader>
            <CardContent>{orderList(sellerOrders)}</CardContent>
          </Card>
        )}
      </div>
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Recent audit entries</CardTitle>
          </CardHeader>
          <CardContent>
            {auditEntries.length === 0 ? (
              <p className="text-muted text-sm">None.</p>
            ) : (
              <ul className="divide-y text-sm">
                {auditEntries.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <code>{a.action}</code>
                    <span className="text-muted">
                      {a.actor?.name ?? "System"} · {when(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/audit?target=${target.id}`} className="mt-2 inline-block text-sm underline">
              Full audit log for this person
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
