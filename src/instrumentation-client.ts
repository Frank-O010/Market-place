import { loadSentry } from "@/lib/sentry-client";

// Start loading error reporting once the browser is idle (see src/lib/sentry-client.ts).
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const start = () => void loadSentry();
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 5000 });
  else setTimeout(start, 3000);
}
