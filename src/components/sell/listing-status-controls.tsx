"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteListing, setListingStatus } from "@/server/actions/listings";
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

export function ListingStatusControls({
  listingId,
  status,
  photoCount,
}: {
  listingId: string;
  status: string;
  photoCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function change(next: "ACTIVE" | "PAUSED" | "DRAFT", message: string) {
    setError(null);
    startTransition(async () => {
      const result = await setListingStatus(listingId, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        result.data?.pendingReview
          ? "Thanks! A moderator checks this listing before it goes live, usually within a few hours."
          : message,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="border-danger bg-danger-subtle rounded-md border p-3 text-sm">
          {error}
        </p>
      )}
      {status === "PENDING_REVIEW" && (
        <p role="status" className="border-border bg-surface-muted rounded-md border p-3 text-sm">
          Waiting for a moderator. New sellers&apos; first listings, and listings that might be prohibited items, are
          checked before they go live. We&apos;ll notify you.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status !== "ACTIVE" && status !== "PENDING_REVIEW" && (
          <Button
            size="lg"
            disabled={pending}
            onClick={() => change("ACTIVE", "Your listing is live.")}
            aria-describedby={photoCount === 0 ? "publish-hint" : undefined}
          >
            Publish
          </Button>
        )}
        {status === "ACTIVE" && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => change("PAUSED", "Listing paused. Buyers can't see it.")}
          >
            Pause
          </Button>
        )}
        {status === "PAUSED" && (
          <Button variant="ghost" disabled={pending} onClick={() => change("DRAFT", "Moved back to drafts.")}>
            Move to drafts
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" disabled={pending}>
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>
              It and its photos will be removed for good. This can&apos;t be undone.
            </DialogDescription>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Keep it</Button>
              </DialogClose>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteListing(listingId);
                    if (result && !result.ok) toast.error(result.error);
                  })
                }
              >
                Delete listing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {photoCount === 0 && status !== "ACTIVE" && (
        <p id="publish-hint" className="text-muted text-sm">
          Add at least one photo to publish.
        </p>
      )}
    </div>
  );
}
