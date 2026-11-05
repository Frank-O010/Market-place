import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { purgeExpiredData } from "@/server/retention";

/** Daily data retention clean-up (see vercel.json and src/server/retention.ts). */
export async function GET(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(await purgeExpiredData());
}
