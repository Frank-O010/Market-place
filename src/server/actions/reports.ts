"use server";

import { reportSchema } from "@/lib/trust/schemas";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { listingChanged } from "@/server/listings/cache";
import { notifyStaff } from "@/server/notifications";
import { can } from "@/server/policy/can";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

/** Listings reported by this many different people are taken down until a moderator checks them. */
const AUTO_HIDE_REPORTERS = 3;

/** Anyone signed in can report a listing, a user, a message they received, or a review. */
export async function createReport(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = reportSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      return { ok: false, error: "Please choose a reason.", fieldErrors };
    }
    const { targetType, targetId, reason, details } = parsed.data;
    await enforceRateLimit("report", user.id);

    // The target must exist and be something this user can see.
    let listing: { id: string; sellerId: string; status: string } | null = null;
    switch (targetType) {
      case "LISTING":
        listing = await db.listing.findUnique({
          where: { id: targetId },
          select: { id: true, sellerId: true, status: true },
        });
        if (!listing || !can(user, "view", "listing", listing as never)) return notFound();
        break;
      case "USER": {
        const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!target || target.id === user.id) return notFound();
        break;
      }
      case "MESSAGE": {
        const message = await db.message.findUnique({
          where: { id: targetId },
          select: { senderId: true, conversation: { select: { buyerId: true, sellerId: true } } },
        });
        if (!message || message.senderId === user.id || !can(user, "view", "conversation", message.conversation)) {
          return notFound();
        }
        break;
      }
      case "REVIEW": {
        const review = await db.review.findUnique({ where: { id: targetId }, select: { hiddenAt: true } });
        if (!review || review.hiddenAt) return notFound();
        break;
      }
    }

    const existing = await db.report.findFirst({
      where: { reporterId: user.id, targetType, targetId, status: "OPEN" },
      select: { id: true },
    });
    if (existing) return { ok: true }; // already reported; nothing more to do
    const report = await db.report.create({
      data: { reporterId: user.id, targetType, targetId, reason, details: details || null },
      select: { id: true },
    });
    await audit({
      action: "report.created",
      actorId: user.id,
      targetType: "report",
      targetId: report.id,
      metadata: { targetType, targetId },
    });
    await notifyStaff("staff.report", {
      title: `New report: ${targetType.toLowerCase()}`,
      body: reason,
      url: "/admin/moderation?tab=reports",
    });

    if (listing && listing.status === "ACTIVE") {
      const reporters = await db.report.findMany({
        where: { targetType: "LISTING", targetId, status: "OPEN" },
        distinct: ["reporterId"],
        select: { reporterId: true },
      });
      if (reporters.length >= AUTO_HIDE_REPORTERS) {
        await db.listing.update({
          where: { id: listing.id },
          data: { status: "PENDING_REVIEW", moderationNote: "Taken down for a check after several reports." },
        });
        await audit({
          action: "listing.auto_hidden",
          targetType: "listing",
          targetId: listing.id,
          metadata: { reporters: reporters.length },
        });
        listingChanged(listing);
      }
    }
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}

function notFound(): ActionResult {
  return { ok: false, error: "We couldn't find what you're reporting." };
}
