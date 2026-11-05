"use server";

import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

const id = z.string().regex(/^[a-z0-9]{20,40}$/i);
const quantity = z.coerce.number().int().min(1).max(99);

/** Adds an item (or more of it) to the signed-in buyer's cart. Stock is checked again at checkout. */
export async function addToCart(input: {
  listingId: string;
  variantId?: string | null;
  quantity?: number;
}): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await enforceRateLimit("cart", user.id);
    const listingId = id.parse(input.listingId);
    const variantId = input.variantId ? id.parse(input.variantId) : null;
    const qty = quantity.parse(input.quantity ?? 1);

    const listing = await db.listing.findUnique({
      where: { id: listingId },
      select: { status: true, stock: true, sellerId: true, variants: { select: { id: true, stock: true } } },
    });
    if (!listing || listing.status !== "ACTIVE") return { ok: false, error: "This item is no longer for sale." };
    if (user.sellerProfileId && listing.sellerId === user.sellerProfileId) {
      return { ok: false, error: "You can't buy your own listing." };
    }
    if (listing.variants.length && !variantId) return { ok: false, error: "Choose an option first." };
    const variant = variantId ? listing.variants.find((v) => v.id === variantId) : null;
    if (variantId && !variant) return { ok: false, error: "That option isn't available." };
    const available = variant ? variant.stock : listing.stock;

    const cart = await db.cart.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true },
    });
    const existing = await db.cartItem.findFirst({ where: { cartId: cart.id, listingId, variantId } });
    const nextQty = (existing?.quantity ?? 0) + qty;
    if (nextQty > available) {
      return { ok: false, error: available > 0 ? `Only ${available} left.` : "This item is sold out." };
    }
    if (existing) await db.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQty } });
    else await db.cartItem.create({ data: { cartId: cart.id, listingId, variantId, quantity: qty } });
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}

export async function updateCartItem(itemId: string, nextQuantity: number): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await enforceRateLimit("cart", user.id);
    // Scoped to the user's own cart: another user's item id simply isn't found.
    const item = await db.cartItem.findFirst({
      where: { id: id.parse(itemId), cart: { userId: user.id } },
      select: { id: true },
    });
    if (!item) return { ok: false, error: "That item isn't in your cart." };
    if (nextQuantity <= 0) await db.cartItem.delete({ where: { id: item.id } });
    else await db.cartItem.update({ where: { id: item.id }, data: { quantity: quantity.parse(nextQuantity) } });
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}
