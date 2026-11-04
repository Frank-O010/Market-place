import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";

/** The signed-in buyer's saved listing ids, for the heart buttons on cached pages. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ signedIn: false, ids: [] }, { headers: { "Cache-Control": "private, no-store" } });
  const rows = await db.savedItem.findMany({
    where: { userId: user.id },
    select: { listingId: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(
    { signedIn: true, ids: rows.map((r) => r.listingId) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
