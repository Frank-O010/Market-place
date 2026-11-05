"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/** Registers the service worker (production only, so development never serves stale code). */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

export function RetryButton() {
  return <Button onClick={() => window.location.reload()}>Try again</Button>;
}
