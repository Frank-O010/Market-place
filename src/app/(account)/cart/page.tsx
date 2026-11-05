import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ShoppingCart } from "lucide-react";
import { imageUrl } from "@/lib/images";
import { formatKes } from "@/lib/money";
import { listingPath, sellerPath } from "@/lib/urls";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { CartQuantity } from "@/components/orders/cart-quantity";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Cart />
      </Suspense>
    </div>
  );
}

async function Cart() {
  const user = await requireUserOrRedirect("/cart");
  const items = await db.cartItem.findMany({
    where: { cart: { userId: user.id } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      quantity: true,
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          priceMinor: true,
          stock: true,
          seller: { select: { id: true, slug: true, displayName: true } },
          images: { where: { status: "READY" }, orderBy: { position: "asc" }, take: 1, select: { storageKey: true } },
        },
      },
      variant: { select: { name: true, priceOverrideMinor: true, stock: true } },
    },
  });
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Your cart is empty"
        description="Find something you like and add it here."
        action={
          <Button asChild>
            <Link href="/">Browse listings</Link>
          </Button>
        }
      />
    );
  }

  // One checkout per seller: each seller ships and gets paid separately.
  const bySeller = new Map<string, { seller: (typeof items)[number]["listing"]["seller"]; items: typeof items }>();
  for (const item of items) {
    const group = bySeller.get(item.listing.seller.id) ?? { seller: item.listing.seller, items: [] };
    group.items.push(item);
    bySeller.set(item.listing.seller.id, group);
  }

  return (
    <div className="flex flex-col gap-4">
      {bySeller.size > 1 && (
        <p className="text-muted text-sm">
          Your cart has items from {bySeller.size} sellers. You check out with each seller separately.
        </p>
      )}
      {[...bySeller.values()].map(({ seller, items: group }) => {
        const unavailable = group.filter(
          (i) => i.listing.status !== "ACTIVE" || i.quantity > (i.variant ? i.variant.stock : i.listing.stock),
        );
        const subtotal = group.reduce(
          (sum, i) => sum + (i.variant?.priceOverrideMinor ?? i.listing.priceMinor) * i.quantity,
          0,
        );
        return (
          <section key={seller.id} aria-labelledby={`seller-${seller.id}`}>
            <Card>
              <CardHeader>
                <CardTitle as="h2" id={`seller-${seller.id}`}>
                  From{" "}
                  <Link href={sellerPath(seller.slug)} className="underline-offset-4 hover:underline">
                    {seller.displayName}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="divide-border divide-y">
                  {group.map((item) => {
                    const title = item.variant ? `${item.listing.title} (${item.variant.name})` : item.listing.title;
                    const price = item.variant?.priceOverrideMinor ?? item.listing.priceMinor;
                    const cover = item.listing.images[0];
                    const problem = unavailable.includes(item);
                    return (
                      <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="bg-surface-muted size-16 shrink-0 overflow-hidden rounded-md">
                          {cover && (
                            // eslint-disable-next-line @next/next/no-img-element -- thumbnail size is pre-generated
                            <img src={imageUrl(cover.storageKey, "thumb")} alt="" className="size-full object-cover" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <Link
                            href={listingPath(item.listing)}
                            className="truncate font-medium underline-offset-4 hover:underline"
                          >
                            {title}
                          </Link>
                          <span className="text-muted text-sm">{formatKes(price)} each</span>
                          {problem && (
                            <span className="text-danger text-sm">
                              {item.listing.status !== "ACTIVE"
                                ? "No longer for sale. Please remove it."
                                : "Not enough left. Lower the quantity."}
                            </span>
                          )}
                        </div>
                        <CartQuantity itemId={item.id} quantity={item.quantity} title={title} />
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    Subtotal <strong>{formatKes(subtotal)}</strong>
                  </p>
                  {unavailable.length ? (
                    <Button disabled>Fix the items above to check out</Button>
                  ) : (
                    <Button asChild size="lg">
                      <Link href={`/checkout?seller=${seller.id}`}>Check out with {seller.displayName}</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        );
      })}
    </div>
  );
}
