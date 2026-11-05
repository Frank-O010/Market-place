/**
 * Browser error reporting, loaded lazily: the Sentry SDK is about 65 KB gzipped, which is more
 * than a second on slow 3G, so it's fetched after the page is interactive and only when a DSN
 * is configured. Errors before it loads are rare and still caught on the server.
 */
type SentryModule = typeof import("@sentry/nextjs");

let loading: Promise<SentryModule | null> | null = null;

export function loadSentry(): Promise<SentryModule | null> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return Promise.resolve(null);
  loading ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      // Keep personal data out of Sentry: no user info, cookies, bodies, query strings or DB parameters.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: { request: false, response: false },
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
      },
    });
    return Sentry;
  });
  return loading;
}

export function captureClientException(error: unknown) {
  void loadSentry().then((Sentry) => Sentry?.captureException(error));
}
