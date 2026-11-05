"use client";

import * as React from "react";
import { toast } from "sonner";
import { saveNotificationPrefs } from "@/server/actions/notifications";
import type { NotificationPrefs } from "@/lib/trust/schemas";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { FormMessage } from "@/components/ui/form-message";
import { submitKeepingValues } from "@/components/sell/submit";

export function NotificationPrefsForm({ prefs, hasPhone }: { prefs: NotificationPrefs; hasPhone: boolean }) {
  const [state, action, pending] = React.useActionState(saveNotificationPrefs, null);
  React.useEffect(() => {
    if (state?.ok) toast.success("Settings saved.");
  }, [state]);
  return (
    <form onSubmit={submitKeepingValues(action)} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <Choice type="checkbox" name="messageEmail" defaultChecked={prefs.messageEmail}>
        <strong>Email me about new messages</strong>
        <span className="text-muted block text-sm">At most one email per conversation every 15 minutes.</span>
      </Choice>
      <Choice type="checkbox" name="orderSms" defaultChecked={prefs.orderSms}>
        <strong>Text me about orders</strong>
        <span className="text-muted block text-sm">
          When you get a new order, or your order is on the way.
          {!hasPhone && " We'll use the phone number you pay with."}
        </span>
      </Choice>
      <p className="text-muted text-sm">
        Receipts and messages about payments and problems with orders are always sent by email.
      </p>
      <Button type="submit" disabled={pending} className="self-start">
        Save settings
      </Button>
    </form>
  );
}
