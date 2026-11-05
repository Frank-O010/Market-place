"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { reportReasons, type ReportTargetType } from "@/lib/trust/schemas";
import { createReport } from "@/server/actions/reports";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/label";
import { Textarea } from "@/components/ui/native-select";
import { submitKeepingValues } from "@/components/sell/submit";

const nouns: Record<ReportTargetType, string> = {
  LISTING: "listing",
  USER: "seller",
  MESSAGE: "message",
  REVIEW: "review",
};

/** "Report" link that opens a short form. Signed-out visitors are sent to sign in. */
export function ReportButton({
  targetType,
  targetId,
  signedIn,
  compact = false,
}: {
  targetType: ReportTargetType;
  targetId: string;
  signedIn: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = React.useActionState(
    async (prev: Awaited<ReturnType<typeof createReport>> | null, form: FormData) => {
      const result = await createReport(prev, form);
      if (result.ok) {
        setOpen(false);
        toast.success("Thanks. Our team will take a look.");
      }
      return result;
    },
    null,
  );
  const noun = nouns[targetType];

  const trigger = (
    <Button variant="ghost" size="md" className="text-muted">
      <Flag aria-hidden /> Report{compact ? "" : ` this ${noun}`}
    </Button>
  );
  if (!signedIn) {
    return (
      <Button asChild variant="ghost" size="md" className="text-muted">
        <a
          href={`/sign-in?redirect_url=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`}
        >
          <Flag aria-hidden /> Report{compact ? "" : ` this ${noun}`}
        </a>
      </Button>
    );
  }
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>Report this {noun}</DialogTitle>
        <DialogDescription>
          Reports are private. The {noun === "seller" ? "seller" : "other person"} isn&apos;t told who reported them.
        </DialogDescription>
        <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <FormMessage state={state} />
          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={errors.reason ? "report-reason-error" : undefined}
          >
            <legend className="mb-1 text-sm font-medium">What&apos;s wrong?</legend>
            {reportReasons[targetType].map((reason) => (
              <Choice key={reason} name="reason" value={reason}>
                {reason}
              </Choice>
            ))}
            {errors.reason && (
              <p id="report-reason-error" className="text-danger text-xs" role="alert">
                {errors.reason}
              </p>
            )}
          </fieldset>
          <Field id="report-details" label="Anything else? (optional)" error={errors.details}>
            <Textarea name="details" maxLength={1000} className="min-h-20" />
          </Field>
          <Button type="submit" disabled={pending}>
            Send report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
