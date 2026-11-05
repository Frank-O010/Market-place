"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { BASIS_POINTS, parseKes } from "@/lib/money";
import { idSchema } from "@/lib/trust/schemas";
import { slugify } from "@/lib/utils";
import { requireUser, type CurrentUser } from "@/server/auth/current-user";
import { hasTwoFactor } from "@/server/auth/identity";
import { db } from "@/server/db";
import { sendPayout } from "@/server/orders/payouts";
import { assertCan, ForbiddenError } from "@/server/policy/can";
import { enforceRateLimit } from "@/server/rate-limit";
import { securityEvent } from "@/server/security-events";
import { getAllSettings, setSetting, type SettingKey } from "@/server/settings";
import { expectedFailure, type ActionResult } from "./result";

/** Admin-only tools: settings, roles, seller tiers, payouts and categories. */
async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, "manage_settings", "platform", {});
  if (!(await hasTwoFactor())) throw new ForbiddenError("Turn on two-step verification before using admin tools.");
  await enforceRateLimit("admin", user.id);
  return user;
}

function fail(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Please check the details." };
  return expectedFailure(error);
}

// --- Users ------------------------------------------------------------------------------------------

const roleSchema = z.array(z.enum(["BUYER", "SELLER", "MODERATOR", "ADMIN"])).max(4);

export async function setUserRoles(userId: string, roles: string[]): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const target = await db.user.findUnique({
      where: { id: idSchema.parse(userId) },
      select: { id: true, roles: true, status: true, sellerProfile: { select: { id: true } } },
    });
    if (!target || target.status === "DELETED") return { ok: false, error: "User not found." };
    assertCan(user, "change_roles", "user", target);
    // Everyone can buy; a seller role needs a shop.
    const next = [...new Set(["BUYER" as const, ...roleSchema.parse(roles)])];
    if (next.includes("SELLER") && !target.sellerProfile)
      return { ok: false, error: "This person hasn't set up a shop, so they can't be a seller yet." };
    if (target.id === user.id && !next.includes("ADMIN"))
      return { ok: false, error: "You can't remove your own admin role. Ask another admin." };
    await db.user.update({ where: { id: target.id }, data: { roles: next } });
    await securityEvent("admin_action", {
      action: "user.roles.change",
      actorId: user.id,
      targetType: "user",
      targetId: target.id,
      metadata: { from: target.roles.join(","), to: next.join(",") },
    });
    revalidatePath(`/admin/users/${target.id}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const tierSchema = z.enum(["UNVERIFIED", "PHONE_VERIFIED", "ID_VERIFIED", "BUSINESS_VERIFIED"]);

export async function setSellerTier(userId: string, tier: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const profile = await db.sellerProfile.findUnique({
      where: { userId: idSchema.parse(userId) },
      select: { id: true, verificationTier: true },
    });
    if (!profile) return { ok: false, error: "This person doesn't have a shop." };
    const next = tierSchema.parse(tier);
    await db.sellerProfile.update({ where: { id: profile.id }, data: { verificationTier: next } });
    await securityEvent("admin_action", {
      action: "seller.tier.change",
      actorId: user.id,
      targetType: "seller",
      targetId: profile.id,
      metadata: { from: profile.verificationTier, to: next },
    });
    updateTag(`seller:${profile.id}`);
    updateTag("sellers");
    updateTag("listings"); // the tier badge shows on listing cards
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Settings ---------------------------------------------------------------------------------------

export async function saveSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const text = (key: string) => String(formData.get(key) ?? "").trim();
    const fieldErrors: Record<string, string> = {};

    const percent = Number(text("commission_percent"));
    if (!Number.isFinite(percent) || percent < 0 || percent > 50 || Math.round(percent * 100) !== percent * 100)
      fieldErrors.commission_percent = "Enter a percentage between 0 and 50, like 10 or 7.5";
    const days = Number(text("auto_release_days"));
    if (!Number.isInteger(days) || days < 1 || days > 30)
      fieldErrors.auto_release_days = "Enter whole days from 1 to 30";
    let deliveryFee = 0;
    try {
      deliveryFee = parseKes(text("delivery_fee"));
      if (deliveryFee > 1_000_000) fieldErrors.delivery_fee = "That delivery fee is too high";
    } catch {
      fieldErrors.delivery_fee = "Enter an amount in KES, like 300";
    }
    const keywords = [
      ...new Set(
        text("prohibited_keywords")
          .split(/\r?\n/)
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (keywords.some((k) => k.length < 2 || k.length > 40) || keywords.length > 500)
      fieldErrors.prohibited_keywords = "One word or phrase per line, 2 to 40 characters each";
    if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Some settings need fixing.", fieldErrors };

    const next = {
      commission_bps: Math.round((percent * BASIS_POINTS) / 100),
      auto_release_days: days,
      delivery_fee_minor: deliveryFee,
      prohibited_keywords: keywords,
      checkout_enabled: formData.get("checkout_enabled") === "on",
      review_all_new_listings: formData.get("review_all_new_listings") === "on",
    } satisfies { [K in SettingKey]: unknown };

    const current = await getAllSettings();
    for (const key of Object.keys(next) as SettingKey[]) {
      const before = current[key];
      const after = next[key];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      await setSetting(key, after as never);
      const summarise = (v: unknown) => (Array.isArray(v) ? `${v.length} entries` : String(v));
      await securityEvent("admin_action", {
        action: `settings.${key}`,
        actorId: user.id,
        targetType: "setting",
        targetId: key,
        metadata: { from: summarise(before), to: summarise(after) },
      });
    }
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Payouts ----------------------------------------------------------------------------------------

export async function retryPayout(payoutId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const payout = await db.payout.findUnique({
      where: { id: idSchema.parse(payoutId) },
      select: { id: true, sellerId: true, status: true },
    });
    if (!payout) return { ok: false, error: "Payout not found." };
    assertCan(user, "manage", "payout", payout);
    if (payout.status !== "FAILED" && payout.status !== "PENDING")
      return { ok: false, error: "Only waiting or failed payouts can be retried." };
    await securityEvent("admin_action", {
      action: "payout.retry",
      actorId: user.id,
      targetType: "payout",
      targetId: payout.id,
    });
    await sendPayout(payout.id);
    const after = await db.payout.findUniqueOrThrow({ where: { id: payout.id }, select: { status: true } });
    revalidatePath("/admin/payouts");
    if (after.status === "PENDING" || after.status === "FAILED")
      return { ok: false, error: "The payout is still waiting. Check the seller's M-Pesa details or any fraud flag." };
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Categories -------------------------------------------------------------------------------------

const categorySchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(2, "Enter a name of at least 2 characters").max(60, "Keep the name under 60 characters"),
  parentId: idSchema.optional(),
  sortOrder: z.coerce.number().int("Use a whole number").min(0).max(1000),
});

export async function saveCategory(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const parsed = categorySchema.safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      parentId: formData.get("parentId") || undefined,
      sortOrder: formData.get("sortOrder") || 0,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        ok: false,
        error: issue?.message ?? "Please check the details.",
        fieldErrors: issue ? { [String(issue.path[0])]: issue.message } : undefined,
      };
    }
    const { id, name, parentId, sortOrder } = parsed.data;
    if (parentId) {
      const parent = await db.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
      if (!parent || parent.parentId) return { ok: false, error: "Choose a top-level category as the parent." };
      if (parentId === id) return { ok: false, error: "A category can't be its own parent." };
    }
    if (id) {
      const children = await db.category.count({ where: { parentId: id } });
      if (children > 0 && parentId)
        return { ok: false, error: "This category has subcategories, so it has to stay top-level." };
      await db.category.update({ where: { id }, data: { name, parentId: parentId ?? null, sortOrder } });
    } else {
      const base = slugify(name) || "category";
      let slug = base;
      for (let n = 2; await db.category.findUnique({ where: { slug }, select: { id: true } }); n++)
        slug = `${base}-${n}`;
      await db.category.create({ data: { name, slug, parentId: parentId ?? null, sortOrder } });
    }
    await securityEvent("admin_action", {
      action: id ? "category.update" : "category.create",
      actorId: user.id,
      targetType: "category",
      targetId: id,
      metadata: { name },
    });
    updateTag("categories");
    revalidatePath("/admin/categories");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  try {
    const user = await requireAdmin();
    const category = await db.category.findUnique({
      where: { id: idSchema.parse(categoryId) },
      select: { id: true, name: true, _count: { select: { listings: true, children: true } } },
    });
    if (!category) return { ok: false, error: "Category not found." };
    if (category._count.listings > 0 || category._count.children > 0)
      return { ok: false, error: "Only empty categories can be deleted. Move its listings and subcategories first." };
    await db.category.delete({ where: { id: category.id } });
    await securityEvent("admin_action", {
      action: "category.delete",
      actorId: user.id,
      targetType: "category",
      targetId: category.id,
      metadata: { name: category.name },
    });
    updateTag("categories");
    revalidatePath("/admin/categories");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
