import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/**
 * Where Paystack sends the buyer back after a card payment. The webhook is what marks the order
 * paid; this page only finds the order and shows its live status.
 */
export default function CompletePage({ searchParams }: PageProps<"/checkout/complete">) {
  return (
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <Complete searchParams={searchParams} />
    </Suspense>
  );
}

async function Complete({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const reference =
    typeof params.reference === "string" ? params.reference : typeof params.trxref === "string" ? params.trxref : null;
  const user = await requireUserOrRedirect("/account/orders");
  const payment = reference
    ? await db.payment.findUnique({
        where: { providerReference: reference },
        select: { order: { select: { id: true, buyerId: true } } },
      })
    : null;
  if (!payment || payment.order.buyerId !== user.id) redirect("/account/orders");
  return redirect(`/account/orders/${payment.order.id}?paying=card`);
}
