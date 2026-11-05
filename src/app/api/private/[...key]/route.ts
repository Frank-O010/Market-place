import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { getPrivateStore } from "@/server/private-files";

const notFound = () => new NextResponse("Not found", { status: 404 });

/**
 * Streams a private photo to someone allowed to see it: ID documents to staff only; dispute
 * photos to staff and the order's buyer and seller. Never cached or indexed.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/private/[...key]">) {
  const key = (await params).key.join("/");
  if (!/^(id-documents|dispute-evidence)\/[a-z0-9-]+\.jpg$/.test(key)) return notFound();
  const user = await getCurrentUser();
  if (!user) return notFound();
  const staff = can(user, "moderate", "platform", {});

  let allowed = false;
  if (key.startsWith("id-documents/")) {
    allowed = staff;
  } else {
    const dispute = await db.dispute.findFirst({
      where: { evidenceKeys: { has: key } },
      select: { openedById: true, order: { select: { buyerId: true, sellerId: true } } },
    });
    allowed = !!dispute && can(user, "view", "dispute", dispute);
  }
  if (!allowed) return notFound();

  const file = await getPrivateStore()?.get(key);
  if (!file) return notFound();
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
