"use client";

import * as React from "react";
import { nairobiAreas } from "@/config/locations";
import { slugify } from "@/lib/utils";
import { saveSellerProfile } from "@/server/actions/seller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { NativeSelect, Textarea } from "@/components/ui/native-select";

type Profile = { displayName: string; slug: string; location: string; bio: string };

export function SellerProfileForm({ initial, submitLabel }: { initial: Profile; submitLabel: string }) {
  const [state, action, pending] = React.useActionState(saveSellerProfile, null);
  const [name, setName] = React.useState(initial.displayName);
  const [slug, setSlug] = React.useState(initial.slug);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial.slug));
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4" noValidate>
      {state && !state.ok && (
        <p role="alert" className="border-danger bg-danger-subtle rounded-md border p-3 text-sm">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="border-success bg-success-subtle rounded-md border p-3 text-sm">
          Shop details saved.
        </p>
      )}
      <Field id="displayName" label="Shop name" error={errors.displayName} hint="Shown to buyers on every listing.">
        <Input
          name="displayName"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value).slice(0, 40));
          }}
          autoComplete="organization"
          required
          maxLength={60}
        />
      </Field>
      <Field id="slug" label="Shop address" error={errors.slug} hint={`Your shop page: /s/${slug || "your-shop"}`}>
        <Input
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={40}
        />
      </Field>
      <Field id="location" label="Where you sell from" error={errors.location}>
        <NativeSelect name="location" defaultValue={initial.location} required>
          <option value="">Choose an area</option>
          {nairobiAreas.map((area) => (
            <option key={area}>{area}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="bio" label="About your shop (optional)" error={errors.bio} hint="Up to 300 characters.">
        <Textarea name="bio" defaultValue={initial.bio} maxLength={300} className="min-h-24" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
