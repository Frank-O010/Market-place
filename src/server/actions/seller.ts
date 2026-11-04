"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { fieldErrors } from "@/lib/listings/schema";
import { sellerProfileSchema } from "@/lib/listings/seller-schema";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { tags } from "@/server/listings/cache";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

/**
 * Seller onboarding: sets up the shop profile and adds the SELLER role.
 * Also used later to edit the shop profile. Payout details are added in checkout setup (Phase 3).
 */
export async function saveSellerProfile(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  let firstTime = false;
  try {
    const user = await requireUser();
    await enforceRateLimit("sellerOnboarding", user.id);
    const parsed = sellerProfileSchema.safeParse({
      displayName: form.get("displayName"),
      slug: form.get("slug"),
      location: form.get("location"),
      bio: form.get("bio") ?? "",
    });
    if (!parsed.success) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    }
    const data = parsed.data;
    const taken = await db.sellerProfile.findUnique({ where: { slug: data.slug }, select: { userId: true } });
    if (taken && taken.userId !== user.id) {
      return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { slug: "That shop address is taken. Try another." } };
    }

    const existing = await db.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true, onboardedAt: true } });
    firstTime = !existing?.onboardedAt;
    const profile = await db.$transaction(async (tx) => {
      const saved = await tx.sellerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...data, onboardedAt: new Date() },
        update: { ...data, onboardedAt: existing?.onboardedAt ?? new Date() },
        select: { id: true },
      });
      if (!user.roles.includes("SELLER")) {
        await tx.user.update({ where: { id: user.id }, data: { roles: { set: [...new Set([...user.roles, "SELLER" as const])] } } });
      }
      return saved;
    });
    await audit({
      action: firstTime ? "seller.onboarded" : "seller.profile.update",
      actorId: user.id,
      targetType: "sellerProfile",
      targetId: profile.id,
    });
    updateTag(tags.seller(profile.id));
    updateTag(tags.listings);
    updateTag("sellers");
  } catch (error) {
    return expectedFailure(error);
  }
  if (firstTime) redirect("/sell?welcome=1");
  return { ok: true };
}
