import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { formatKes } from "@/lib/money";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const ranges = [7, 30, 90] as const;
const paidStatuses = ["PAID_HELD", "SHIPPED", "DELIVERED", "COMPLETED", "DISPUTED"] as const;

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Admin</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AdminOverview searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaffPage("/admin");
  const isAdmin = can(user, "manage_settings", "platform", {});
  const requested = Number((await searchParams).days);
  const days = ranges.find((r) => r === requested) ?? 30;
  const since = daysAgo(days);

  // Counted by when the order was placed. Refunded and cancelled orders aren't sales.
  const [placed, paid, newUsers, activeSellers, queues] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: since } } }),
    db.order.aggregate({
      where: { createdAt: { gte: since }, status: { in: [...paidStatuses] } },
      _count: true,
      _sum: { totalMinor: true, platformFeeMinor: true, refundedMinor: true },
    }),
    db.user.count({ where: { createdAt: { gte: since }, status: { not: "DELETED" } } }),
    db.sellerProfile.count({ where: { listings: { some: { status: "ACTIVE" } } } }),
    Promise.all([
      db.listing.count({ where: { status: "PENDING_REVIEW" } }),
      db.report.count({ where: { status: "OPEN" } }),
      db.dispute.count({ where: { status: { not: "RESOLVED" } } }),
      db.order.count({ where: { fraudFlags: { isEmpty: false }, fraudReviewedAt: null } }),
      db.payout.count({ where: { status: "FAILED" } }),
    ]),
  ]);
  const gmv = (paid._sum.totalMinor ?? 0) - (paid._sum.refundedMinor ?? 0);
  const paidCount = paid._count;
  const conversion = placed === 0 ? "–" : `${Math.round((paidCount / placed) * 100)}%`;
  const aov = paidCount === 0 ? "–" : formatKes(Math.round(gmv / paidCount));
  const [toReview, reports, disputes, flagged, failedPayouts] = queues;

  return (
    <>
      <AdminNav current="/admin" isAdmin={isAdmin} />
      <nav aria-label="Date range" className="flex flex-wrap gap-2">
        {ranges.map((r) => (
          <Link
            key={r}
            href={`/admin?days=${r}`}
            aria-current={r === days ? "page" : undefined}
            className={cn(
              "border-border-strong flex min-h-11 items-center rounded-full border px-4 text-sm",
              r === days && "bg-brand text-brand-foreground border-brand",
            )}
          >
            Last {r} days
          </Link>
        ))}
      </nav>
      <section aria-labelledby="sales-heading" className="flex flex-col gap-3">
        <h2 id="sales-heading" className="text-xl font-semibold">
          Sales in the last {days} days
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="admin-stats">
          <Stat label="Sales (GMV)" value={formatKes(gmv)} hint="Paid orders, less refunds" />
          <Stat
            label="Platform revenue"
            value={formatKes(paid._sum.platformFeeMinor ?? 0)}
            hint="Commission on paid orders"
          />
          <Stat label="Orders paid" value={paidCount} hint={`${placed} placed`} />
          <Stat label="Checkout conversion" value={conversion} hint="Orders paid out of orders placed" />
          <Stat label="Average order" value={aov} />
          <Stat label="New users" value={newUsers} />
          <Stat label="Active sellers" value={activeSellers} hint="With at least one live listing (now)" />
        </div>
      </section>
      <section aria-labelledby="queues-heading" className="flex flex-col gap-3">
        <h2 id="queues-heading" className="text-xl font-semibold">
          Needs attention
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["Listings to review", toReview, "/admin/moderation?tab=listings"],
              ["Open reports", reports, "/admin/moderation?tab=reports"],
              ["Open disputes", disputes, "/admin/moderation?tab=disputes"],
              ["Flagged orders", flagged, "/admin/moderation?tab=orders"],
              ...(isAdmin ? ([["Failed payouts", failedPayouts, "/admin/payouts?status=FAILED"]] as const) : []),
            ] as const
          ).map(([label, count, href]) => (
            <li key={label}>
              <Link
                href={href}
                className="hover:bg-surface-muted flex min-h-11 items-center justify-between rounded-md border px-4 py-3"
              >
                <span>{label}</span>
                <span className="font-semibold">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
