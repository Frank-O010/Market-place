"use server";

import { idSchema, reviewSchema, sellerReplySchema } from "@/lib/trust/schemas";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import { assertCan, ForbiddenError } from "@/server/policy/can";
import { enforceRateLimit } from "@/server/rate-limit";
import { refreshSellerRating } from "@/server/reviews";
import { expectedFailure, type ActionResult } from "./result";

/** Buyer: one review per completed order. */
export async function createReview(orderId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const order = await db.order.findUnique({
      where: { id: idSchema.parse(orderId) },
      select: {
        id: true,
        number: true,
        status: true,
        buyerId: true,
        sellerId: true,
        review: { select: { id: true } },
        seller: { select: { userId: true } },
      },
    });
    if (!order) throw new ForbiddenError("That order wasn't found.");
    assertCan(user, "create", "review", { authorId: user.id, order });
    if (order.status !== "COMPLETED") return { ok: false, error: "You can review an order once it's completed." };
    if (order.review) return { ok: false, error: "You've already reviewed this order." };
    await enforceRateLimit("review", user.id);
    const parsed = reviewSchema.safeParse({ rating: form.get("rating"), body: form.get("body") ?? "" });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      return { ok: false, error: "Please check the highlighted details.", fieldErrors };
    }
    const review = await db.review.create({
      data: {
        orderId: order.id,
        authorId: user.id,
        sellerId: order.sellerId,
        rating: parsed.data.rating,
        body: parsed.data.body || null,
      },
      select: { id: true },
    });
    await refreshSellerRating(order.sellerId);
    await audit({ action: "review.created", actorId: user.id, targetType: "review", targetId: review.id });
    await notify({
      userId: order.seller.userId,
      type: "review.new",
      inApp: {
        title: `New ${parsed.data.rating}-star review`,
        body: `For order ${order.number}. You can reply publicly.`,
        url: `/sell/orders/${order.id}`,
      },
    });
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}

/** Seller: one public reply per review. */
export async function replyToReview(
  reviewId: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const review = await db.review.findUnique({
      where: { id: idSchema.parse(reviewId) },
      select: {
        id: true,
        authorId: true,
        sellerReply: true,
        sellerId: true,
        order: { select: { buyerId: true, sellerId: true } },
      },
    });
    if (!review) throw new ForbiddenError("That review wasn't found.");
    assertCan(user, "reply", "review", review);
    if (review.sellerReply) return { ok: false, error: "You've already replied to this review." };
    await enforceRateLimit("review", user.id);
    const parsed = sellerReplySchema.safeParse({ reply: form.get("reply") });
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the highlighted details.",
        fieldErrors: { reply: parsed.error.issues[0]!.message },
      };
    }
    await db.review.update({
      where: { id: review.id },
      data: { sellerReply: parsed.data.reply, repliedAt: new Date() },
    });
    await refreshSellerRating(review.sellerId);
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}
