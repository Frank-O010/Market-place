"use server";

import { notificationPrefsSchema } from "@/lib/trust/schemas";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { expectedFailure, type ActionResult } from "./result";

export async function saveNotificationPrefs(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await enforceRateLimit("notificationSettings", user.id);
    const prefs = notificationPrefsSchema.parse({
      messageEmail: form.get("messageEmail") === "on",
      orderSms: form.get("orderSms") === "on",
    });
    await db.user.update({ where: { id: user.id }, data: { notificationPrefs: prefs } });
    return { ok: true };
  } catch (error) {
    return expectedFailure(error);
  }
}
