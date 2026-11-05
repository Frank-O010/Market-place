"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { createReview, replyToReview } from "@/server/actions/reviews";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/native-select";
import { submitKeepingValues } from "@/components/sell/submit";
import { cn } from "@/lib/utils";

const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ReviewForm({ orderId, sellerName }: { orderId: string; sellerName: string }) {
  const router = useRouter();
  const [rating, setRating] = React.useState(0);
  const [state, action, pending] = React.useActionState(createReview.bind(null, orderId), null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Thanks for your review!");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      onSubmit={submitKeepingValues(action)}
      className="border-border flex flex-col gap-4 rounded-lg border p-4"
      noValidate
    >
      <h2 className="text-xl font-semibold">Review {sellerName}</h2>
      <FormMessage state={state} />
      <fieldset aria-describedby={errors.rating ? "rating-error" : undefined}>
        <legend className="mb-2 text-sm font-medium">How was it?</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="relative cursor-pointer">
              {/* Invisible but full-size, so the whole 44px star is the tap target. */}
              <input
                type="radio"
                name="rating"
                value={value}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                checked={rating === value}
                onChange={() => setRating(value)}
              />
              <span className="peer-focus-visible:outline-brand flex size-11 items-center justify-center rounded-md peer-focus-visible:outline-2">
                <Star
                  aria-hidden
                  className={cn("size-8", value <= rating ? "fill-rating text-rating" : "text-border-strong")}
                />
              </span>
              <span className="sr-only">
                {value} star{value > 1 ? "s" : ""}, {labels[value]}
              </span>
            </label>
          ))}
        </div>
        <p className="text-muted mt-1 text-sm" aria-live="polite">
          {rating ? labels[rating] : "Tap a star"}
        </p>
        {errors.rating && (
          <p id="rating-error" role="alert" className="text-danger text-xs">
            {errors.rating}
          </p>
        )}
      </fieldset>
      <Field id="review-body" label="Tell other buyers about it (optional)" error={errors.body}>
        <Textarea name="body" maxLength={1000} className="min-h-24" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        Post review
      </Button>
    </form>
  );
}

export function ReviewReplyForm({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(replyToReview.bind(null, reviewId), null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Reply posted.");
      router.refresh();
    }
  }, [state, router]);
  return (
    <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-3" noValidate>
      <FormMessage state={state} />
      <Field
        id="review-reply"
        label="Reply publicly"
        hint="Shown under the review on your shop page."
        error={errors.reply}
      >
        <Textarea name="reply" maxLength={1000} className="min-h-20" />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        Post reply
      </Button>
    </form>
  );
}
