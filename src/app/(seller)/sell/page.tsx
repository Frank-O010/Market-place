import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Store } from "lucide-react";
import { sellerPath } from "@/lib/urls";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sell", robots: { index: false } };

export default function SellPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Seller dashboard</h1>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <SellerHome />
      </Suspense>
    </div>
  );
}

async function SellerHome() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <EmptyState
        icon={<Store />}
        title="Sell to buyers across Nairobi"
        description="Create a free account to list your first item. Payment is held safely until the buyer confirms delivery."
        action={
          <Button asChild>
            <Link href="/sign-in?redirect_url=/sell">Sign in to start selling</Link>
          </Button>
        }
      />
    );
  }
  if (!user.roles.includes("SELLER") || !user.sellerProfileId) {
    return (
      <EmptyState
        icon={<Store />}
        title="Open your shop"
        description="Set up your shop name and location, then list your first item. It's free to list."
        action={
          <Button asChild>
            <Link href="/sell/onboarding">Set up my shop</Link>
          </Button>
        }
      />
    );
  }

  // Scoped to the signed-in seller's own profile; never trust a seller id from the URL.
  const counts = await db.listing.groupBy({
    by: ["status"],
    where: { sellerId: user.sellerProfileId },
    _count: true,
  });
  const count = (status: string) => counts.find((c) => c.status === status)?._count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/sell/listings/new">
            <Plus aria-hidden /> List an item
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/sell/listings">My listings</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/sell/orders">Orders</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/sell/payouts">Payouts</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/sell/onboarding">Shop details</Link>
        </Button>
        {user.sellerSlug && (
          <Button asChild variant="ghost">
            <Link href={sellerPath(user.sellerSlug)}>View my shop</Link>
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-4" data-testid="seller-stats">
        {(
          [
            ["Active listings", "ACTIVE"],
            ["Drafts", "DRAFT"],
            ["Paused", "PAUSED"],
            ["Sold", "SOLD"],
          ] as const
        ).map(([label, status]) => (
          <Link key={status} href={`/sell/listings?status=${status}`} className="rounded-lg">
            <Card className="hover:bg-surface-muted h-full">
              <CardHeader>
                <CardTitle className="text-muted text-sm font-medium">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{count(status)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
