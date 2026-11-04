import { z } from "zod";
import { nairobiAreas } from "@/config/locations";

/** Shop addresses that would clash with site pages or mislead buyers. */
export const RESERVED_SHOP_SLUGS = new Set([
  "admin",
  "api",
  "account",
  "sell",
  "seller",
  "sellers",
  "search",
  "help",
  "legal",
  "support",
  "soko",
  "official",
  "staff",
  "moderator",
  "dev",
  "new",
  "edit",
  "settings",
  "c",
  "l",
  "s",
]);

export const sellerProfileSchema = z.object({
  displayName: z.string().trim().min(3, "Use at least 3 characters").max(60, "Keep it under 60 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Use at least 3 characters")
    .max(40, "Keep it under 40 characters")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes")
    .refine((slug) => !RESERVED_SHOP_SLUGS.has(slug), "That shop address is reserved. Try another."),
  location: z.enum(nairobiAreas, { message: "Choose where you sell from" }),
  bio: z.string().trim().max(300, "Keep it under 300 characters").default(""),
});
