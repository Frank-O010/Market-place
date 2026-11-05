import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { checkRateLimit } from "@/server/rate-limit";

/**
 * "Download my data" (Data Protection Act 2019, right of access). Returns everything we hold
 * about the signed-in person as JSON. Other people's personal details are left out.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });
  if (!(await checkRateLimit("idVerification", `export:${user.id}`)).success) {
    return new NextResponse("Too many downloads today. Please try again tomorrow.", { status: 429 });
  }
  const data = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      roles: true,
      status: true,
      emailVerified: true,
      phoneVerified: true,
      notificationPrefs: true,
      analyticsConsentAt: true,
      createdAt: true,
      sellerProfile: {
        select: {
          displayName: true,
          slug: true,
          bio: true,
          location: true,
          verificationTier: true,
          idVerificationStatus: true,
          payoutLabel: true,
          createdAt: true,
          listings: {
            select: { id: true, title: true, description: true, priceMinor: true, status: true, createdAt: true },
          },
        },
      },
      ordersAsBuyer: {
        select: {
          number: true,
          status: true,
          totalMinor: true,
          deliveryMethod: true,
          deliveryAddress: true,
          buyerPhone: true,
          createdAt: true,
          items: { select: { titleSnapshot: true, quantity: true, unitPriceMinor: true } },
        },
      },
      savedItems: { select: { listingId: true, createdAt: true } },
      messagesSent: { select: { conversationId: true, body: true, createdAt: true } },
      reviewsWritten: { select: { rating: true, body: true, createdAt: true } },
      reportsFiled: { select: { targetType: true, reason: true, details: true, createdAt: true } },
      disputesOpened: { select: { reason: true, details: true, status: true, createdAt: true } },
      notifications: {
        select: { channel: true, type: true, payload: true, createdAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      },
    },
  });
  await audit({ action: "user.data_export", actorId: user.id, targetType: "user", targetId: user.id });
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), note: "Amounts are in KES cents.", account: data },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="soko-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
