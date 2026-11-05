import { Suspense } from "react";
import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { AdminNav, pageParam, textParam, when } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Audit log", robots: { index: false, follow: false } };

const PER_PAGE = 50;

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Audit log</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Audit searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaffPage("/admin/audit", "admin");
  const params = await searchParams;
  const action = textParam(params.action, 60);
  const actor = textParam(params.actor);
  const target = textParam(params.target, 40);
  const page = pageParam(params.page);
  const where: Prisma.AuditLogWhereInput = {
    ...(action && { action: { startsWith: action } }),
    ...(target && { targetId: target }),
    ...(actor && {
      actor: {
        OR: [{ name: { contains: actor, mode: "insensitive" } }, { email: { contains: actor, mode: "insensitive" } }],
      },
    }),
  };
  const [total, entries] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        ip: true,
        metadata: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
  ]);
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (action) s.set("action", action);
    if (actor) s.set("actor", actor);
    if (target) s.set("target", target);
    if (p > 1) s.set("page", String(p));
    return `/admin/audit${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <AdminNav current="/admin/audit" isAdmin />
      <p className="text-muted text-sm">
        Every admin action, role change and money movement. Entries can&apos;t be edited or deleted from the app.
      </p>
      <form role="search" className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-action">Action starts with</Label>
          <Input id="audit-action" name="action" defaultValue={action} placeholder="e.g. settings." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-actor">Done by (name or email)</Label>
          <Input id="audit-actor" name="actor" defaultValue={actor} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-target">Target id</Label>
          <Input id="audit-target" name="target" defaultValue={target} />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <p className="text-muted text-sm" aria-live="polite">
        {total} {total === 1 ? "entry" : "entries"}
      </p>
      <div className="overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label="Audit log entries">
        <table className="w-full text-left text-sm" data-testid="audit-log">
          <caption className="sr-only">Audit log entries, newest first</caption>
          <thead className="bg-surface-muted">
            <tr>
              <th scope="col" className="p-2">
                When
              </th>
              <th scope="col" className="p-2">
                Action
              </th>
              <th scope="col" className="p-2">
                By
              </th>
              <th scope="col" className="p-2">
                Target
              </th>
              <th scope="col" className="p-2">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="p-2 whitespace-nowrap">{when(e.createdAt)}</td>
                <td className="p-2">
                  <code>{e.action}</code>
                </td>
                <td className="p-2">{e.actor?.name ?? "System"}</td>
                <td className="p-2 break-all">{e.targetType ? `${e.targetType} ${e.targetId ?? ""}` : "–"}</td>
                <td className="text-muted max-w-xs p-2 break-all">
                  {e.metadata && typeof e.metadata === "object" && Object.keys(e.metadata).length > 0
                    ? JSON.stringify(e.metadata)
                    : ""}
                  {e.ip && ` · ${e.ip}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length === 0 && <p className="text-muted">No entries match.</p>}
      <Pagination page={page} totalPages={Math.ceil(total / PER_PAGE)} hrefForPage={href} />
    </>
  );
}
