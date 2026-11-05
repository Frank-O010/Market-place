import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { AdminNav, pageParam, textParam, when } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Users", robots: { index: false, follow: false } };

const PER_PAGE = 25;
const roles = ["BUYER", "SELLER", "MODERATOR", "ADMIN"] as const;

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Users</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStaffPage("/admin/users");
  const params = await searchParams;
  const q = textParam(params.q);
  const role = roles.find((r) => r === params.role);
  const page = pageParam(params.page);
  const where: Prisma.UserWhereInput = {
    status: params.status === "SUSPENDED" ? "SUSPENDED" : { not: "DELETED" },
    ...(role && { roles: { has: role } }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q.replace(/\D/g, "") || q } },
        { sellerProfile: { displayName: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        status: true,
        createdAt: true,
        sellerProfile: { select: { displayName: true } },
      },
    }),
  ]);
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (role) s.set("role", role);
    if (params.status === "SUSPENDED") s.set("status", "SUSPENDED");
    if (p > 1) s.set("page", String(p));
    return `/admin/users${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminNav current="/admin/users" isAdmin={can(user, "manage_settings", "platform", {})} />
      <form role="search" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-q">Name, email, phone or shop</Label>
          <Input id="user-q" name="q" type="search" defaultValue={q} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-role">Role</Label>
          <NativeSelect id="user-role" name="role" defaultValue={role ?? ""}>
            <option value="">Any role</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-status">Status</Label>
          <NativeSelect id="user-status" name="status" defaultValue={params.status === "SUSPENDED" ? "SUSPENDED" : ""}>
            <option value="">Active and suspended</option>
            <option value="SUSPENDED">Suspended only</option>
          </NativeSelect>
        </div>
        <Button type="submit">Search</Button>
      </form>
      <p className="text-muted text-sm" aria-live="polite">
        {total} {total === 1 ? "person" : "people"}
      </p>
      <ul className="divide-y rounded-md border" data-testid="admin-users">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <Link
                href={`/admin/users/${u.id}`}
                className="inline-block min-h-6 font-medium underline-offset-2 hover:underline"
              >
                {u.name}
              </Link>
              <p className="text-muted truncate text-sm">
                {u.email ?? "No email"}
                {u.sellerProfile && ` · ${u.sellerProfile.displayName}`} · joined {when(u.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {u.status === "SUSPENDED" && <Badge variant="danger">Suspended</Badge>}
              {u.roles
                .filter((r) => r !== "BUYER")
                .map((r) => (
                  <Badge key={r} variant={r === "ADMIN" || r === "MODERATOR" ? "brand" : "neutral"}>
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </Badge>
                ))}
            </div>
          </li>
        ))}
        {users.length === 0 && <li className="text-muted p-3">Nobody matches that search.</li>}
      </ul>
      <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} hrefForPage={href} />
    </>
  );
}
