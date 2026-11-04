import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { legalPages } from "@/config/site";

/**
 * Runs before every matched request.
 *  - With Clerk, attaches the Clerk session so server code can call auth().
 *  - Hides /dev/* tools in production unless dev sign-in is explicitly allowed (e2e tests).
 *
 * Authorisation is NOT decided here. Every page, server action and route handler checks
 * permissions itself through the policy module, so a missed matcher can never open a hole.
 */
const useClerk = process.env.AUTH_PROVIDER !== "dev";
const devToolsEnabled = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH === "true";

const clerk = clerkMiddleware();

const legalSlugs = new Set<string>(legalPages.map((page) => page.slug));

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/dev") && !devToolsEnabled) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Legal pages are a fixed list. Answer unknown slugs with a real 404 here, because a
  // partially prerendered route can't change its status code once it starts streaming.
  const legal = /^\/legal\/([^/]+)\/?$/.exec(pathname);
  if (legal && !legalSlugs.has(legal[1]!)) {
    return NextResponse.rewrite(new URL("/not-found", request.url), { status: 404 });
  }
  if (useClerk) return clerk(request, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|avif|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
