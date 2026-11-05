import "server-only";
import { env } from "@/lib/env";
import type { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * Sends one event to PostHog's capture API. Callers must have checked consent first.
 * No-op without NEXT_PUBLIC_POSTHOG_KEY. Never throws.
 */
export async function captureEvent(
  event: AnalyticsEvent,
  distinctId: string,
  properties: Record<string, string | number | boolean | null> = {},
) {
  const { NEXT_PUBLIC_POSTHOG_KEY: apiKey, POSTHOG_HOST: host } = env();
  if (!apiKey) return;
  try {
    await fetch(`${host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $process_person_profile: false },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (error) {
    console.error("[analytics] capture failed", event, error);
  }
}
