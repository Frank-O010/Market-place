/** The product events we send to PostHog: the buying funnel, from search to paid order. */
export const analyticsEvents = [
  "search_performed",
  "listing_viewed",
  "add_to_cart",
  "checkout_started",
  "order_paid",
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];

export const CONSENT_COOKIE = "mp_consent";
export const ANON_ID_COOKIE = "mp_aid";
export type ConsentChoice = "analytics" | "essential";
