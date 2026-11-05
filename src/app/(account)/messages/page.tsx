import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { listConversations } from "@/server/queries/messages";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(
    date,
  );

export default function MessagesPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl font-bold">Messages</h1>
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <Inbox />
      </Suspense>
    </div>
  );
}

async function Inbox() {
  const user = await requireUserOrRedirect("/messages");
  const conversations = await listConversations(user);
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageCircle />}
        title="No messages yet"
        description="Questions about an item? Tap “Message seller” on any listing."
        action={
          <Button asChild>
            <Link href="/search">Browse items</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="divide-border border-border divide-y rounded-lg border" data-testid="conversation-list">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            href={`/messages/${c.id}`}
            className="hover:bg-surface-muted flex min-h-11 flex-col gap-0.5 p-4 focus-visible:outline-offset-[-2px]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className={cn("truncate", c.unread && "font-bold")}>
                {c.otherName}
                {c.unread && <span className="sr-only"> (unread)</span>}
              </span>
              <span className="text-muted shrink-0 text-xs">{when(c.lastMessageAt)}</span>
            </span>
            {c.listingTitle && <span className="text-muted truncate text-sm">About: {c.listingTitle}</span>}
            <span className={cn("truncate text-sm", c.unread ? "text-foreground" : "text-muted")}>
              {c.lastMessage ?? "No messages yet"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
