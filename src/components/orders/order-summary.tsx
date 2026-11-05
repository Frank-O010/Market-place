import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { formatKes } from "@/lib/money";
import { progressSteps, statusLabels, type OrderStatus } from "@/lib/orders/state";
import { listingPath } from "@/lib/urls";
import type { OrderDetail } from "@/server/queries/orders";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(
    date,
  );

export const statusVariant: Record<OrderStatus, BadgeProps["variant"]> = {
  PENDING_PAYMENT: "warning",
  PAID_HELD: "brand",
  SHIPPED: "brand",
  DELIVERED: "success",
  COMPLETED: "success",
  DISPUTED: "danger",
  REFUNDED: "neutral",
  CANCELLED: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={statusVariant[status]} data-testid="order-status">
      {statusLabels[status]}
    </Badge>
  );
}

/** Progress along the happy path, then the full timeline of events. */
export function OrderTimeline({ order }: { order: OrderDetail }) {
  const reached = new Set(order.events.map((e) => e.status));
  const off = order.status === "CANCELLED" || order.status === "REFUNDED";
  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-3">
      <h2 id="progress-heading" className="text-lg font-semibold">
        Progress
      </h2>
      {!off && (
        <ol className="grid grid-cols-4 gap-1 text-center text-xs sm:text-sm">
          {progressSteps.map((step) => {
            const done = reached.has(step);
            return (
              <li key={step} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2",
                    done ? "border-brand bg-brand text-brand-foreground" : "border-border-strong text-muted",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-4" /> : <Circle className="size-3" />}
                </span>
                <span className={done ? "font-medium" : "text-muted"}>
                  {statusLabels[step]}
                  <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <ol className="border-border flex flex-col gap-3 border-l-2 pl-4">
        {order.events.map((event) => (
          <li key={event.id} className="flex flex-col">
            <span className="font-medium">{statusLabels[event.status]}</span>
            {event.note && <span className="text-sm">{event.note}</span>}
            <time className="text-muted text-xs" dateTime={event.createdAt.toISOString()}>
              {when(event.createdAt)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OrderItems({ order, perspective }: { order: OrderDetail; perspective: "buyer" | "seller" }) {
  const address = order.deliveryAddress as { area?: string; directions?: string } | null;
  return (
    <section aria-labelledby="items-heading" className="flex flex-col gap-3">
      <h2 id="items-heading" className="text-lg font-semibold">
        Items
      </h2>
      <ul className="divide-border border-border divide-y rounded-lg border">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3 p-3 text-sm">
            <Link href={listingPath(item.listing)} className="underline-offset-4 hover:underline">
              {item.titleSnapshot} × {item.quantity}
            </Link>
            <span>{formatKes(item.unitPriceMinor * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-1 text-sm">
        <dt>Items</dt>
        <dd className="text-right">{formatKes(order.subtotalMinor)}</dd>
        <dt>{order.deliveryMethod === "DELIVERY" ? "Delivery" : "Pickup"}</dt>
        <dd className="text-right">{order.deliveryFeeMinor ? formatKes(order.deliveryFeeMinor) : "Free"}</dd>
        <dt className="font-bold">Total</dt>
        <dd className="text-right font-bold" data-testid="order-total">
          {formatKes(order.totalMinor)}
        </dd>
        {perspective === "seller" && (
          <>
            <dt>Commission</dt>
            <dd className="text-right" data-testid="order-commission">
              −{formatKes(order.platformFeeMinor)}
            </dd>
            <dt className="font-bold">You receive</dt>
            <dd className="text-right font-bold" data-testid="order-payout">
              {formatKes(order.totalMinor - order.platformFeeMinor)}
            </dd>
          </>
        )}
      </dl>
      <div className="text-sm">
        {order.deliveryMethod === "DELIVERY" && address ? (
          <p>
            <strong>Deliver to:</strong> {address.area}. {address.directions}
          </p>
        ) : (
          <p>
            <strong>Pickup</strong> from {order.seller.displayName}
            {order.seller.location ? ` in ${order.seller.location}` : ""}.
          </p>
        )}
        {perspective === "seller" && order.buyerPhone && (
          <p>
            <strong>Buyer&apos;s phone:</strong> <a href={`tel:+${order.buyerPhone}`}>+{order.buyerPhone}</a>
          </p>
        )}
        {order.trackingNote && (
          <p>
            <strong>Seller&apos;s note:</strong> {order.trackingNote}
          </p>
        )}
      </div>
    </section>
  );
}
