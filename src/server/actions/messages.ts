"use server";

import { redirect } from "next/navigation";
import { describeContactDetails, findContactDetails } from "@/lib/messages/contact-details";
import { idSchema, messageSchema } from "@/lib/trust/schemas";
import { absoluteUrl } from "@/lib/urls";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { layout } from "@/server/email/render";
import { notify } from "@/server/notifications";
import { assertCan, ForbiddenError } from "@/server/policy/can";
import { hasPaidOrderBetween } from "@/server/queries/messages";
import { enforceRateLimit } from "@/server/rate-limit";
import { turnstileEnabled, verifyTurnstile } from "@/server/turnstile";
import { expectedFailure, type ActionResult } from "./result";

/** "Message seller" on a listing: opens (or reuses) the conversation about that listing. */
export async function startConversation(listingId: string): Promise<ActionResult> {
  let conversationId: string;
  try {
    const user = await requireUser();
    const listing = await db.listing.findUnique({
      where: { id: idSchema.parse(listingId) },
      select: { id: true, sellerId: true, status: true },
    });
    if (!listing || (listing.status !== "ACTIVE" && listing.status !== "SOLD")) {
      return { ok: false, error: "This listing isn't available." };
    }
    if (user.sellerProfileId === listing.sellerId) return { ok: false, error: "This is your own listing." };
    const conversation = await db.conversation.upsert({
      where: { buyerId_sellerId_listingId: { buyerId: user.id, sellerId: listing.sellerId, listingId: listing.id } },
      create: { buyerId: user.id, sellerId: listing.sellerId, listingId: listing.id },
      update: {},
      select: { id: true },
    });
    conversationId = conversation.id;
  } catch (error) {
    return expectedFailure(error);
  }
  redirect(`/messages/${conversationId}`);
}

/** "Message the seller/buyer" on an order: the conversation about the order's first item. */
export async function startOrderConversation(orderId: string): Promise<ActionResult> {
  let conversationId: string;
  try {
    const user = await requireUser();
    const order = await db.order.findUnique({
      where: { id: idSchema.parse(orderId) },
      select: { id: true, buyerId: true, sellerId: true, items: { select: { listingId: true }, take: 1 } },
    });
    if (!order?.buyerId) throw new ForbiddenError("That order wasn't found.");
    const isParty = order.buyerId === user.id || order.sellerId === user.sellerProfileId;
    if (!isParty) throw new ForbiddenError("That order wasn't found.");
    const listingId = order.items[0]?.listingId ?? null;
    const existing = await db.conversation.findFirst({
      where: { buyerId: order.buyerId, sellerId: order.sellerId, listingId },
      select: { id: true },
    });
    const conversation = existing
      ? await db.conversation.update({ where: { id: existing.id }, data: { orderId: order.id }, select: { id: true } })
      : await db.conversation.create({
          data: { buyerId: order.buyerId, sellerId: order.sellerId, listingId, orderId: order.id },
          select: { id: true },
        });
    conversationId = conversation.id;
  } catch (error) {
    return expectedFailure(error);
  }
  redirect(`/messages/${conversationId}`);
}

export type SendMessageResult =
  ActionResult | { ok: false; contactWarning: string; error: string } | { ok: false; challenge: true; error: string };

/**
 * Sends a message. If it contains contact details and the buyer hasn't paid for an order from
 * this seller, the first attempt returns a warning; sending again with confirmContact goes
 * through and marks the message so the other person sees a safety note.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
  confirmContact = false,
  turnstileToken?: string,
): Promise<SendMessageResult> {
  try {
    const user = await requireUser();
    const parsed = messageSchema.safeParse({ body });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Write a message" };
    const conversation = await db.conversation.findUnique({
      where: { id: idSchema.parse(conversationId) },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        seller: { select: { userId: true, displayName: true } },
        buyer: { select: { name: true } },
        listing: { select: { title: true } },
      },
    });
    if (!conversation) throw new ForbiddenError("That conversation wasn't found.");
    assertCan(user, "send_message", "conversation", conversation);
    await enforceRateLimit("message", user.id);

    const kinds = findContactDetails(parsed.data.body);
    const protectedDeal = kinds.length > 0 && !(await hasPaidOrderBetween(conversation.buyerId, conversation.sellerId));
    if (protectedDeal && !confirmContact) {
      return {
        ok: false,
        error: "Your message contains contact details.",
        contactWarning: `Your message includes ${describeContactDetails(kinds)}. If you agree a deal outside Soko, your payment isn't protected and we can't help if something goes wrong. Pay through Soko to stay safe.`,
      };
    }

    // Bot check on an account's very first message, where spam accounts start.
    if (turnstileEnabled() && (await db.message.count({ where: { senderId: user.id }, take: 1 })) === 0) {
      if (!turnstileToken) return { ok: false, challenge: true, error: "Please confirm you're a person first." };
      if (!(await verifyTurnstile(turnstileToken)))
        return { ok: false, challenge: true, error: "That check didn't work. Please try it again." };
    }

    const now = new Date();
    const fromBuyer = user.id === conversation.buyerId;
    await db.$transaction([
      db.message.create({
        data: { conversationId: conversation.id, senderId: user.id, body: parsed.data.body, flagged: protectedDeal },
      }),
      db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: now, ...(fromBuyer ? { buyerLastReadAt: now } : { sellerLastReadAt: now }) },
      }),
    ]);

    const recipientId = fromBuyer ? conversation.seller.userId : conversation.buyerId;
    const senderName = fromBuyer ? conversation.buyer.name : conversation.seller.displayName;
    const url = `/messages/${conversation.id}`;
    // One notification per burst: skip if the recipient already has an unread one for this chat.
    const recent = await db.notification.count({
      where: {
        userId: recipientId,
        type: "message.new",
        channel: "IN_APP",
        readAt: null,
        createdAt: { gte: new Date(now.getTime() - 15 * 60_000) },
        payload: { path: ["url"], equals: url },
      },
    });
    if (recent === 0) {
      const about = conversation.listing ? ` about “${conversation.listing.title}”` : "";
      await notify({
        userId: recipientId,
        type: "message.new",
        inApp: { title: `New message from ${senderName}`, body: parsed.data.body.slice(0, 140), url },
        email: {
          pref: "messageEmail",
          subject: `New message from ${senderName}`,
          ...layout({
            heading: `${senderName} sent you a message${about}`,
            paragraphs: ["Reply in Soko so your deal stays protected."],
            action: { label: "Read and reply", url: absoluteUrl(url) },
          }),
        },
      });
    }
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}
