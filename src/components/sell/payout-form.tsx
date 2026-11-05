"use client";

import * as React from "react";
import { savePayoutDetails } from "@/server/actions/payouts";
import { submitKeepingValues } from "@/components/sell/submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

export function PayoutForm({ current }: { current: string | null }) {
  const [state, action, pending] = React.useActionState(savePayoutDetails, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="flex max-w-md flex-col gap-4" noValidate>
      {state && !state.ok && (
        <p role="alert" className="border-danger bg-danger-subtle rounded-md border p-3 text-sm">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="border-success bg-success-subtle rounded-md border p-3 text-sm">
          Payout number saved.
        </p>
      )}
      {current && (
        <p className="text-sm">
          Payouts currently go to: <strong>{current}</strong>
        </p>
      )}
      <Field id="payout-name" label="Name on the M-Pesa line" error={errors.name}>
        <Input name="name" autoComplete="name" />
      </Field>
      <Field id="payout-phone" label="M-Pesa number" error={errors.phone} hint="We never store the full number.">
        <Input name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : current ? "Change payout number" : "Save payout number"}
      </Button>
    </form>
  );
}
