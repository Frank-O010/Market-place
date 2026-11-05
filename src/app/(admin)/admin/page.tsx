import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { can } from "@/server/policy/can";
import { db } from "@/server/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Admin</h1>
      <div>
        <Button asChild>
          <Link href="/admin/moderation">Open moderation queues</Link>
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <AdminOverview />
      </Suspense>
    </div>
  );
}

async function AdminOverview() {
  const user = await requireUserOrRedirect("/admin");
  // Non-staff get a 404, not a 403, so the admin area's existence isn't confirmed to them.
  if (!can(user, "view_admin", "platform", {})) notFound();

  const [users, sellers, activeListings, openReports] = await Promise.all([
    db.user.count({ where: { status: { not: "DELETED" } } }),
    db.sellerProfile.count(),
    db.listing.count({ where: { status: "ACTIVE" } }),
    db.report.count({ where: { status: "OPEN" } }),
  ]);

  return (
    <div className="grid gap-4 sm:grid-cols-4" data-testid="admin-stats">
      {[
        ["Users", users],
        ["Sellers", sellers],
        ["Active listings", activeListings],
        ["Open reports", openReports],
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
