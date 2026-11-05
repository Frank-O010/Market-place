"use client";

import * as React from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript() {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Cloudflare Turnstile widget, loaded only when needed (it isn't on any page by default).
 * Calls onToken with a one-time token once the check passes.
 */
export function Turnstile({ onToken, action }: { onToken: (token: string) => void; action: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [failed, setFailed] = React.useState(false);
  const callback = React.useRef(onToken);
  React.useEffect(() => {
    callback.current = onToken;
  });

  React.useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          callback: (token: string) => callback.current(token),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, action]);

  if (!siteKey) return null;
  return (
    <div>
      <div ref={ref} />
      {failed && (
        <p role="alert" className="text-danger text-sm">
          The security check couldn&apos;t load. Check your connection and reload the page.
        </p>
      )}
    </div>
  );
}
