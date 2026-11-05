import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatKes } from "@/lib/money";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getPaymentGateway } from "@/server/payments";
import { getSetting } from "@/server/settings";
import { TrackEvent } from "@/components/analytics";
import { CheckoutForm } from "@/components/orders/checkout-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <Suspense fallback={<Skeleton className="h-[32rem] w-full max-w-xl" />}>
        <Checkout searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Checkout({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { seller } = await searchParams;
  const sellerId = typeof seller === "string" && /^[a-z0-9]{20,40}$/i.test(seller) ? seller : null;
  const user = await requireUserOrRedirect(`/checkout${sellerId ? `?seller=${sellerId}` : ""}`);
  if (!sellerId) redirect("/cart");
  if (!getPaymentGateway()) {
    return (
      <EmptyState
        title="Checkout isn't switched on yet"
        description="Payments are being set up. Please try again soon."
      />
    );
  }
  const [items, sellerProfile, deliveryFee, profile] = await Promise.all([
    db.cartItem.findMany({
      where: { cart: { userId: user.id }, listing: { sellerId } },
      select: {
        quantity: true,
        listing: { select: { title: true, priceMinor: true } },
        variant: { select: { name: true, priceOverrideMinor: true } },
      },
    }),
    db.sellerProfile.findUnique({ where: { id: sellerId }, select: { displayName: true, location: true } }),
    getSetting("delivery_fee_minor"),
    db.user.findUnique({ where: { id: user.id }, select: { phone: true } }),
  ]);
  if (!sellerProfile || items.length === 0) redirect("/cart");
  const subtotal = items.reduce(
    (sum, i) => sum + (i.variant?.priceOverrideMinor ?? i.listing.priceMinor) * i.quantity,
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="summary-heading" className="flex max-w-xl flex-col gap-2">
        <h2 id="summary-heading" className="text-lg font-semibold">
          {sellerProfile.displayName}
        </h2>
        <ul className="text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {item.listing.title}
                {item.variant ? ` (${item.variant.name})` : ""} × {item.quantity}
              </span>
              <span>{formatKes((item.variant?.priceOverrideMinor ?? item.listing.priceMinor) * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <Link href="/cart" className="text-brand text-sm font-medium underline-offset-4 hover:underline">
          Change cart
        </Link>
      </section>
      <TrackEvent event="checkout_started" properties={{ items: items.length }} />
      <CheckoutForm
        sellerId={sellerId}
        sellerArea={sellerProfile.location}
        subtotalMinor={subtotal}
        deliveryFeeMinor={deliveryFee}
        defaultPhone={profile?.phone ? `0${profile.phone.replace(/^\+?254/, "")}` : ""}
        hasEmail={Boolean(user.email)}
      />
    </div>
  );
}
