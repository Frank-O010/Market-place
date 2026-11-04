import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { devToggleRole } from "@/server/actions/dev-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Switch roles" };

const toggleable = [
  { role: "SELLER", description: "List items and see the seller dashboard." },
  { role: "MODERATOR", description: "Review reported content and new sellers' listings." },
  { role: "ADMIN", description: "Manage users, settings and payouts." },
] as const;

export default function DevRolesPage() {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle as="h1">Switch your roles</CardTitle>
        <CardDescription>
          Dev only. Everyone keeps the buyer role. Changes are written to the audit log.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <RoleToggles />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function RoleToggles() {
  const user = await requireUserOrRedirect("/dev/roles");
  return (
    <ul className="flex flex-col gap-3">
      {toggleable.map(({ role, description }) => {
        const active = user.roles.includes(role);
        return (
          <li key={role} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium capitalize">{role.toLowerCase()}</p>
              <p className="text-muted text-sm">{description}</p>
            </div>
            <form action={devToggleRole}>
              <input type="hidden" name="role" value={role} />
              <Button type="submit" variant={active ? "primary" : "secondary"} size="sm" aria-pressed={active}>
                {active ? "On" : "Off"}
                <span className="sr-only"> {role.toLowerCase()} role</span>
              </Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
