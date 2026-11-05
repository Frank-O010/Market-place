import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatKes } from "@/lib/money";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { loadOrderForViewer } from "@/server/queries/orders";
import { DisputeResolutionForm } from "@/components/admin/moderation-actions";
import { OrderItems, OrderStatusBadge, OrderTimeline } from "@/components/orders/order-summary";
import { DisputePanel } from "@/components/trust/dispute-panel";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Dispute", robots: { index: false, follow: false } };

export default function DisputePage({ params }: PageProps<"/admin/disputes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Dispute params={params} />
    </Suspense>
  );
}

async function Dispute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/admin/disputes/${id}`);
  if (!can(user, "moderate", "platform", {}) || !/^[a-z0-9]{20,40}$/i.test(id)) notFound();
  const dispute = await db.dispute.findUnique({
    where: { id },
    select: {
      orderId: true,
      order: { select: { buyer: { select: { name: true, email: true } }, seller: { select: { displayName: true } } } },
    },
  });
  if (!dispute) notFound();
  const order = await loadOrderForViewer(user, dispute.orderId);
  if (!order?.dispute) notFound();
  const conversation = await db.conversation.findFirst({
    where: { buyerId: order.buyerId ?? "", sellerId: order.sellerId },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  const sellerShare = order.totalMinor - order.platformFeeMinor;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/admin/moderation?tab=disputes"
        className="text-brand inline-flex min-h-11 items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden /> All disputes
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Dispute on order {order.number}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-muted text-sm">
        Buyer {dispute.order.buyer?.name} ({dispute.order.buyer?.email ?? "no email"}) · seller{" "}
        {dispute.order.seller.displayName} · paid {formatKes(order.totalMinor)} · seller&apos;s share{" "}
        {formatKes(sellerShare)}
      </p>
      {conversation && (
        <Link href={`/messages/${conversation.id}`} className="text-brand self-start underline">
          Read their messages
        </Link>
      )}
      <DisputePanel order={order} perspective="staff" />
      {order.dispute.status !== "RESOLVED" && order.status === "DISPUTED" && (
        <section aria-labelledby="resolve-heading" className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <h2 id="resolve-heading" className="text-xl font-semibold">
            Resolve
          </h2>
          <DisputeResolutionForm disputeId={order.dispute.id} maxPartialKes={(sellerShare / 100).toFixed(2)} />
        </section>
      )}
      <OrderItems order={order} perspective="seller" />
      <OrderTimeline order={order} />
    </div>
  );
}
