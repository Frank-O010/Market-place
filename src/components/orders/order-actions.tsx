"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { retryPayment } from "@/server/actions/checkout";
import { cancelUnpaidOrder, confirmDelivery, markShipped, sellerCancelOrder } from "@/server/actions/orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";

type Result = { ok: boolean; error?: string } | undefined;

function useRun() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (task: () => Promise<Result>, success: string) =>
    start(async () => {
      const result = await task();
      if (result && !result.ok) toast.error(result.error ?? "Something went wrong.");
      else if (result) toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

/** While an M-Pesa or card payment is in progress, re-check the order every few seconds. */
export function PaymentWatcher({ active }: { active: boolean }) {
  const router = useRouter();
  React.useEffect(() => {
    if (!active) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > 40) clearInterval(timer); // stop after ~2 minutes
      router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}

export function BuyerPendingActions({ orderId, canCard }: { orderId: string; canCard: boolean }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={pending}
        onClick={() => run(() => retryPayment(orderId, "MPESA"), "We've sent a new M-Pesa prompt.")}
      >
        Send M-Pesa prompt again
      </Button>
      {canCard && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => retryPayment(orderId, "CARD"), "Opening card payment…")}
        >
          Pay by card instead
        </Button>
      )}
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => cancelUnpaidOrder(orderId), "Order cancelled.")}
      >
        Cancel order
      </Button>
    </div>
  );
}

export function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const { pending, run } = useRun();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg">I received it</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Did the item arrive as described?</DialogTitle>
        <DialogDescription>
          Confirming releases your payment to the seller. Only confirm once you have checked the item.
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Not yet</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              disabled={pending}
              onClick={() => run(() => confirmDelivery(orderId), "Thanks! The seller is being paid.")}
            >
              Yes, release payment
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SellerFulfilmentActions({
  orderId,
  canShip,
  canCancel,
}: {
  orderId: string;
  canShip: boolean;
  canCancel: boolean;
}) {
  const { pending, run } = useRun();
  const [note, setNote] = React.useState("");
  const [reason, setReason] = React.useState("");
  return (
    <div className="flex flex-col gap-4">
      {canShip && (
        <div className="flex flex-col gap-2">
          <Field
            id="tracking-note"
            label="Note for the buyer (optional)"
            hint="e.g. rider's name and phone, or when to collect."
          >
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
          <Button
            className="self-start"
            disabled={pending}
            onClick={() => run(() => markShipped(orderId, note), "Marked as shipped.")}
          >
            Mark as shipped
          </Button>
        </div>
      )}
      {canCancel && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="self-start">
              Cancel this order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Cancel and refund?</DialogTitle>
            <DialogDescription>If the buyer has paid, they get a full refund. Please tell them why.</DialogDescription>
            <Field id="cancel-reason" label="Reason">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Keep the order</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => run(() => sellerCancelOrder(orderId, reason), "Order cancelled.")}
                >
                  Cancel order
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
