"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nairobiAreas } from "@/config/locations";
import { normaliseKenyanPhone, orderNumber, priceOrder } from "@/lib/orders/pricing";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { listingChanged } from "@/server/listings/cache";
import { runOrderMaintenance } from "@/server/orders/service";
import { assertCan, ForbiddenError } from "@/server/policy/can";
import { getPaymentGateway } from "@/server/payments";
import { PaymentProviderError } from "@/server/payments/types";
import { enforceRateLimit } from "@/server/rate-limit";
import { getSetting } from "@/server/settings";
import { expectedFailure, type ActionResult } from "./result";

/** How long a buyer has to complete payment before the order is cancelled and stock released. */
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

const checkoutSchema = z.object({
  sellerId: z.string().regex(/^[a-z0-9]{20,40}$/i),
  deliveryMethod: z.enum(["PICKUP", "DELIVERY"], { message: "Choose pickup or delivery" }),
  area: z
    .enum(nairobiAreas)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: z.string().trim().max(300, "Keep the address under 300 characters").optional(),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const phone = normaliseKenyanPhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a Kenyan mobile number, like 0712 345 678" });
        return z.NEVER;
      }
      return phone;
    }),
  paymentMethod: z.enum(["MPESA", "CARD"], { message: "Choose how to pay" }),
});

/** Delivery details are checked separately so every problem shows at once, not one at a time. */
function deliveryErrors(form: FormData): Record<string, string> {
  if (form.get("deliveryMethod") !== "DELIVERY") return {};
  const errors: Record<string, string> = {};
  if (!form.get("area")) errors.area = "Choose your area";
  if (String(form.get("address") ?? "").trim().length < 5) errors.address = "Add directions so the seller can find you";
  return errors;
}

class CheckoutError extends Error {}

/**
 * Turns the cart items from one seller into an order, reserves the stock, and starts payment.
 * One order per seller keeps payment, delivery and payouts simple; the cart groups items by seller.
 */
export async function placeOrder(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  let destination: string;
  try {
    const user = await requireUser();
    await enforceRateLimit("checkout", user.id);
    const parsed = checkoutSchema.safeParse(Object.fromEntries(form.entries()));
    const fieldErrors = deliveryErrors(form);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    if (!parsed.success || Object.keys(fieldErrors).length) {
      return { ok: false, error: "Please check the highlighted details.", fieldErrors };
    }
    const input = parsed.data;
    const gateway = getPaymentGateway();
    if (!gateway) return { ok: false, error: "Checkout isn't switched on yet. Please try again soon." };
    if (input.paymentMethod === "CARD" && !user.email) {
      return { ok: false, error: "Add an email address to your account to pay by card, or pay with M-Pesa." };
    }

    // Release stock held by unpaid orders that have run out of time.
    await runOrderMaintenance().catch((error) => console.error("[checkout] maintenance failed", error));

    const [commissionBps, deliveryFee] = await Promise.all([
      getSetting("commission_bps"),
      getSetting("delivery_fee_minor"),
    ]);
    const now = new Date();

    const order = await db.$transaction(async (tx) => {
      const items = await tx.cartItem.findMany({
        where: { cart: { userId: user.id }, listing: { sellerId: input.sellerId } },
        select: {
          id: true,
          quantity: true,
          listingId: true,
          variantId: true,
          listing: { select: { title: true, status: true, priceMinor: true, sellerId: true } },
          variant: { select: { name: true, priceOverrideMinor: true } },
        },
      });
      if (items.length === 0) throw new CheckoutError("Your cart has nothing from this seller.");
      assertCan(user, "view", "listing", { sellerId: input.sellerId, status: "ACTIVE" });
      if (user.sellerProfileId === input.sellerId) throw new CheckoutError("You can't buy your own listings.");

      // Reserve stock atomically: the update only succeeds if enough is left.
      for (const item of items) {
        if (item.listing.status !== "ACTIVE") throw new CheckoutError(`“${item.listing.title}” is no longer for sale.`);
        const reserved = item.variantId
          ? await tx.listingVariant.updateMany({
              where: { id: item.variantId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            })
          : await tx.listing.updateMany({
              where: { id: item.listingId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
        if (reserved.count !== 1)
          throw new CheckoutError(`Not enough of “${item.listing.title}” left. Please update your cart.`);
      }

      const lines = items.map((item) => ({
        listingId: item.listingId,
        variantId: item.variantId,
        titleSnapshot: item.variant ? `${item.listing.title} (${item.variant.name})` : item.listing.title,
        unitPriceMinor: item.variant?.priceOverrideMinor ?? item.listing.priceMinor,
        quantity: item.quantity,
      }));
      const totals = priceOrder(lines, input.deliveryMethod === "DELIVERY" ? deliveryFee : 0, commissionBps);

      let number = orderNumber();
      while (await tx.order.findUnique({ where: { number }, select: { id: true } })) number = orderNumber();

      const created = await tx.order.create({
        data: {
          number,
          buyerId: user.id,
          sellerId: input.sellerId,
          subtotalMinor: totals.subtotalMinor,
          deliveryFeeMinor: totals.deliveryFeeMinor,
          platformFeeMinor: totals.platformFeeMinor,
          totalMinor: totals.totalMinor,
          deliveryMethod: input.deliveryMethod,
          deliveryAddress:
            input.deliveryMethod === "DELIVERY" ? { area: input.area!, directions: input.address! } : undefined,
          buyerPhone: input.phone,
          paymentDueAt: new Date(now.getTime() + PAYMENT_WINDOW_MS),
          items: { create: lines },
          events: { create: { status: "PENDING_PAYMENT", actorId: user.id, note: "Order placed" } },
        },
        select: { id: true, number: true, totalMinor: true, sellerId: true },
      });
      await tx.cartItem.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
      return { ...created, listingIds: [...new Set(items.map((i) => i.listingId))] };
    });

    await audit({
      action: "order.placed",
      actorId: user.id,
      targetType: "order",
      targetId: order.id,
      metadata: { totalMinor: order.totalMinor },
    });
    for (const listingId of order.listingIds) listingChanged({ id: listingId, sellerId: order.sellerId });

    destination = await startPayment(order.id, input.paymentMethod, user.email);
  } catch (error) {
    if (error instanceof CheckoutError) return { ok: false, error: error.message };
    return expectedFailure(error);
  }
  redirect(destination);
}

/** Creates a payment attempt for an unpaid order and returns where to send the buyer next. */
async function startPayment(orderId: string, method: "MPESA" | "CARD", email: string | null): Promise<string> {
  const gateway = getPaymentGateway();
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, number: true, totalMinor: true, buyerPhone: true },
  });
  const reference = `${order.number}-${crypto.randomUUID().slice(0, 8)}`;
  await db.payment.create({
    data: {
      orderId: order.id,
      provider: "PAYSTACK",
      providerReference: reference,
      method,
      amountMinor: order.totalMinor,
    },
  });
  // Paystack needs an email for every charge; M-Pesa-only buyers get a non-deliverable placeholder.
  const payerEmail = email ?? `${order.buyerPhone ?? "buyer"}@mpesa.soko.invalid`;
  try {
    if (method === "CARD") {
      // Send the buyer back to the host they're on (production, a preview, or localhost).
      const h = await headers();
      const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
      const { authorizationUrl } = await gateway!.initializeCardPayment({
        reference,
        email: payerEmail,
        amountMinor: order.totalMinor,
        callbackUrl: `${origin}/checkout/complete`,
      });
      return authorizationUrl;
    }
    await gateway!.chargeMpesa({
      reference,
      email: payerEmail,
      amountMinor: order.totalMinor,
      phone: order.buyerPhone!,
    });
    return `/account/orders/${order.id}?paying=mpesa`;
  } catch (error) {
    await db.payment.update({ where: { providerReference: reference }, data: { status: "FAILED" } });
    if (error instanceof PaymentProviderError) {
      return `/account/orders/${order.id}?payment_error=1`;
    }
    throw error;
  }
}

/** "Try again" on an unpaid order, e.g. after the buyer missed the M-Pesa prompt. */
export async function retryPayment(orderId: string, method: "MPESA" | "CARD"): Promise<ActionResult> {
  let destination: string;
  try {
    const user = await requireUser();
    await enforceRateLimit("checkout", user.id);
    const order = await db.order.findUnique({
      where: {
        id: z
          .string()
          .regex(/^[a-z0-9]{20,40}$/i)
          .parse(orderId),
      },
      select: { id: true, buyerId: true, sellerId: true, status: true, paymentDueAt: true },
    });
    if (!order || order.buyerId !== user.id) throw new ForbiddenError("That order wasn't found.");
    if (order.status !== "PENDING_PAYMENT" || (order.paymentDueAt && order.paymentDueAt < new Date())) {
      return { ok: false, error: "This order can no longer be paid. Please order again." };
    }
    if (method === "CARD" && !user.email) return { ok: false, error: "Add an email address to pay by card." };
    destination = await startPayment(order.id, z.enum(["MPESA", "CARD"]).parse(method), user.email);
  } catch (error) {
    return expectedFailure(error);
  }
  redirect(destination);
}
