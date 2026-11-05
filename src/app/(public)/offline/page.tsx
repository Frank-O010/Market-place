import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { RetryButton } from "@/components/pwa";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };

/** Shown by the service worker when a page can't load because there's no connection. */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <WifiOff className="text-muted size-12" aria-hidden />
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="text-muted">
        Check your mobile data or Wi-Fi, then try again. Your cart and orders are saved and will be there when
        you&apos;re back.
      </p>
      <RetryButton />
    </div>
  );
}
