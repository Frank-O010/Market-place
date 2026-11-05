"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as actions from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { NativeSelect, Textarea } from "@/components/ui/native-select";

type Result = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

/** useActionState with a success toast and a refresh, so forms show fresh values after saving. */
function useSavingForm(action: (prev: null, data: FormData) => Promise<Result>, success: string) {
  const router = useRouter();
  return React.useActionState(async (_prev: Result | null, data: FormData): Promise<Result> => {
    const result = await action(null, data);
    if (result.ok) {
      toast.success(success);
      router.refresh();
    }
    return result;
  }, null);
}

function useRun() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (task: () => Promise<Result>, success: string) =>
    start(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error ?? "Something went wrong.");
      else toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

const roleLabels = {
  SELLER: "Seller (has a shop)",
  MODERATOR: "Moderator (review queues, disputes, suspensions)",
  ADMIN: "Admin (settings, roles, payouts, audit log)",
} as const;

export function RolesForm({ userId, roles }: { userId: string; roles: string[] }) {
  const { pending, run } = useRun();
  const [selected, setSelected] = React.useState(roles);
  const toggle = (role: string, on: boolean) => setSelected((s) => (on ? [...s, role] : s.filter((r) => r !== role)));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => actions.setUserRoles(userId, selected), "Roles updated");
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Roles</legend>
        <p className="text-muted text-sm">Everyone can buy. Role changes are logged and alerted.</p>
        {(Object.keys(roleLabels) as (keyof typeof roleLabels)[]).map((role) => (
          <Choice
            key={role}
            type="checkbox"
            name="roles"
            value={role}
            checked={selected.includes(role)}
            onChange={(e) => toggle(role, e.currentTarget.checked)}
          >
            {roleLabels[role]}
          </Choice>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending} className="self-start">
        Save roles
      </Button>
    </form>
  );
}

const tiers = [
  ["UNVERIFIED", "Unverified"],
  ["PHONE_VERIFIED", "Phone verified"],
  ["ID_VERIFIED", "ID verified"],
  ["BUSINESS_VERIFIED", "Business verified"],
] as const;

export function TierForm({ userId, tier }: { userId: string; tier: string }) {
  const { pending, run } = useRun();
  const [value, setValue] = React.useState(tier);
  const id = React.useId();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => actions.setSellerTier(userId, value), "Seller tier updated");
      }}
    >
      <Field id={id} label="Seller verification tier" hint="Shown as a badge on the shop and its listings.">
        <NativeSelect value={value} onChange={(e) => setValue(e.currentTarget.value)}>
          {tiers.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        Save tier
      </Button>
    </form>
  );
}

export type SettingsValues = {
  commissionPercent: string;
  deliveryFee: string;
  autoReleaseDays: number;
  prohibitedKeywords: string[];
  checkoutEnabled: boolean;
  reviewAllNewListings: boolean;
};

export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, formAction, pending] = useSavingForm(actions.saveSettings, "Settings saved");
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <FormMessage state={state} />
      <Field
        id="commission_percent"
        label="Commission (%)"
        hint="Taken from each sale before the seller is paid. Applies to new orders only."
        error={errors.commission_percent}
      >
        <Input name="commission_percent" inputMode="decimal" defaultValue={values.commissionPercent} required />
      </Field>
      <Field
        id="delivery_fee"
        label="Delivery fee within Nairobi (KES)"
        hint="Charged to the buyer and passed to the seller."
        error={errors.delivery_fee}
      >
        <Input name="delivery_fee" inputMode="numeric" defaultValue={values.deliveryFee} required />
      </Field>
      <Field
        id="auto_release_days"
        label="Days before payment is released automatically"
        hint="After the seller marks an order as sent, if the buyer doesn't confirm or open a dispute."
        error={errors.auto_release_days}
      >
        <Input name="auto_release_days" inputMode="numeric" defaultValue={values.autoReleaseDays} required />
      </Field>
      <Field
        id="prohibited_keywords"
        label="Words that send a listing for review"
        hint="One word or phrase per line."
        error={errors.prohibited_keywords}
      >
        <Textarea name="prohibited_keywords" defaultValue={values.prohibitedKeywords.join("\n")} rows={8} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Switches</legend>
        <Choice type="checkbox" name="checkout_enabled" defaultChecked={values.checkoutEnabled}>
          <strong>Checkout is on.</strong> Turn off to pause all new orders, for example during a payment outage.
        </Choice>
        <Choice type="checkbox" name="review_all_new_listings" defaultChecked={values.reviewAllNewListings}>
          <strong>Review every new listing.</strong> Otherwise only new sellers and flagged listings are checked.
        </Choice>
      </fieldset>
      <Button type="submit" disabled={pending} className="self-start">
        Save settings
      </Button>
    </form>
  );
}

type CategoryOption = { id: string; name: string };

export function CategoryForm({
  category,
  parents,
}: {
  category?: { id: string; name: string; parentId: string | null; sortOrder: number };
  parents: CategoryOption[];
}) {
  const [state, formAction, pending] = useSavingForm(
    actions.saveCategory,
    category ? "Category saved" : "Category added",
  );
  const errors = state?.fieldErrors ?? {};
  const prefix = category?.id ?? "new";
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state} />
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
        <Field id={`${prefix}-name`} label="Name" error={errors.name}>
          <Input name="name" defaultValue={category?.name} required />
        </Field>
        <Field id={`${prefix}-parent`} label="Parent" error={errors.parentId}>
          <NativeSelect name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">None (top level)</option>
            {parents
              .filter((p) => p.id !== category?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field id={`${prefix}-order`} label="Order" error={errors.sortOrder}>
          <Input name="sortOrder" inputMode="numeric" defaultValue={category?.sortOrder ?? 0} />
        </Field>
      </div>
      <Button type="submit" variant={category ? "secondary" : "primary"} disabled={pending} className="self-start">
        {category ? "Save" : "Add category"}
      </Button>
    </form>
  );
}

export function DeleteCategoryButton({ categoryId, name }: { categoryId: string; name: string }) {
  const { pending, run } = useRun();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      aria-label={`Delete ${name}`}
      onClick={() => {
        if (window.confirm(`Delete the ${name} category?`)) run(() => actions.deleteCategory(categoryId), "Deleted");
      }}
    >
      Delete
    </Button>
  );
}

export function RetryPayoutButton({ payoutId }: { payoutId: string }) {
  const { pending, run } = useRun();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => run(() => actions.retryPayout(payoutId), "Payout sent")}
    >
      Retry
    </Button>
  );
}
