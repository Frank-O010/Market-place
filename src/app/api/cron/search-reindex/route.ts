import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { reindexAllListings } from "@/server/search";

/**
 * Daily repair job (see vercel.json): rebuilds the search index from Postgres so any missed
 * update is fixed within a day. Vercel Cron calls it with "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await reindexAllListings();
  return NextResponse.json(result);
}
