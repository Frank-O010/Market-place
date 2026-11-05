import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { readNotificationPrefs } from "@/lib/trust/schemas";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import type { InAppPayload } from "@/server/notifications";
import { NotificationPrefsForm } from "@/components/trust/notification-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(
    date,
  );

export default function NotificationsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Notifications</h1>
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <Notifications />
      </Suspense>
    </div>
  );
}

async function Notifications() {
  const user = await requireUserOrRedirect("/notifications");
  const [items, me] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, payload: true, readAt: true, createdAt: true },
    }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { notificationPrefs: true, phone: true } }),
  ]);
  // Seeing the list counts as reading it; the bold "new" styling below uses the state before this.
  if (items.some((n) => !n.readAt)) {
    await db.notification.updateMany({
      where: { id: { in: items.filter((n) => !n.readAt).map((n) => n.id) } },
      data: { readAt: new Date() },
    });
  }
  return (
    <>
      {items.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="You're all caught up"
          description="Order updates and messages show up here."
        />
      ) : (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <h2 id="recent-heading" className="text-xl font-semibold">
            Recent
          </h2>
          <ul className="divide-border border-border divide-y rounded-lg border" data-testid="notification-list">
            {items.map((n) => {
              const p = n.payload as InAppPayload;
              return (
                <li key={n.id}>
                  <Link href={p.url} className="hover:bg-surface-muted flex min-h-11 flex-col gap-0.5 p-4">
                    <span className={cn(!n.readAt && "font-bold")}>
                      {!n.readAt && <span className="sr-only">New: </span>}
                      {p.title}
                    </span>
                    {p.body && <span className="text-muted text-sm">{p.body}</span>}
                    <span className="text-muted text-xs">{when(n.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section aria-labelledby="settings-heading" className="flex flex-col gap-3">
        <h2 id="settings-heading" className="text-xl font-semibold">
          Settings
        </h2>
        <NotificationPrefsForm prefs={readNotificationPrefs(me.notificationPrefs)} hasPhone={Boolean(me.phone)} />
      </section>
    </>
  );
}
