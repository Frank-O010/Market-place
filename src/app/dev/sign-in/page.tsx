import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/server/db";
import { devSignIn } from "@/server/actions/dev-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DevSignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Dev sign-in" };

export default function DevSignInPage(props: PageProps<"/dev/sign-in">) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle as="h1">Sign in as a seeded user</CardTitle>
          <CardDescription>
            Local sign-in for development. Production uses Clerk (email, phone OTP and Google).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <UserList searchParams={props.searchParams} />
          </Suspense>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Create a new account</CardTitle>
          <CardDescription>New accounts start as buyers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <SignUpSection searchParams={props.searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function redirectTarget(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const value = (await searchParams).redirect_url;
  return typeof value === "string" && value.startsWith("/") ? value : "/";
}

async function SignUpSection({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DevSignUpForm redirectTo={await redirectTarget(searchParams)} />;
}

async function UserList({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const redirectTo = await redirectTarget(searchParams);
  const users = await db.user.findMany({
    where: { status: { not: "DELETED" } },
    orderBy: [{ createdAt: "asc" }],
    take: 30,
    select: { id: true, name: true, email: true, roles: true, status: true },
  });
  return (
    <ul className="divide-border flex flex-col divide-y">
      {users.map((user) => (
        <li key={user.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name}</p>
            <p className="flex flex-wrap gap-1 pt-1">
              {user.roles.map((role) => (
                <Badge key={role} variant={role === "BUYER" ? "neutral" : "brand"}>
                  {role.toLowerCase()}
                </Badge>
              ))}
              {user.status === "SUSPENDED" && <Badge variant="danger">suspended</Badge>}
            </p>
          </div>
          <form action={devSignIn}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button type="submit" variant="secondary" size="sm" aria-label={`Sign in as ${user.name}`}>
              Sign in
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
