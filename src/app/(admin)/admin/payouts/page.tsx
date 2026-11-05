import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { PayoutStatus, Prisma } from "@/generated/prisma/client";
import { formatKes } from "@/lib/money";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { AdminNav, pageParam, when } from "@/components/admin/admin-nav";
import { RetryPayoutButton } from "@/components/admin/admin-forms";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payouts", robots: { index: false, follow: false } };

const PER_PAGE = 25;
const filters: { key: PayoutStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "FAILED", label: "Failed" },
  { key: "PENDING", label: "Waiting" },
  { key: "PROCESSING", label: "Sending" },
  { key: "PAID", label: "Paid" },
];
const variant = { PAID: "success", FAILED: "danger", PENDING: "warning", PROCESSING: "neutral" } as const;

export default function AdminPayoutsPage({ searchParams }: PageProps<"/admin/payouts">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Payouts</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Payouts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Payouts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("/admin/payouts", "admin");
  const params = await searchParams;
  const status = filters.find((f) => f.key && f.key === params.status)?.key || undefined;
  const page = pageParam(params.page);
  const where: Prisma.PayoutWhereInput = status ? { status } : {};
  const [total, payouts] = await Promise.all([
    db.payout.count({ where }),
    db.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        amountMinor: true,
        status: true,
        failureReason: true,
        createdAt: true,
        paidAt: true,
        seller: { select: { displayName: true, userId: true, payoutLabel: true } },
        orders: { select: { id: true, number: true, fraudFlags: true, fraudReviewedAt: true } },
      },
    }),
  ]);
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (status) s.set("status", status);
    if (p > 1) s.set("page", String(p));
    return `/admin/payouts${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminNav current="/admin/payouts" isAdmin />
      <nav aria-label="Filter payouts" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.key ? `/admin/payouts?status=${f.key}` : "/admin/payouts"}
            aria-current={(status ?? "") === f.key ? "page" : undefined}
            className={cn(
              "border-border-strong flex min-h-11 items-center rounded-full border px-4 text-sm",
              (status ?? "") === f.key && "bg-brand text-brand-foreground border-brand",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <p className="text-muted text-sm">
        Payouts are sent automatically when an order completes and retried every hour. Waiting payouts usually mean the
        seller hasn&apos;t added an M-Pesa number, or an order is held for a safety check.
      </p>
      <ul className="divide-y rounded-md border" data-testid="admin-payouts">
        {payouts.map((p) => {
          const held = p.orders.some((o) => o.fraudFlags.length > 0 && !o.fraudReviewedAt);
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {formatKes(p.amountMinor)} to{" "}
                  <Link href={`/admin/users/${p.seller.userId}`} className="underline">
                    {p.seller.displayName}
                  </Link>
                </p>
                <p className="text-muted text-sm">
                  {p.seller.payoutLabel ?? "No M-Pesa number yet"} · {when(p.createdAt)} · order{" "}
                  {p.orders.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && ", "}
                      <Link href={`/admin/orders/${o.id}`} className="underline">
                        {o.number}
                      </Link>
                    </span>
                  ))}
                </p>
                {p.failureReason && <p className="text-danger text-sm">{p.failureReason}</p>}
                {held && <p className="text-sm">Held for a safety check (see Moderation, flagged orders).</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={variant[p.status]}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</Badge>
                {(p.status === "FAILED" || p.status === "PENDING") && !held && p.seller.payoutLabel && (
                  <RetryPayoutButton payoutId={p.id} />
                )}
              </div>
            </li>
          );
        })}
        {payouts.length === 0 && <li className="text-muted p-3">No payouts here.</li>}
      </ul>
      <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} hrefForPage={href} />
    </>
  );
}
