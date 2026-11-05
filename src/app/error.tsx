"use client";

import { useEffect } from "react";
import { captureClientException } from "@/lib/sentry-client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureClientException(error);
  }, [error]);
  return (
    <EmptyState
      title="Something went wrong"
      description="Please try again. If it keeps happening, contact support on WhatsApp."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
