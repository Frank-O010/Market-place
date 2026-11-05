import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { env } from "@/lib/env";
import { markUserDeleted, upsertUserFromProvider } from "@/server/auth/sync";
import { securityEvent } from "@/server/security-events";

/**
 * Clerk user lifecycle webhook. The signature is verified with Svix before anything is trusted.
 * Handlers are idempotent: replaying the same event leaves the database in the same state.
 */
export async function POST(request: NextRequest) {
  if (env().AUTH_PROVIDER !== "clerk") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let event;
  try {
    event = await verifyWebhook(request, { signingSecret: env().CLERK_WEBHOOK_SIGNING_SECRET });
  } catch {
    await securityEvent("webhook_signature_failed", {
      action: "webhook.clerk.signature_failed",
      ip: request.headers.get("x-forwarded-for"),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const data = event.data;
      const primaryEmail = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
      const primaryPhone = data.phone_numbers.find((p) => p.id === data.primary_phone_number_id);
      await upsertUserFromProvider(data.id, {
        email: primaryEmail?.email_address ?? null,
        phone: primaryPhone?.phone_number ?? null,
        name: [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || null,
        emailVerified: primaryEmail?.verification?.status === "verified",
        phoneVerified: primaryPhone?.verification?.status === "verified",
      });
      break;
    }
    case "user.deleted": {
      if (event.data.id) await markUserDeleted(event.data.id);
      break;
    }
    default:
      // Ignore events we do not handle; acknowledge so Clerk does not retry.
      break;
  }

  return NextResponse.json({ received: true });
}
