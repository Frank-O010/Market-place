import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Store } from "lucide-react";
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
  // Seller onboarding (profile, phone verification, payout details) is built in Phase 2.
  if (!user.roles.includes("SELLER") || !user.sellerProfileId) {
    return (
      <EmptyState
        icon={<Store />}
        title="Become a seller"
        description="Seller onboarding opens in the next release. You'll set up your shop profile, verify your phone and add M-Pesa payout details."
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
    <div className="grid gap-4 sm:grid-cols-3" data-testid="seller-stats">
      {[
        ["Active listings", count("ACTIVE")],
        ["Drafts", count("DRAFT")],
        ["Sold", count("SOLD")],
      ].map(([label, value]) => (
        <Card key={label}>
          <CardHeader>
            <CardTitle className="text-muted text-sm font-medium">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
