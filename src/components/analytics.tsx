"use client";

import * as React from "react";
import { CONSENT_COOKIE, type AnalyticsEvent } from "@/lib/analytics/events";

function hasConsent() {
  return typeof document !== "undefined" && document.cookie.split("; ").includes(`${CONSENT_COOKIE}=analytics`);
}

/** Sends a funnel event if the visitor accepted analytics. Fire-and-forget. */
export function track(event: AnalyticsEvent, properties: Record<string, string | number | boolean | null> = {}) {
  if (!hasConsent()) return;
  const body = JSON.stringify({ event, properties });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
  else
    void fetch("/api/analytics", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    });
}

/** Renders nothing; sends one event when it mounts (e.g. a page view in the funnel). */
export function TrackEvent({
  event,
  properties,
}: {
  event: AnalyticsEvent;
  properties?: Record<string, string | number | boolean | null>;
}) {
  const sent = React.useRef(false);
  React.useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event, properties);
  }, [event, properties]);
  return null;
}
