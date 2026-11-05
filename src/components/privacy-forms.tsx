"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { deleteMyAccount, recordConsent } from "@/server/actions/privacy";
import { CONSENT_COOKIE } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

function readConsent(): string | null {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
      ?.split("=")[1] ?? null
  );
}

/** The cookie banner. Only essential cookies are used until the visitor accepts analytics. */
export function ConsentBanner() {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    // Read after mount so the static page shell stays the same for everyone.
    const timer = setTimeout(() => setVisible(readConsent() === null), 0);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  const choose = async (choice: "analytics" | "essential") => {
    setVisible(false);
    await recordConsent(choice);
  };
  return (
    <section
      aria-label="Cookie choices"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg"
      data-testid="consent-banner"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          We use essential cookies to keep you signed in. With your OK, we also count visits to improve Soko (no ads, no
          selling your data).{" "}
          <Link href="/legal/cookies" className="text-brand underline">
            Cookie policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => choose("essential")}>
            Essential only
          </Button>
          <Button onClick={() => choose("analytics")}>Accept analytics</Button>
        </div>
      </div>
    </section>
  );
}

export function AnalyticsChoice() {
  const [consent, setConsent] = React.useState<string | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => setConsent(readConsent()), 0);
    return () => clearTimeout(timer);
  }, []);
  const [pending, start] = React.useTransition();
  const set = (choice: "analytics" | "essential") =>
    start(async () => {
      await recordConsent(choice);
      setConsent(choice);
      toast.success(choice === "analytics" ? "Analytics turned on." : "Analytics turned off.");
    });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" data-testid="analytics-status">
        Analytics cookies: <strong>{consent === "analytics" ? "on" : "off"}</strong>
      </p>
      <div>
        {consent === "analytics" ? (
          <Button variant="secondary" disabled={pending} onClick={() => set("essential")}>
            Turn off analytics
          </Button>
        ) : (
          <Button variant="secondary" disabled={pending} onClick={() => set("analytics")}>
            Turn on analytics
          </Button>
        )}
      </div>
    </div>
  );
}

export function DeleteAccountForm() {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await deleteMyAccount(text);
          if (!result.ok) setError(result.error);
          // A full page load, so no signed-in state survives in the client.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          else window.location.assign("/?account_deleted=1");
        });
      }}
    >
      {error && (
        <p role="alert" className="border-danger bg-danger-subtle rounded-md border p-3 text-sm">
          {error}
        </p>
      )}
      <Field id="delete-confirm" label="Type DELETE to confirm">
        <Input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </Field>
      <Button
        type="submit"
        variant="danger"
        disabled={pending || text.trim().toUpperCase() !== "DELETE"}
        className="self-start"
      >
        Delete my account
      </Button>
    </form>
  );
}
