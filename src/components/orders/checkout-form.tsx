"use client";

import * as React from "react";
import { nairobiAreas } from "@/config/locations";
import { formatKes } from "@/lib/money";
import { placeOrder } from "@/server/actions/checkout";
import { submitKeepingValues } from "@/components/sell/submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { NativeSelect, Textarea } from "@/components/ui/native-select";

export function CheckoutForm({
  sellerId,
  sellerArea,
  subtotalMinor,
  deliveryFeeMinor,
  defaultPhone,
  hasEmail,
}: {
  sellerId: string;
  sellerArea: string | null;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  defaultPhone: string;
  hasEmail: boolean;
}) {
  const [state, action, pending] = React.useActionState(placeOrder, null);
  const [delivery, setDelivery] = React.useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [method, setMethod] = React.useState<"MPESA" | "CARD">("MPESA");
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const total = subtotalMinor + (delivery === "DELIVERY" ? deliveryFeeMinor : 0);

  return (
    <form onSubmit={submitKeepingValues(action)} className="flex max-w-xl flex-col gap-6" noValidate>
      <input type="hidden" name="sellerId" value={sellerId} />
      {state && !state.ok && (
        <p role="alert" className="border-danger bg-danger-subtle rounded-md border p-3 text-sm">
          {state.error}
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold">How do you want to get it?</legend>
        <Choice
          name="deliveryMethod"
          value="PICKUP"
          checked={delivery === "PICKUP"}
          onChange={() => setDelivery("PICKUP")}
        >
          <strong>Pick up</strong> from the seller{sellerArea ? ` in ${sellerArea}` : ""}. Free.
        </Choice>
        <Choice
          name="deliveryMethod"
          value="DELIVERY"
          checked={delivery === "DELIVERY"}
          onChange={() => setDelivery("DELIVERY")}
        >
          <strong>Delivery</strong> within Nairobi: {formatKes(deliveryFeeMinor)}.
        </Choice>
      </fieldset>

      {delivery === "DELIVERY" && (
        <div className="flex flex-col gap-4">
          <Field id="area" label="Your area" error={errors.area}>
            <NativeSelect name="area" defaultValue="">
              <option value="">Choose your area</option>
              {nairobiAreas.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            id="address"
            label="Directions"
            hint="Building, street, landmark. The seller sees this."
            error={errors.address}
          >
            <Textarea name="address" className="min-h-20" maxLength={300} />
          </Field>
        </div>
      )}

      <Field id="phone" label="Phone number" hint="For M-Pesa and for the seller to reach you." error={errors.phone}>
        <Input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={defaultPhone}
          placeholder="0712 345 678"
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-lg font-semibold">How do you want to pay?</legend>
        <Choice name="paymentMethod" value="MPESA" checked={method === "MPESA"} onChange={() => setMethod("MPESA")}>
          <strong>M-Pesa</strong>. We&apos;ll send a prompt to your phone; enter your PIN to pay.
        </Choice>
        <Choice
          name="paymentMethod"
          value="CARD"
          checked={method === "CARD"}
          onChange={() => setMethod("CARD")}
          disabled={!hasEmail}
        >
          <strong>Card</strong> (Visa or Mastercard).{!hasEmail && " Add an email to your account to use a card."}
        </Choice>
      </fieldset>

      <div className="border-border flex flex-col gap-1 rounded-lg border p-4">
        <p className="flex justify-between">
          <span>Items</span> <span>{formatKes(subtotalMinor)}</span>
        </p>
        <p className="flex justify-between">
          <span>Delivery</span> <span>{delivery === "DELIVERY" ? formatKes(deliveryFeeMinor) : "Free"}</span>
        </p>
        <p className="flex justify-between text-lg font-bold" data-testid="checkout-total">
          <span>Total</span> <span>{formatKes(total)}</span>
        </p>
        <p className="text-muted pt-2 text-sm">
          Your money is held safely and only released to the seller after you confirm the item arrived.
        </p>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "Placing your order…"
          : method === "MPESA"
            ? `Pay ${formatKes(total)} with M-Pesa`
            : `Pay ${formatKes(total)} by card`}
      </Button>
    </form>
  );
}

function Choice({ children, ...props }: React.ComponentProps<"input"> & { children: React.ReactNode }) {
  return (
    <label className="border-border-strong has-checked:border-brand has-checked:bg-brand-subtle flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 has-disabled:cursor-not-allowed has-disabled:opacity-60">
      <input type="radio" className="mt-1 size-5 shrink-0" {...props} />
      <span>{children}</span>
    </label>
  );
}
