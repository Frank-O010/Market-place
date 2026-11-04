import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">My account</h1>
      <Suspense fallback={<Skeleton className="h-40 w-full max-w-xl" />}>
        <AccountDetails />
      </Suspense>
    </div>
  );
}

async function AccountDetails() {
  const user = await requireUserOrRedirect("/account");
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
        <CardDescription>{user.email ?? "No email on file"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm font-medium">Roles</p>
        <p className="flex flex-wrap gap-1" data-testid="account-roles">
          {user.roles.map((role) => (
            <Badge key={role} variant="brand">
              {role.toLowerCase()}
            </Badge>
          ))}
        </p>
        <p className="pt-2 text-sm">
          <Link href="/account/saved" className="text-brand font-medium underline-offset-4 hover:underline">
            Saved items
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
