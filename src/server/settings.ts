import "server-only";
import { z } from "zod";
import { defaultProhibitedKeywords } from "@/lib/trust/prohibited";
import { db } from "@/server/db";

/**
 * Business rules stored in PlatformSetting so admins can change them without a deploy
 * (Admin → Settings). Defaults apply when a row is missing or invalid.
 */
export const settingSchemas = {
  commission_bps: z.number().int().min(0).max(5000),
  auto_release_days: z.number().int().min(1).max(30),
  delivery_fee_minor: z.number().int().min(0).max(1_000_000),
  // Words that send a listing to the moderation queue (see src/lib/trust/prohibited.ts).
  prohibited_keywords: z.array(z.string().min(2).max(40)).max(500),
  // Feature flags.
  /** Kill switch: when false, checkout shows "paused" (for incidents or provider outages). */
  checkout_enabled: z.boolean(),
  /** When true, every new listing is checked by a moderator, not just new sellers' first ones. */
  review_all_new_listings: z.boolean(),
} as const;

const defaults: { [K in keyof typeof settingSchemas]: z.infer<(typeof settingSchemas)[K]> } = {
  commission_bps: 1000,
  auto_release_days: 3,
  delivery_fee_minor: 30_000,
  prohibited_keywords: defaultProhibitedKeywords,
  checkout_enabled: true,
  review_all_new_listings: false,
};

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = (typeof defaults)[K];

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  const parsed = settingSchemas[key].safeParse(row?.value);
  return (parsed.success ? parsed.data : defaults[key]) as SettingValue<K>;
}

export async function getAllSettings(): Promise<{ [K in SettingKey]: SettingValue<K> }> {
  const keys = Object.keys(settingSchemas) as SettingKey[];
  const values = await Promise.all(keys.map((k) => getSetting(k)));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as { [K in SettingKey]: SettingValue<K> };
}

/** Validates and stores a setting. Returns the previous value (for the audit log). */
export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<SettingValue<K>> {
  const previous = await getSetting(key);
  const parsed = settingSchemas[key].parse(value);
  await db.platformSetting.upsert({ where: { key }, create: { key, value: parsed }, update: { value: parsed } });
  return previous;
}
