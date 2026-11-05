import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { formatKes } from "@/lib/money";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { loadOrderForViewer } from "@/server/queries/orders";
import { PrintButton } from "@/components/orders/print-button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

/** Printable receipt / invoice for a paid order. Visible to the buyer, the seller and staff. */
export default function ReceiptPage({ params }: PageProps<"/account/orders/[id]/receipt">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      <Receipt params={params} />
    </Suspense>
  );
}

async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/account/orders/${id}/receipt`);
  const order = await loadOrderForViewer(user, id);
  if (!order || order.status === "PENDING_PAYMENT" || order.status === "CANCELLED") notFound();
  const payment = order.payments.find((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED");
  const date = (d: Date) =>
    new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(d);

  return (
    <article className="bg-surface border-border mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border p-6 print:border-0">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-brand text-xl font-bold">{site.name}</p>
          <h1 className="text-2xl font-bold">Receipt</h1>
        </div>
        <dl className="text-sm">
          <dt className="text-muted">Order</dt>
          <dd className="font-medium">{order.number}</dd>
          <dt className="text-muted">Date</dt>
          <dd>{date(order.createdAt)}</dd>
        </dl>
      </header>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted">Billed to</p>
          <p>{order.buyer?.name}</p>
          {order.buyer?.email && <p>{order.buyer.email}</p>}
        </div>
        <div>
          <p className="text-muted">Sold by</p>
          <p>{order.seller.displayName}</p>
          <p className="text-muted text-xs">Sold through {site.name}. Payment held until delivery.</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Items</caption>
        <thead>
          <tr className="border-border border-b text-left">
            <th scope="col" className="py-2">
              Item
            </th>
            <th scope="col" className="py-2 text-right">
              Qty
            </th>
            <th scope="col" className="py-2 text-right">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-border border-b">
              <td className="py-2">{item.titleSnapshot}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatKes(item.unitPriceMinor * item.quantity)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2" colSpan={2}>
              {order.deliveryMethod === "DELIVERY" ? "Delivery" : "Pickup"}
            </td>
            <td className="py-2 text-right">{formatKes(order.deliveryFeeMinor)}</td>
          </tr>
          <tr className="font-bold">
            <td className="py-2" colSpan={2}>
              Total
            </td>
            <td className="py-2 text-right">{formatKes(order.totalMinor)}</td>
          </tr>
        </tbody>
      </table>
      {payment && (
        <p className="text-sm">
          Paid by {payment.method === "MPESA" ? "M-Pesa" : "card"} · reference {payment.providerReference}
          {payment.status === "REFUNDED" && " · refunded"}
        </p>
      )}
      <PrintButton />
    </article>
  );
}
