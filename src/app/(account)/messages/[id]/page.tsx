import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatKes } from "@/lib/money";
import { listingPath, sellerPath } from "@/lib/urls";
import { requireUserOrRedirect } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { loadConversation } from "@/server/queries/messages";
import { Composer, ConversationPoller } from "@/components/messages/composer";
import { ReportButton } from "@/components/trust/report-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };

const time = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(date);

export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserOrRedirect(`/messages/${id}`);
  const conversation = await loadConversation(user, id);
  if (!conversation) notFound();
  const asBuyer = conversation.buyerId === user.id;
  const participant = asBuyer || conversation.sellerId === user.sellerProfileId;
  const otherName = asBuyer ? conversation.seller.displayName : conversation.buyer.name;

  // Opening the conversation marks it, and its notifications, as read.
  if (participant) {
    const now = new Date();
    await db.conversation.update({
      where: { id: conversation.id },
      data: asBuyer ? { buyerLastReadAt: now } : { sellerLastReadAt: now },
    });
    await db.notification.updateMany({
      where: {
        userId: user.id,
        type: "message.new",
        readAt: null,
        payload: { path: ["url"], equals: `/messages/${conversation.id}` },
      },
      data: { readAt: now },
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <ConversationPoller />
      <Link href="/messages" className="text-brand inline-flex min-h-11 items-center gap-1 text-sm font-medium">
        <ArrowLeft className="size-4" aria-hidden /> All messages
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {asBuyer ? (
            <Link href={sellerPath(conversation.seller.slug)} className="underline-offset-4 hover:underline">
              {otherName}
            </Link>
          ) : (
            otherName
          )}
        </h1>
        {conversation.listing && (
          <p className="text-muted text-sm">
            About{" "}
            <Link href={listingPath(conversation.listing)} className="text-foreground underline underline-offset-4">
              {conversation.listing.title}
            </Link>{" "}
            · {formatKes(conversation.listing.priceMinor)}
          </p>
        )}
      </div>
      <p className="bg-brand-subtle flex gap-2 rounded-md p-3 text-sm">
        <ShieldCheck className="text-brand mt-0.5 size-5 shrink-0" aria-hidden />
        Keep chats and payments on Soko. Your money is only protected when you pay through Soko.
      </p>

      <ol className="flex flex-col gap-3" aria-label="Messages" data-testid="message-list">
        {conversation.messages.length === 0 && <li className="text-muted text-sm">Say hello and ask your question.</li>}
        {conversation.messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-line",
                  mine ? "bg-brand text-brand-foreground" : "bg-surface-muted",
                )}
              >
                <span className="sr-only">{mine ? "You" : otherName}: </span>
                {m.hiddenAt ? <em>This message was removed by a moderator.</em> : m.body}
              </div>
              {m.flagged && !m.hiddenAt && !mine && (
                <p className="flex items-center gap-1 text-xs">
                  <ShieldAlert className="size-4" aria-hidden /> Contains contact details. Pay through Soko to stay
                  protected.
                </p>
              )}
              <span className="text-muted flex items-center gap-2 text-xs">
                {time(m.createdAt)}
                {!mine && !m.hiddenAt && participant && (
                  <ReportButton targetType="MESSAGE" targetId={m.id} signedIn compact />
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {participant ? (
        <Composer conversationId={conversation.id} />
      ) : (
        <p className="text-muted text-sm">You&apos;re viewing this conversation as a moderator.</p>
      )}
    </div>
  );
}
