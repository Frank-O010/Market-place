import { z } from "zod";
import { nairobiAreas } from "@/config/locations";
import { parseKes } from "@/lib/money";

/**
 * Validation for the listing editor. Shared by the form (for instant feedback) and the server
 * action (which is the only place that matters for security).
 */

export const listingConditions = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "FOR_PARTS"] as const;
export type ListingConditionValue = (typeof listingConditions)[number];

export const conditionLabels: Record<ListingConditionValue, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  FOR_PARTS: "For parts or repair",
};

/** Highest price a single listing may have: KES 10 million, in minor units. */
export const MAX_PRICE_MINOR = 10_000_000 * 100;
export const MAX_VARIANTS = 20;

const kesAmount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .transform((value, ctx) => {
      try {
        const minor = parseKes(value);
        if (minor < 100) {
          ctx.addIssue({ code: "custom", message: "The minimum price is KES 1" });
          return z.NEVER;
        }
        if (minor > MAX_PRICE_MINOR) {
          ctx.addIssue({ code: "custom", message: "The maximum price is KES 10,000,000" });
          return z.NEVER;
        }
        return minor;
      } catch {
        ctx.addIssue({ code: "custom", message: "Enter a price in shillings, like 12500" });
        return z.NEVER;
      }
    });

const wholeNumber = (label: string, max: number) =>
  z.coerce
    .number({ message: `Enter ${label}` })
    .int(`${label[0]!.toUpperCase()}${label.slice(1)} must be a whole number`)
    .min(0, `${label[0]!.toUpperCase()}${label.slice(1)} can't be negative`)
    .max(max, `The most you can enter is ${max}`);

export const variantSchema = z.object({
  name: z.string().trim().min(1, "Name the option, like “Black / 128GB”").max(60),
  price: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(kesAmount("a price").optional()),
  stock: wholeNumber("stock", 999),
});

export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Use at least 5 characters so buyers can find it")
    .max(80, "Keep the title under 80 characters"),
  categoryId: z.string().min(1, "Choose a category"),
  condition: z.enum(listingConditions, { message: "Choose the condition" }),
  price: kesAmount("a price"),
  stock: wholeNumber("stock", 999),
  location: z.enum(nairobiAreas, { message: "Choose where the item is" }),
  description: z
    .string()
    .trim()
    .min(20, "Describe the item in at least 20 characters")
    .max(5000, "Keep the description under 5,000 characters"),
  attributes: z.record(z.string(), z.string().trim().max(60)).default({}),
  variants: z.array(variantSchema).max(MAX_VARIANTS, `You can add up to ${MAX_VARIANTS} options`).default([]),
});

export type ListingInput = z.input<typeof listingSchema>;
export type ListingData = z.output<typeof listingSchema>;

export type FieldErrors = Record<string, string>;

/** Flattens Zod issues to "path.to.field" -> first message, for showing next to form fields. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

/** Reads the editor's FormData (variants arrive as variants.0.name, variants.0.price, ...). */
export function listingFormToInput(form: FormData): ListingInput {
  const attributes: Record<string, string> = {};
  const variants: { name: string; price?: string; stock: string }[] = [];
  for (const [key, raw] of form.entries()) {
    if (typeof raw !== "string") continue;
    const attr = /^attributes\.([a-zA-Z0-9_]{1,40})$/.exec(key);
    if (attr && raw.trim()) attributes[attr[1]!] = raw;
    const variant = /^variants\.(\d{1,2})\.(name|price|stock)$/.exec(key);
    if (variant) {
      const index = Number(variant[1]);
      if (index >= MAX_VARIANTS + 5) continue; // ignore absurd indices; the schema caps the count
      variants[index] ??= { name: "", stock: "0" };
      variants[index][variant[2] as "name" | "price" | "stock"] = raw;
    }
  }
  return {
    title: String(form.get("title") ?? ""),
    categoryId: String(form.get("categoryId") ?? ""),
    condition: String(form.get("condition") ?? "") as ListingConditionValue,
    price: String(form.get("price") ?? ""),
    stock: String(form.get("stock") ?? "1") as unknown as number,
    location: String(form.get("location") ?? "") as ListingInput["location"],
    description: String(form.get("description") ?? ""),
    attributes,
    // Drop rows the seller left completely empty.
    variants: variants
      .filter(Boolean)
      .filter((v) => v.name.trim() || v.price?.trim())
      .map((v) => ({ ...v, stock: v.stock as unknown as number })),
  };
}
