"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseKes } from "@/lib/money";
import { idSchema } from "@/lib/trust/schemas";
import { audit } from "@/server/audit";
import { requireUser, type CurrentUser } from "@/server/auth/current-user";
import { hasTwoFactor } from "@/server/auth/identity";
import { securityEvent } from "@/server/security-events";
import { db } from "@/server/db";
import { DisputeError, resolveDispute } from "@/server/disputes";
import { listingChanged } from "@/server/listings/cache";
import { notify } from "@/server/notifications";
import { applyOrderEvent } from "@/server/orders/service";
import { sendPayout } from "@/server/orders/payouts";
import { assertCan, can, ForbiddenError } from "@/server/policy/can";
import { getPrivateStore } from "@/server/private-files";
import { decryptField } from "@/server/crypto";
import { enforceRateLimit } from "@/server/rate-limit";
import { refreshSellerRating } from "@/server/reviews";
import type { ModerationActionType, ReportTarget } from "@/generated/prisma/client";
import { expectedFailure, type ActionResult } from "./result";

const noteSchema = z.string().trim().max(500, "Keep the note under 500 characters");
const requiredNote = noteSchema.min(5, "Add a short reason (at least 5 characters)");

async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, "moderate", "platform", {});
  if (!(await hasTwoFactor())) throw new ForbiddenError("Turn on two-step verification before using staff tools.");
  await enforceRateLimit("moderation", user.id);
  return user;
}

/** Records the action and closes open reports about the same thing. */
async function record(
  user: CurrentUser,
  type: ModerationActionType,
  targetType: ReportTarget,
  targetId: string,
  note: string | null,
  reportStatus: "ACTIONED" | "DISMISSED" | null,
) {
  await db.moderationAction.create({ data: { moderatorId: user.id, type, targetType, targetId, note } });
  if (reportStatus) {
    await db.report.updateMany({
      where: { targetType, targetId, status: "OPEN" },
      data: { status: reportStatus, resolvedAt: new Date() },
    });
  }
  const input = {
    action: `moderation.${type.toLowerCase()}`,
    actorId: user.id,
    targetType: targetType.toLowerCase(),
    targetId,
    metadata: { note },
  };
  // Suspensions are alerted on (Sentry) as well as logged.
  if (type === "SUSPEND_USER" || type === "UNSUSPEND_USER") await securityEvent("admin_action", input);
  else await audit(input);
  revalidatePath("/admin/moderation");
}

function fail(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Please check the details." };
  if (error instanceof DisputeError) return { ok: false, error: error.message };
  return expectedFailure(error);
}

// --- Listings ---------------------------------------------------------------------------------

export async function approveListing(listingId: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const listing = await db.listing.findUnique({
      where: { id: idSchema.parse(listingId) },
      select: {
        id: true,
        title: true,
        sellerId: true,
        status: true,
        publishedAt: true,
        seller: { select: { userId: true } },
      },
    });
    if (!listing) return { ok: false, error: "Listing not found." };
    if (listing.status !== "PENDING_REVIEW" && listing.status !== "ACTIVE") {
      return { ok: false, error: "Only listings waiting for review can be approved." };
    }
    await db.listing.update({
      where: { id: listing.id },
      data: { status: "ACTIVE", publishedAt: listing.publishedAt ?? new Date(), moderationNote: null },
    });
    await record(user, "APPROVE_LISTING", "LISTING", listing.id, null, "DISMISSED");
    listingChanged(listing);
    if (listing.status === "PENDING_REVIEW") {
      await notify({
        userId: listing.seller.userId,
        type: "listing.approved",
        inApp: { title: "Your listing is live", body: `“${listing.title}” passed review.`, url: `/sell/listings` },
      });
    }
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Sends a listing back to the seller as a draft with a reason (fixable), or removes it for good. */
export async function rejectListing(listingId: string, note: string, remove: boolean): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const reason = requiredNote.parse(note);
    const listing = await db.listing.findUnique({
      where: { id: idSchema.parse(listingId) },
      select: { id: true, title: true, sellerId: true, status: true, seller: { select: { userId: true } } },
    });
    if (!listing || listing.status === "REMOVED") return { ok: false, error: "Listing not found." };
    await db.listing.update({
      where: { id: listing.id },
      data: { status: remove ? "REMOVED" : "DRAFT", moderationNote: reason },
    });
    await record(user, remove ? "REMOVE_LISTING" : "REJECT_LISTING", "LISTING", listing.id, reason, "ACTIONED");
    listingChanged(listing);
    await notify({
      userId: listing.seller.userId,
      type: remove ? "listing.removed" : "listing.rejected",
      inApp: {
        title: remove ? "A listing was removed" : "A listing needs changes",
        body: `“${listing.title}”: ${reason}`,
        url: `/sell/listings`,
      },
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Reports, messages, reviews ----------------------------------------------------------------

export async function dismissReport(reportId: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const report = await db.report.findUnique({
      where: { id: idSchema.parse(reportId) },
      select: { id: true, targetType: true, targetId: true },
    });
    if (!report) return { ok: false, error: "Report not found." };
    // Dismisses every open report about the same thing.
    await db.report.updateMany({
      where: { targetType: report.targetType, targetId: report.targetId, status: "OPEN" },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    await db.moderationAction.create({
      data: {
        moderatorId: user.id,
        reportId: report.id,
        type: "DISMISS_REPORT",
        targetType: report.targetType,
        targetId: report.targetId,
      },
    });
    await audit({ action: "moderation.dismiss_report", actorId: user.id, targetType: "report", targetId: report.id });
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function hideMessage(messageId: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const message = await db.message.findUnique({ where: { id: idSchema.parse(messageId) }, select: { id: true } });
    if (!message) return { ok: false, error: "Message not found." };
    await db.message.update({ where: { id: message.id }, data: { hiddenAt: new Date() } });
    await record(user, "HIDE_MESSAGE", "MESSAGE", message.id, null, "ACTIONED");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function hideReview(reviewId: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const review = await db.review.findUnique({
      where: { id: idSchema.parse(reviewId) },
      select: { id: true, sellerId: true },
    });
    if (!review) return { ok: false, error: "Review not found." };
    await db.review.update({ where: { id: review.id }, data: { hiddenAt: new Date() } });
    await refreshSellerRating(review.sellerId);
    await record(user, "HIDE_REVIEW", "REVIEW", review.id, null, "ACTIONED");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Users ---------------------------------------------------------------------------------------

export async function setUserSuspended(userId: string, suspended: boolean, note: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const reason = suspended ? requiredNote.parse(note) : noteSchema.parse(note);
    const target = await db.user.findUnique({
      where: { id: idSchema.parse(userId) },
      select: { id: true, roles: true, status: true, sellerProfile: { select: { id: true } } },
    });
    if (!target || target.status === "DELETED") return { ok: false, error: "User not found." };
    assertCan(user, "suspend", "user", target);
    // Moderators can't suspend other staff; only an admin can.
    const targetIsStaff = target.roles.includes("ADMIN") || target.roles.includes("MODERATOR");
    if (targetIsStaff && !user.roles.includes("ADMIN")) throw new ForbiddenError("Only an admin can suspend staff.");
    await db.user.update({ where: { id: target.id }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } });
    if (target.sellerProfile && suspended) {
      // A suspended seller's listings leave the site (paused, so they come back if reinstated).
      const listings = await db.listing.findMany({
        where: { sellerId: target.sellerProfile.id, status: "ACTIVE" },
        select: { id: true, sellerId: true },
      });
      await db.listing.updateMany({ where: { id: { in: listings.map((l) => l.id) } }, data: { status: "PAUSED" } });
      for (const l of listings) listingChanged(l);
    }
    await record(
      user,
      suspended ? "SUSPEND_USER" : "UNSUSPEND_USER",
      "USER",
      target.id,
      reason || null,
      suspended ? "ACTIONED" : null,
    );
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Fraud flags -----------------------------------------------------------------------------------

/** The order looks fine: release its payout hold. */
export async function clearFraudFlags(orderId: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const order = await db.order.findUnique({
      where: { id: idSchema.parse(orderId) },
      select: { id: true, fraudFlags: true, payoutId: true },
    });
    if (!order || order.fraudFlags.length === 0) return { ok: false, error: "Order not found." };
    await db.order.update({ where: { id: order.id }, data: { fraudReviewedAt: new Date() } });
    await audit({ action: "order.fraud_cleared", actorId: user.id, targetType: "order", targetId: order.id });
    if (order.payoutId) await sendPayout(order.payoutId);
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** The order looks fraudulent and hasn't been sent: refund the buyer in full. */
export async function refundFlaggedOrder(orderId: string, note: string): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const reason = requiredNote.parse(note);
    const order = await db.order.findUnique({
      where: { id: idSchema.parse(orderId) },
      select: { id: true, status: true },
    });
    if (!order) return { ok: false, error: "Order not found." };
    if (order.status !== "PAID_HELD")
      return { ok: false, error: "Only paid orders that haven't been sent can be refunded here." };
    await db.order.update({ where: { id: order.id }, data: { fraudReviewedAt: new Date() } });
    await applyOrderEvent({
      orderId: order.id,
      event: "staff_refunded",
      actorId: user.id,
      note: `Refunded after a safety check: ${reason}`,
    });
    await securityEvent("admin_action", {
      action: "order.staff_refund",
      actorId: user.id,
      targetType: "order",
      targetId: order.id,
    });
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Disputes ---------------------------------------------------------------------------------------

export async function resolveDisputeAsStaff(
  disputeId: string,
  resolution: "FULL_REFUND" | "PARTIAL_REFUND" | "RELEASE_TO_SELLER",
  refundKes: string,
  note: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    assertCan(user, "resolve", "dispute", { openedById: "", order: { buyerId: null, sellerId: "" } });
    if (!(await hasTwoFactor())) throw new ForbiddenError("Turn on two-step verification before using staff tools.");
    await enforceRateLimit("moderation", user.id);
    const parsedResolution = z.enum(["FULL_REFUND", "PARTIAL_REFUND", "RELEASE_TO_SELLER"]).parse(resolution);
    const reason = requiredNote.parse(note);
    let refundAmountMinor: number | undefined;
    if (parsedResolution === "PARTIAL_REFUND") {
      try {
        refundAmountMinor = parseKes(refundKes);
      } catch {
        return { ok: false, error: "Enter the refund amount in KES." };
      }
    }
    await resolveDispute({
      disputeId: idSchema.parse(disputeId),
      resolution: parsedResolution,
      refundAmountMinor,
      note: reason,
      actorId: user.id,
    });
    await securityEvent("admin_action", {
      action: `dispute.resolve.${parsedResolution.toLowerCase()}`,
      actorId: user.id,
      targetType: "dispute",
      targetId: disputeId,
      metadata: { refundAmountMinor: refundAmountMinor ?? null },
    });
    revalidatePath(`/admin/disputes/${disputeId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- ID verification ------------------------------------------------------------------------------

export async function reviewIdVerification(
  sellerId: string,
  decision: "ID_VERIFIED" | "BUSINESS_VERIFIED" | "REJECT",
  note: string,
): Promise<ActionResult> {
  try {
    const user = await requireStaff();
    const outcome = z.enum(["ID_VERIFIED", "BUSINESS_VERIFIED", "REJECT"]).parse(decision);
    const reason = outcome === "REJECT" ? requiredNote.parse(note) : noteSchema.parse(note);
    const seller = await db.sellerProfile.findUnique({
      where: { id: idSchema.parse(sellerId) },
      select: { id: true, userId: true, idVerificationStatus: true, idDocumentKeyEnc: true, verificationTier: true },
    });
    if (!seller || seller.idVerificationStatus !== "PENDING") return { ok: false, error: "Nothing to review." };
    if (outcome === "REJECT") {
      // Data minimisation: a rejected ID photo is deleted straight away.
      if (seller.idDocumentKeyEnc) await getPrivateStore()?.delete(decryptField(seller.idDocumentKeyEnc));
      await db.sellerProfile.update({
        where: { id: seller.id },
        data: {
          idVerificationStatus: "REJECTED",
          idDocumentKeyEnc: null,
          idReviewedAt: new Date(),
          idReviewedById: user.id,
          idReviewNote: reason,
        },
      });
    } else {
      await db.sellerProfile.update({
        where: { id: seller.id },
        data: {
          idVerificationStatus: "APPROVED",
          verificationTier: outcome,
          idReviewedAt: new Date(),
          idReviewedById: user.id,
          idReviewNote: reason || null,
        },
      });
    }
    await audit({
      action: `seller.id_${outcome === "REJECT" ? "rejected" : "approved"}`,
      actorId: user.id,
      targetType: "sellerProfile",
      targetId: seller.id,
      metadata: { tier: outcome },
    });
    await notify({
      userId: seller.userId,
      type: "verification.reviewed",
      inApp:
        outcome === "REJECT"
          ? { title: "ID check not approved", body: reason, url: "/sell/verification" }
          : { title: "You're verified", body: "Your shop now shows the Verified badge.", url: "/sell/verification" },
    });
    // Badges show on cached public pages.
    const listing = await db.listing.findFirst({
      where: { sellerId: seller.id },
      select: { id: true, sellerId: true },
    });
    if (listing) listingChanged(listing);
    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Used by the evidence/ID image route. */
export async function staffCanModerate(user: CurrentUser | null) {
  return can(user, "moderate", "platform", {});
}
