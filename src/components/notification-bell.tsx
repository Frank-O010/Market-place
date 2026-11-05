import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/server/auth/current-user";
import { unreadNotificationCount } from "@/server/notifications";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bell with the unread count. Reads the session, so render inside <Suspense>. */
export async function NotificationBell() {
  const user = await getCurrentUser();
  if (!user) return null;
  const count = await unreadNotificationCount(user.id);
  const label = count ? `Notifications, ${count} unread` : "Notifications";
  return (
    <Link
      href="/notifications"
      aria-label={label}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
    >
      <Bell aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          data-testid="notification-count"
          className="bg-danger text-danger-foreground absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
