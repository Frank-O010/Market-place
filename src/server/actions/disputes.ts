"use server";

import { absoluteUrl } from "@/lib/urls";
import { disputeReasons, disputeResponseSchema, disputeSchema, idSchema } from "@/lib/trust/schemas";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { DisputeError, resolveDispute, type Resolution } from "@/server/disputes";
import { layout } from "@/server/email/render";
import { notify, notifyStaff } from "@/server/notifications";
import { applyOrderEvent } from "@/server/orders/service";
import { assertCan, ForbiddenError } from "@/server/policy/can";
import { PrivateUploadError, storePrivatePhoto } from "@/server/private-files";
import { enforceRateLimit } from "@/server/rate-limit";
import { z } from "zod";
import { expectedFailure, type ActionResult } from "./result";

const MAX_PHOTOS = 3;

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return fieldErrors;
}

/** Buyer: report a problem with a paid order. This stops the money being released. */
export async function openDispute(orderId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
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
        dispute: { select: { id: true } },
        seller: { select: { userId: true } },
      },
    });
    if (!order || order.buyerId !== user.id) throw new ForbiddenError("That order wasn't found.");
    if (order.dispute) return { ok: false, error: "You've already reported a problem with this order." };
    if (!["PAID_HELD", "SHIPPED", "DELIVERED"].includes(order.status)) {
      return { ok: false, error: "You can report a problem while the payment is still held." };
    }
    await enforceRateLimit("dispute", user.id);
    const parsed = disputeSchema.safeParse({ reason: form.get("reason"), details: form.get("details") });
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the highlighted details.",
        fieldErrors: fieldErrorsOf(parsed.error.issues),
      };
    }
    const photos = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (photos.length > MAX_PHOTOS)
      return {
        ok: false,
        error: `Add up to ${MAX_PHOTOS} photos.`,
        fieldErrors: { photos: `Add up to ${MAX_PHOTOS} photos.` },
      };
    const evidenceKeys: string[] = [];
    for (const photo of photos) evidenceKeys.push(await storePrivatePhoto(photo, "dispute-evidence"));

    const dispute = await db.dispute.create({
      data: {
        orderId: order.id,
        openedById: user.id,
        reason: parsed.data.reason,
        details: parsed.data.details,
        evidenceKeys,
        status: "AWAITING_SELLER",
      },
      select: { id: true },
    });
    await applyOrderEvent({
      orderId: order.id,
      event: "dispute_opened",
      actorId: user.id,
      note: `Problem reported: ${disputeReasons[parsed.data.reason]}`,
    });
    await audit({ action: "dispute.opened", actorId: user.id, targetType: "dispute", targetId: dispute.id });
    const url = `/sell/orders/${order.id}`;
    await notify({
      userId: order.seller.userId,
      type: "dispute.opened",
      inApp: { title: `Problem reported on order ${order.number}`, body: disputeReasons[parsed.data.reason], url },
      email: {
        orderId: order.id,
        subject: `A buyer reported a problem with order ${order.number}`,
        ...layout({
          heading: "A buyer reported a problem",
          paragraphs: [
            `Reason: ${disputeReasons[parsed.data.reason]}.`,
            "The payment stays on hold until this is sorted out. Please reply with your side, or refund the buyer if you agree.",
          ],
          action: { label: "Open the order", url: absoluteUrl(url) },
        }),
      },
    });
    await notifyStaff("staff.dispute", {
      title: `Dispute on order ${order.number}`,
      body: disputeReasons[parsed.data.reason],
      url: `/admin/disputes/${dispute.id}`,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof PrivateUploadError)
      return { ok: false, error: error.message, fieldErrors: { photos: error.message } };
    return expectedFailure(error);
  }
}

async function loadDisputeForParty(disputeId: string) {
  return db.dispute.findUnique({
    where: { id: idSchema.parse(disputeId) },
    select: {
      id: true,
      status: true,
      openedById: true,
      sellerResponse: true,
      order: { select: { id: true, number: true, buyerId: true, sellerId: true } },
    },
  });
}

/** Seller: give their side. The dispute then goes to a moderator. */
export async function respondToDispute(
  disputeId: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const dispute = await loadDisputeForParty(disputeId);
    if (!dispute) throw new ForbiddenError("That dispute wasn't found.");
    assertCan(user, "respond", "dispute", dispute);
    if (dispute.order.sellerId !== user.sellerProfileId) throw new ForbiddenError();
    if (dispute.status === "RESOLVED" || dispute.sellerResponse) return { ok: false, error: "You've already replied." };
    await enforceRateLimit("dispute", user.id);
    const parsed = disputeResponseSchema.safeParse({ response: form.get("response") });
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the highlighted details.",
        fieldErrors: fieldErrorsOf(parsed.error.issues),
      };
    }
    await db.dispute.update({
      where: { id: dispute.id },
      data: { sellerResponse: parsed.data.response, sellerRespondedAt: new Date(), status: "UNDER_REVIEW" },
    });
    await audit({ action: "dispute.seller_responded", actorId: user.id, targetType: "dispute", targetId: dispute.id });
    if (dispute.order.buyerId) {
      await notify({
        userId: dispute.order.buyerId,
        type: "dispute.response",
        inApp: {
          title: `The seller replied about order ${dispute.order.number}`,
          body: "A moderator will now review the problem.",
          url: `/account/orders/${dispute.order.id}`,
        },
      });
    }
    await notifyStaff("staff.dispute", {
      title: `Seller replied on order ${dispute.order.number}`,
      body: "Ready for review",
      url: `/admin/disputes/${dispute.id}`,
    });
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}

/** Buyer: "it's sorted" (release the payment), or seller: "refund the buyer". */
export async function settleDispute(disputeId: string, outcome: "release" | "refund"): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const dispute = await loadDisputeForParty(disputeId);
    if (!dispute) throw new ForbiddenError("That dispute wasn't found.");
    assertCan(user, "respond", "dispute", dispute);
    const resolution: Resolution =
      z.enum(["release", "refund"]).parse(outcome) === "release" ? "RELEASE_TO_SELLER" : "FULL_REFUND";
    // Each side can only give up its own claim: the buyer can release, the seller can refund.
    if (resolution === "RELEASE_TO_SELLER" && dispute.order.buyerId !== user.id) throw new ForbiddenError();
    if (resolution === "FULL_REFUND" && dispute.order.sellerId !== user.sellerProfileId) throw new ForbiddenError();
    await enforceRateLimit("orderUpdate", user.id);
    await resolveDispute({
      disputeId: dispute.id,
      resolution,
      actorId: user.id,
      note:
        resolution === "RELEASE_TO_SELLER" ? "The buyer said the problem is sorted." : "The seller agreed to refund.",
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof DisputeError) return { ok: false, error: error.message };
    return expectedFailure(error);
  }
}
