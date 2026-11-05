"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as actions from "@/server/actions/moderation";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/native-select";

type Result = { ok: boolean; error?: string };

function useRun() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (task: () => Promise<Result>, success: string, after?: () => void) =>
    start(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error ?? "Something went wrong.");
      else {
        toast.success(success);
        after?.();
      }
      router.refresh();
    });
  return { pending, run };
}

/** A button that runs a moderation action straight away. */
export function ModButton({
  label,
  done,
  action,
  variant = "secondary",
}: {
  label: string;
  done: string;
  action: () => Promise<Result>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const { pending, run } = useRun();
  return (
    <Button variant={variant} disabled={pending} onClick={() => run(action, done)}>
      {label}
    </Button>
  );
}

/** A button that asks for a reason first (shown to the seller or kept in the audit log). */
export function ModNoteButton({
  label,
  title,
  description,
  done,
  action,
  variant = "secondary",
}: {
  label: string;
  title: string;
  description: string;
  done: string;
  action: (note: string) => Promise<Result>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const { pending, run } = useRun();
  const id = React.useId();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => action(note),
              done,
              () => setOpen(false),
            );
          }}
        >
          <Field id={id} label="Reason">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" />
          </Field>
          <Button type="submit" variant={variant === "ghost" ? "secondary" : variant} disabled={pending}>
            {label}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ListingModeration({ listingId }: { listingId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ModButton
        label="Approve"
        done="Listing approved."
        variant="primary"
        action={() => actions.approveListing(listingId)}
      />
      <ModNoteButton
        label="Send back"
        title="Send back to the seller"
        description="The listing goes back to drafts. The seller sees your reason and can fix it."
        done="Sent back to the seller."
        action={(note) => actions.rejectListing(listingId, note, false)}
      />
      <ModNoteButton
        label="Remove"
        variant="danger"
        title="Remove this listing"
        description="For prohibited or illegal items. The seller can't republish it."
        done="Listing removed."
        action={(note) => actions.rejectListing(listingId, note, true)}
      />
    </div>
  );
}

export function SuspendUserButton({ userId, suspended }: { userId: string; suspended: boolean }) {
  return suspended ? (
    <ModButton
      label="Reinstate user"
      done="User reinstated."
      action={() => actions.setUserSuspended(userId, false, "")}
    />
  ) : (
    <ModNoteButton
      label="Suspend user"
      variant="danger"
      title="Suspend this user"
      description="They can't sign in to buy or sell, and their listings are paused."
      done="User suspended."
      action={(note) => actions.setUserSuspended(userId, true, note)}
    />
  );
}

export function VerificationReview({ sellerId }: { sellerId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ModButton
        label="Approve ID"
        variant="primary"
        done="Seller verified."
        action={() => actions.reviewIdVerification(sellerId, "ID_VERIFIED", "")}
      />
      <ModButton
        label="Approve as business"
        done="Business verified."
        action={() => actions.reviewIdVerification(sellerId, "BUSINESS_VERIFIED", "")}
      />
      <ModNoteButton
        label="Reject"
        variant="danger"
        title="Reject this ID photo"
        description="The photo is deleted. Tell the seller what to fix (they see your reason)."
        done="Rejected. The seller has been told."
        action={(note) => actions.reviewIdVerification(sellerId, "REJECT", note)}
      />
    </div>
  );
}

export function FraudReview({ orderId, canRefund }: { orderId: string; canRefund: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ModButton
        label="Looks fine: release hold"
        variant="primary"
        done="Hold released."
        action={() => actions.clearFraudFlags(orderId)}
      />
      {canRefund && (
        <ModNoteButton
          label="Refund and cancel"
          variant="danger"
          title="Refund and cancel this order"
          description="The buyer is refunded in full and the seller is told not to send the item."
          done="Order refunded."
          action={(note) => actions.refundFlaggedOrder(orderId, note)}
        />
      )}
    </div>
  );
}

/** Staff decision on a dispute. */
export function DisputeResolutionForm({ disputeId, maxPartialKes }: { disputeId: string; maxPartialKes: string }) {
  const [resolution, setResolution] = React.useState<"FULL_REFUND" | "PARTIAL_REFUND" | "RELEASE_TO_SELLER" | "">("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const { pending, run } = useRun();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!resolution) return toast.error("Choose an outcome.");
        run(() => actions.resolveDisputeAsStaff(disputeId, resolution, amount, note), "Dispute resolved.");
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Outcome</legend>
        <Choice
          name="resolution"
          value="FULL_REFUND"
          checked={resolution === "FULL_REFUND"}
          onChange={() => setResolution("FULL_REFUND")}
        >
          Full refund to the buyer
        </Choice>
        <Choice
          name="resolution"
          value="PARTIAL_REFUND"
          checked={resolution === "PARTIAL_REFUND"}
          onChange={() => setResolution("PARTIAL_REFUND")}
        >
          Partial refund, the rest to the seller
        </Choice>
        <Choice
          name="resolution"
          value="RELEASE_TO_SELLER"
          checked={resolution === "RELEASE_TO_SELLER"}
          onChange={() => setResolution("RELEASE_TO_SELLER")}
        >
          Release the payment to the seller
        </Choice>
      </fieldset>
      {resolution === "PARTIAL_REFUND" && (
        <Field
          id="refund-amount"
          label="Refund amount (KES)"
          hint={`Less than KES ${maxPartialKes} (the seller's share).`}
        >
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      )}
      <Field id="resolution-note" label="Explanation for both sides" hint="Both the buyer and the seller see this.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        Resolve dispute
      </Button>
    </form>
  );
}
