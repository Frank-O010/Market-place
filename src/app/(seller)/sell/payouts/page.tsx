import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatKes } from "@/lib/money";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { PayoutForm } from "@/components/sell/payout-form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Payouts", robots: { index: false } };

export default function PayoutsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Payouts</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Payouts />
      </Suspense>
    </div>
  );
}

const statusText = { PENDING: "Waiting", PROCESSING: "Sending", PAID: "Paid", FAILED: "Failed" } as const;
const statusVariant = { PENDING: "warning", PROCESSING: "brand", PAID: "success", FAILED: "danger" } as const;

async function Payouts() {
  const user = await requireUserOrRedirect("/sell/payouts");
  if (!user.sellerProfileId) redirect("/sell/onboarding");
  const seller = await db.sellerProfile.findUniqueOrThrow({
    where: { id: user.sellerProfileId },
    select: { id: true, payoutLabel: true },
  });
  if (!can(user, "view", "payout", { sellerId: seller.id })) redirect("/sell");
  const payouts = await db.payout.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      amountMinor: true,
      feeMinor: true,
      status: true,
      createdAt: true,
      paidAt: true,
      failureReason: true,
      orders: { select: { number: true } },
    },
  });
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(d);
  return (
    <>
      <section aria-labelledby="payout-details" className="flex flex-col gap-3">
        <h2 id="payout-details" className="text-xl font-semibold">
          Where we send your money
        </h2>
        <p className="text-muted max-w-xl text-sm">
          When a buyer confirms delivery (or the confirmation window ends), we send the order total minus our commission
          to this M-Pesa number.
        </p>
        <PayoutForm current={seller.payoutLabel} />
      </section>
      <section aria-labelledby="payout-history" className="flex flex-col gap-3">
        <h2 id="payout-history" className="text-xl font-semibold">
          History
        </h2>
        {payouts.length === 0 ? (
          <p className="text-muted">No payouts yet.</p>
        ) : (
          <ul className="divide-border border-border bg-surface divide-y rounded-lg border">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="flex flex-col">
                  <span className="font-medium">{formatKes(payout.amountMinor)}</span>
                  <span className="text-muted text-sm">
                    Order {payout.orders.map((o) => o.number).join(", ")} · commission {formatKes(payout.feeMinor)} ·{" "}
                    {date(payout.paidAt ?? payout.createdAt)}
                  </span>
                  {payout.failureReason && <span className="text-danger text-sm">{payout.failureReason}</span>}
                </div>
                <Badge variant={statusVariant[payout.status]}>{statusText[payout.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
