import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runOrderMaintenance } from "@/server/orders/service";

/**
 * Order housekeeping (see vercel.json): cancels unpaid orders past their payment window,
 * auto-releases funds for shipped orders whose confirmation window has ended, retries payouts.
 */
export async function GET(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return NextResponse.json(await runOrderMaintenance());
}
