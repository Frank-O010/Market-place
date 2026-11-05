"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { sendMessage } from "@/server/actions/messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/native-select";
import { Turnstile } from "@/components/turnstile";

/** Message box. Warns before sending contact details while the deal isn't protected yet. */
export function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  // A brand-new account's first message needs a bot check (only when Turnstile is configured).
  const [challenge, setChallenge] = React.useState<{ confirmContact: boolean; key: number } | null>(null);

  function send(confirmContact: boolean, token?: string) {
    setError(null);
    start(async () => {
      const result = await sendMessage(conversationId, body, confirmContact, token);
      if (result.ok) {
        setBody("");
        setWarning(null);
        setChallenge(null);
        router.refresh();
      } else if ("challenge" in result) {
        // Tokens are single use: mount a fresh widget for each attempt.
        setChallenge((c) => ({ confirmContact, key: (c?.key ?? 0) + 1 }));
        if (token) setError(result.error);
      } else if ("contactWarning" in result) {
        setWarning(result.contactWarning);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      className="border-border bg-surface sticky bottom-0 flex flex-col gap-2 border-t pt-3 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
    >
      {warning && (
        <div
          role="alert"
          className="border-warning bg-warning-subtle flex flex-col gap-3 rounded-md border p-3 text-sm"
        >
          <p className="flex gap-2">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {warning}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setWarning(null)}>
              Edit message
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => send(true)}>
              Send anyway
            </Button>
          </div>
        </div>
      )}
      {challenge && (
        <div className="flex flex-col gap-1 text-sm">
          <p>One quick check before your first message:</p>
          <Turnstile
            key={challenge.key}
            action="first_message"
            onToken={(token) => send(challenge.confirmContact, token)}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <Label htmlFor="message-body" className="sr-only">
        Your message
      </Label>
      <div className="flex items-end gap-2">
        <Textarea
          id="message-body"
          name="body"
          value={body}
          maxLength={2000}
          placeholder="Write a message"
          className="min-h-11 flex-1 resize-y"
          rows={2}
          onChange={(e) => {
            setBody(e.target.value);
            if (warning) setWarning(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send(false);
            }
          }}
        />
        <Button type="submit" disabled={pending || body.trim().length === 0}>
          Send
        </Button>
      </div>
    </form>
  );
}

/** Checks for new messages every few seconds while the tab is visible (simple polling for the MVP). */
export function ConversationPoller({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
