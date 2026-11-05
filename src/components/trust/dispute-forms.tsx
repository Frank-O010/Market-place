"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { disputeReasons } from "@/lib/trust/schemas";
import { openDispute, respondToDispute, settleDispute } from "@/server/actions/disputes";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/native-select";
import { submitKeepingValues } from "@/components/sell/submit";

/** Wraps a form action: on success, shows a toast, runs `after` and refreshes the page. */
function useFormAction<P extends { ok: boolean }>(
  action: (prev: P | null, form: FormData) => Promise<P>,
  message: string,
  after?: () => void,
) {
  const router = useRouter();
  return React.useActionState(async (prev: P | null, form: FormData) => {
    const result = await action(prev, form);
    if (result.ok) {
      toast.success(message);
      after?.();
      router.refresh();
    }
    return result;
  }, null);
}

/** Buyer: "Report a problem" with the order. */
export function OpenDisputeButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useFormAction(
    openDispute.bind(null, orderId),
    "Problem reported. The payment stays on hold.",
    () => setOpen(false),
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Report a problem</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>Report a problem with this order</DialogTitle>
        <DialogDescription>
          We&apos;ll hold the payment while the seller replies and our team looks into it.
        </DialogDescription>
        <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-4" noValidate>
          <FormMessage state={state} />
          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={errors.reason ? "dispute-reason-error" : undefined}
          >
            <legend className="mb-1 text-sm font-medium">What went wrong?</legend>
            {Object.entries(disputeReasons).map(([value, label]) => (
              <Choice key={value} name="reason" value={value}>
                {label}
              </Choice>
            ))}
            {errors.reason && (
              <p id="dispute-reason-error" role="alert" className="text-danger text-xs">
                {errors.reason}
              </p>
            )}
          </fieldset>
          <Field
            id="dispute-details"
            label="What happened?"
            hint="Dates, what you expected, what you got."
            error={errors.details}
          >
            <Textarea name="details" maxLength={2000} className="min-h-28" />
          </Field>
          <Field
            id="dispute-photos"
            label="Photos (optional, up to 3)"
            hint="JPEG, PNG or WebP, under 4 MB each. Only you, the seller and our team can see them."
            error={errors.photos}
          >
            <input
              type="file"
              name="photos"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="file:border-border-strong file:bg-surface min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:px-3"
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Report problem"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Seller: give their side of the story. */
export function DisputeResponseForm({ disputeId }: { disputeId: string }) {
  const [state, action, pending] = useFormAction(
    respondToDispute.bind(null, disputeId),
    "Reply sent. A moderator will review it.",
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      <Field
        id="dispute-response"
        label="Your side"
        hint="Explain what happened. Our team reads both sides."
        error={errors.response}
      >
        <Textarea name="response" maxLength={2000} className="min-h-24" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        Send reply
      </Button>
    </form>
  );
}

/** Buyer releases the payment, or seller refunds the buyer, ending the dispute. */
export function SettleDisputeButton({ disputeId, outcome }: { disputeId: string; outcome: "release" | "refund" }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const copy =
    outcome === "release"
      ? {
          button: "Problem sorted: release payment",
          title: "Release the payment to the seller?",
          body: "Only do this if the problem has been sorted out. This can't be undone.",
          confirm: "Yes, release payment",
          done: "Thanks. The seller is being paid.",
        }
      : {
          button: "Refund the buyer",
          title: "Refund the buyer in full?",
          body: "The buyer gets all their money back and the order closes. This can't be undone.",
          confirm: "Yes, refund in full",
          done: "The buyer is being refunded.",
        };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{copy.button}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.body}</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await settleDispute(disputeId, outcome);
                  if (!result.ok) toast.error(result.error);
                  else toast.success(copy.done);
                  router.refresh();
                })
              }
            >
              {copy.confirm}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
