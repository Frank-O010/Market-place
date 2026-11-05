"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitIdVerification } from "@/server/actions/verification";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { FormMessage } from "@/components/ui/form-message";
import { Field } from "@/components/ui/label";
import { submitKeepingValues } from "@/components/sell/submit";

export function IdVerificationForm() {
  const router = useRouter();
  const [state, action, pending] = React.useActionState(submitIdVerification, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Sent. We'll check it within 2 working days.");
      router.refresh();
    }
  }, [state, router]);
  return (
    <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        id="id-document"
        label="Photo of your national ID or passport"
        hint="The page with your photo and name. JPEG, PNG or WebP under 4 MB. Make sure the text is readable."
        error={errors.document}
      >
        <input
          type="file"
          name="document"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="file:border-border-strong file:bg-surface min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:px-3"
        />
      </Field>
      <div>
        <Choice type="checkbox" name="consent" aria-describedby={errors.consent ? "consent-error" : undefined}>
          I agree that Soko&apos;s team may view this photo to verify my identity. It is stored privately and never
          shown to buyers.
        </Choice>
        {errors.consent && (
          <p id="consent-error" role="alert" className="text-danger mt-1 text-xs">
            {errors.consent}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Send for checking"}
      </Button>
    </form>
  );
}
