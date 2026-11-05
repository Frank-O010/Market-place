"use server";

import { z } from "zod";
import { InvalidTransitionError, type OrderEventType } from "@/lib/orders/state";
import { requireUser, type CurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { applyOrderEvent, OrderConflictError } from "@/server/orders/service";
import { assertCan, ForbiddenError, type Actions } from "@/server/policy/can";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

const id = z.string().regex(/^[a-z0-9]{20,40}$/i);

async function act(
  orderId: string,
  permission: Actions["order"],
  event: OrderEventType,
  extra: { note?: string; trackingNote?: string } = {},
  check?: (user: CurrentUser, order: { buyerId: string | null; sellerId: string }) => void,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await enforceRateLimit("orderUpdate", user.id);
    const order = await db.order.findUnique({
      where: { id: id.parse(orderId) },
      select: { buyerId: true, sellerId: true },
    });
    if (!order) throw new ForbiddenError("That order wasn't found.");
    assertCan(user, permission, "order", order);
    check?.(user, order);
    await applyOrderEvent({ orderId, event, actorId: user.id, ...extra });
    return { ok: true };
  } catch (error) {
    if (error instanceof InvalidTransitionError || error instanceof OrderConflictError) {
      return { ok: false, error: error.message };
    }
    return expectedFailure(error);
  }
}

/** Buyer: cancel an order that hasn't been paid yet. */
export async function cancelUnpaidOrder(orderId: string) {
  return act(
    orderId,
    "cancel",
    "buyer_cancelled",
    { note: "You cancelled the order before paying." },
    (user, order) => {
      if (user.id !== order.buyerId) throw new ForbiddenError();
    },
  );
}

/** Buyer: the item arrived. Releases the payment to the seller. */
export async function confirmDelivery(orderId: string) {
  return act(orderId, "confirm_delivery", "delivery_confirmed", { note: "The buyer confirmed the item arrived." });
}

const trackingSchema = z.string().trim().max(200, "Keep the note under 200 characters");

/** Seller: the item has been sent or handed over. Starts the buyer's confirmation window. */
export async function markShipped(orderId: string, trackingNote: string) {
  const parsed = trackingSchema.safeParse(trackingNote);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]!.message };
  return act(orderId, "update_fulfilment", "shipped", {
    trackingNote: parsed.data || undefined,
    note: parsed.data || undefined,
  });
}

const reasonSchema = z.string().trim().min(3, "Tell the buyer why").max(200);

/** Seller: cancel before shipping. If the buyer already paid, they're refunded in full. */
export async function sellerCancelOrder(orderId: string, reason: string) {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]!.message };
  return act(orderId, "update_fulfilment", "seller_cancelled", { note: `The seller cancelled: ${parsed.data}` });
}
