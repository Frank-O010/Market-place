"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { startConversation, startOrderConversation } from "@/server/actions/messages";
import { Button } from "@/components/ui/button";

/** Opens the conversation about a listing (or an order). Signed-out visitors go to sign in first. */
export function MessageButton({
  listingId,
  orderId,
  signedIn,
  label = "Message seller",
  variant = "secondary",
}: {
  listingId?: string;
  orderId?: string;
  signedIn: boolean;
  label?: string;
  variant?: "secondary" | "ghost" | "primary";
}) {
  const [pending, start] = React.useTransition();
  if (!signedIn) {
    return (
      <Button asChild variant={variant} size="lg">
        <a
          href={`/sign-in?redirect_url=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}
        >
          <MessageCircle aria-hidden /> {label}
        </a>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size="lg"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = orderId ? await startOrderConversation(orderId) : await startConversation(listingId!);
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      <MessageCircle aria-hidden /> {label}
    </Button>
  );
}
