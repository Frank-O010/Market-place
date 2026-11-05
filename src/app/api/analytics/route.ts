import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { ANON_ID_COOKIE, analyticsEvents, CONSENT_COOKIE } from "@/lib/analytics/events";
import { captureEvent } from "@/server/analytics";
import { getCurrentUser } from "@/server/auth/current-user";
import { checkRateLimit } from "@/server/rate-limit";

const bodySchema = z.object({
  event: z.enum(analyticsEvents),
  properties: z
    .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
    .default({}),
});

/**
 * First-party analytics endpoint: the browser posts funnel events here and we forward them to
 * PostHog, so no tracking script runs on the page. Only for visitors who accepted analytics.
 */
export async function POST(request: NextRequest) {
  const jar = await cookies();
  if (jar.get(CONSENT_COOKIE)?.value !== "analytics") return new NextResponse(null, { status: 204 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit("search", `analytics:${ip}`)).success) return new NextResponse(null, { status: 204 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const user = await getCurrentUser();
  let distinctId = user?.id ?? jar.get(ANON_ID_COOKIE)?.value;
  const response = new NextResponse(null, { status: 204 });
  if (!distinctId) {
    distinctId = randomUUID();
    response.cookies.set(ANON_ID_COOKIE, distinctId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 86_400,
      path: "/",
    });
  }
  const id = distinctId;
  after(() => captureEvent(parsed.data.event, id, { ...parsed.data.properties, signed_in: Boolean(user) }));
  return response;
}
