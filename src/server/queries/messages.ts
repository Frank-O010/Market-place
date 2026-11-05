import "server-only";
import type { CurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";

const PAID_STATUSES = ["PAID_HELD", "SHIPPED", "DELIVERED", "COMPLETED", "DISPUTED"] as const;

/** Conversations the user takes part in, as buyer or as seller, newest first. */
export async function listConversations(user: CurrentUser) {
  const or = [{ buyerId: user.id }, ...(user.sellerProfileId ? [{ sellerId: user.sellerProfileId }] : [])];
  const conversations = await db.conversation.findMany({
    where: { OR: or },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      lastMessageAt: true,
      buyerLastReadAt: true,
      sellerLastReadAt: true,
      buyer: { select: { name: true } },
      seller: { select: { displayName: true } },
      listing: { select: { title: true } },
      messages: {
        where: { hiddenAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, senderId: true, createdAt: true },
      },
    },
  });
  return conversations.map((c) => {
    const asBuyer = c.buyerId === user.id;
    const lastRead = asBuyer ? c.buyerLastReadAt : c.sellerLastReadAt;
    const last = c.messages[0];
    return {
      id: c.id,
      otherName: asBuyer ? c.seller.displayName : c.buyer.name,
      role: asBuyer ? ("buyer" as const) : ("seller" as const),
      listingTitle: c.listing?.title ?? null,
      lastMessage: last?.body ?? null,
      lastMessageAt: c.lastMessageAt,
      unread: !!last && last.senderId !== user.id && (!lastRead || lastRead < last.createdAt),
    };
  });
}

export async function unreadConversationCount(user: CurrentUser) {
  const list = await listConversations(user);
  return list.filter((c) => c.unread).length;
}

/** A conversation with its messages, if the user may see it; otherwise null. */
export async function loadConversation(user: CurrentUser, id: string) {
  if (!/^[a-z0-9]{20,40}$/i.test(id)) return null;
  const conversation = await db.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      orderId: true,
      buyer: { select: { name: true } },
      seller: { select: { displayName: true, slug: true, userId: true } },
      listing: { select: { id: true, title: true, slug: true, priceMinor: true, status: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 300,
        select: { id: true, body: true, senderId: true, flagged: true, hiddenAt: true, createdAt: true },
      },
    },
  });
  if (!conversation || !can(user, "view", "conversation", conversation)) return null;
  return conversation;
}

/** Whether the buyer has a paid order from this seller (contact details are then fine to share). */
export async function hasPaidOrderBetween(buyerId: string, sellerId: string) {
  const count = await db.order.count({ where: { buyerId, sellerId, status: { in: [...PAID_STATUSES] } } });
  return count > 0;
}
