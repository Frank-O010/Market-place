"use server";

import { z } from "zod";
import { normaliseKenyanPhone } from "@/lib/orders/pricing";
import { requireUser } from "@/server/auth/current-user";
import { hasTwoFactor } from "@/server/auth/identity";
import { securityEvent } from "@/server/security-events";
import { db } from "@/server/db";
import { retryPendingPayouts } from "@/server/orders/payouts";
import { assertCan, ForbiddenError } from "@/server/policy/can";
import { getPaymentGateway } from "@/server/payments";
import { PaymentProviderError } from "@/server/payments/types";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the name registered on the M-Pesa line").max(80),
  phone: z.string().transform((v, ctx) => {
    const phone = normaliseKenyanPhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a Kenyan mobile number, like 0712 345 678" });
      return z.NEVER;
    }
    return phone;
  }),
});

/**
 * Registers the seller's M-Pesa number with Paystack as a transfer recipient. Only the
 * recipient code and a masked label are stored; the full number never touches our database.
 */
export async function savePayoutDetails(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!user.sellerProfileId) throw new ForbiddenError("Set up your shop first.");
    assertCan(user, "update", "sellerProfile", { id: user.sellerProfileId, userId: user.id });
    await enforceRateLimit("payoutSettings", user.id);
    // Changing where money goes is the main prize of a stolen account, so once a seller has been
    // paid, changing the number needs two-step verification.
    const existing = await db.sellerProfile.findUniqueOrThrow({
      where: { id: user.sellerProfileId },
      select: { payoutReference: true, _count: { select: { payouts: { where: { status: "PAID" } } } } },
    });
    if (existing.payoutReference && existing._count.payouts > 0 && !(await hasTwoFactor()))
      return {
        ok: false,
        error: "To change your payout number, first turn on two-step verification in Account, Security.",
      };
    const parsed = schema.safeParse({ name: form.get("name"), phone: form.get("phone") });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      return { ok: false, error: "Please check the highlighted details.", fieldErrors };
    }
    const gateway = getPaymentGateway();
    if (!gateway) return { ok: false, error: "Payouts aren't switched on yet." };
    let recipientCode: string;
    try {
      ({ recipientCode } = await gateway.createMpesaRecipient(parsed.data));
    } catch (error) {
      if (error instanceof PaymentProviderError)
        return { ok: false, error: "M-Pesa didn't accept that number. Please check it." };
      throw error;
    }
    await db.sellerProfile.update({
      where: { id: user.sellerProfileId },
      data: { payoutReference: recipientCode, payoutLabel: `M-Pesa ending ${parsed.data.phone.slice(-3)}` },
    });
    await securityEvent("admin_action", {
      action: existing.payoutReference ? "seller.payout_details.change" : "seller.payout_details.add",
      actorId: user.id,
      targetType: "sellerProfile",
      targetId: user.sellerProfileId,
    });
    // Anything that was waiting for payout details goes out now.
    await retryPendingPayouts();
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}
