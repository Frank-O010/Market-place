"use server";

import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { decryptField, encryptField, encryptionAvailable } from "@/server/crypto";
import { notifyStaff } from "@/server/notifications";
import { ForbiddenError } from "@/server/policy/can";
import { getPrivateStore, PrivateUploadError, storePrivatePhoto } from "@/server/private-files";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

/** Seller: send a photo of their national ID or passport for the Verified badge. */
export async function submitIdVerification(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!user.sellerProfileId || !user.roles.includes("SELLER")) throw new ForbiddenError("Set up your shop first.");
    if (!encryptionAvailable() || !getPrivateStore()) {
      return { ok: false, error: "ID checks aren't switched on yet. Please try again later." };
    }
    await enforceRateLimit("idVerification", user.id);
    if (form.get("consent") !== "on") {
      return { ok: false, error: "Please confirm you agree.", fieldErrors: { consent: "Tick the box to continue" } };
    }
    const seller = await db.sellerProfile.findUniqueOrThrow({
      where: { id: user.sellerProfileId },
      select: { id: true, displayName: true, idVerificationStatus: true, idDocumentKeyEnc: true },
    });
    if (seller.idVerificationStatus === "PENDING") return { ok: false, error: "Your ID is already being checked." };
    if (seller.idVerificationStatus === "APPROVED") return { ok: false, error: "You're already verified." };
    const key = await storePrivatePhoto(form.get("document") as File, "id-documents");
    if (seller.idDocumentKeyEnc) await getPrivateStore()!.delete(decryptField(seller.idDocumentKeyEnc));
    await db.sellerProfile.update({
      where: { id: seller.id },
      data: {
        idDocumentKeyEnc: encryptField(key),
        idVerificationStatus: "PENDING",
        idSubmittedAt: new Date(),
        idReviewNote: null,
      },
    });
    await audit({ action: "seller.id_submitted", actorId: user.id, targetType: "sellerProfile", targetId: seller.id });
    await notifyStaff("staff.verification", {
      title: "ID check waiting",
      body: seller.displayName,
      url: "/admin/moderation?tab=verification",
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof PrivateUploadError)
      return { ok: false, error: error.message, fieldErrors: { document: error.message } };
    return expectedFailure(error);
  }
}
