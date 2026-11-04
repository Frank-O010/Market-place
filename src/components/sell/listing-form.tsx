"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { categoryAttributes } from "@/config/category-attributes";
import { nairobiAreas } from "@/config/locations";
import { conditionLabels, listingConditions, MAX_VARIANTS } from "@/lib/listings/schema";
import { saveListing } from "@/server/actions/listings";
import { submitKeepingValues } from "@/components/sell/submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { NativeSelect, Textarea } from "@/components/ui/native-select";

export type CategoryOption = { id: string; name: string; slug: string; children: { id: string; name: string }[] };

export type ListingFormValues = {
  title: string;
  categoryId: string;
  condition: string;
  price: string;
  stock: string;
  location: string;
  description: string;
  attributes: Record<string, string>;
  variants: { name: string; price: string; stock: string }[];
};

export function ListingForm({
  listingId,
  categories,
  initial,
}: {
  listingId: string | null;
  categories: CategoryOption[];
  initial: ListingFormValues;
}) {
  const [state, action, pending] = React.useActionState(saveListing.bind(null, listingId), null);
  const [categoryId, setCategoryId] = React.useState(initial.categoryId);
  const [variants, setVariants] = React.useState(initial.variants.map((v, i) => ({ ...v, key: i })));
  const nextKey = React.useRef(initial.variants.length);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  const topSlug = categories.find(
    (c) => c.id === categoryId || c.children.some((child) => child.id === categoryId),
  )?.slug;
  const attributeFields = (topSlug && categoryAttributes[topSlug]) || [];

  return (
    <form onSubmit={submitKeepingValues(action)} className="flex max-w-2xl flex-col gap-5" noValidate>
      {state && !state.ok && (
        <p role="alert" className="border-danger bg-danger-subtle rounded-md border p-3 text-sm">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="border-success bg-success-subtle rounded-md border p-3 text-sm">
          Changes saved.
        </p>
      )}

      <Field
        id="title"
        label="Title"
        error={errors.title}
        hint="Say what it is, e.g. “Samsung Galaxy A54, 128GB, black”."
      >
        <Input name="title" defaultValue={initial.title} required maxLength={80} />
      </Field>

      <Field id="categoryId" label="Category" error={errors.categoryId}>
        <NativeSelect name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          <option value="">Choose a category</option>
          {categories.map((top) =>
            top.children.length ? (
              <optgroup key={top.id} label={top.name}>
                {top.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={top.id} value={top.id}>
                {top.name}
              </option>
            ),
          )}
        </NativeSelect>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="price" label="Price (KES)" error={errors.price}>
          <Input name="price" defaultValue={initial.price} inputMode="decimal" placeholder="e.g. 12500" required />
        </Field>
        <Field id="stock" label="How many do you have?" error={errors.stock}>
          <Input
            name="stock"
            defaultValue={initial.stock}
            inputMode="numeric"
            type="number"
            min={0}
            max={999}
            required
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="condition" label="Condition" error={errors.condition}>
          <NativeSelect name="condition" defaultValue={initial.condition} required>
            <option value="">Choose the condition</option>
            {listingConditions.map((c) => (
              <option key={c} value={c}>
                {conditionLabels[c]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="location" label="Where is the item?" error={errors.location}>
          <NativeSelect name="location" defaultValue={initial.location} required>
            <option value="">Choose an area</option>
            {nairobiAreas.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field
        id="description"
        label="Description"
        error={errors.description}
        hint="Include size, age, any faults and what's in the box."
      >
        <Textarea name="description" defaultValue={initial.description} required maxLength={5000} />
      </Field>

      {attributeFields.length > 0 && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-semibold">Details (optional)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {attributeFields.map((field) => (
              <Field
                key={field.key}
                id={`attr-${field.key}`}
                label={field.label}
                error={errors[`attributes.${field.key}`]}
              >
                <Input
                  name={`attributes.${field.key}`}
                  defaultValue={initial.attributes[field.key] ?? ""}
                  placeholder={field.placeholder}
                  maxLength={60}
                />
              </Field>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">Options (optional)</legend>
        <p className="text-muted text-sm">
          Add options if the item comes in different colours or sizes. Leave the price empty to use the main price.
        </p>
        {errors.variants && (
          <p className="text-danger text-sm" role="alert">
            {errors.variants}
          </p>
        )}
        {variants.map((variant, i) => (
          <div
            key={variant.key}
            className="border-border grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_8rem_6rem_auto] sm:items-end"
          >
            <Field
              id={`variant-${variant.key}-name`}
              label={`Option ${i + 1} name`}
              error={errors[`variants.${i}.name`]}
            >
              <Input
                name={`variants.${i}.name`}
                defaultValue={variant.name}
                placeholder="e.g. Black / 128GB"
                maxLength={60}
              />
            </Field>
            <Field id={`variant-${variant.key}-price`} label="Price (KES)" error={errors[`variants.${i}.price`]}>
              <Input name={`variants.${i}.price`} defaultValue={variant.price} inputMode="decimal" />
            </Field>
            <Field id={`variant-${variant.key}-stock`} label="Stock" error={errors[`variants.${i}.stock`]}>
              <Input
                name={`variants.${i}.stock`}
                defaultValue={variant.stock}
                type="number"
                min={0}
                max={999}
                inputMode="numeric"
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove option ${i + 1}`}
              onClick={() => setVariants((rows) => rows.filter((row) => row.key !== variant.key))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        {variants.length < MAX_VARIANTS && (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() =>
              setVariants((rows) => [...rows, { key: nextKey.current++, name: "", price: "", stock: "1" }])
            }
          >
            <Plus aria-hidden /> Add an option
          </Button>
        )}
      </fieldset>

      <Button type="submit" disabled={pending} className="self-start" size="lg">
        {pending ? "Saving…" : listingId ? "Save changes" : "Save and add photos"}
      </Button>
    </form>
  );
}
