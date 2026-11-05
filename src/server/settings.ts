import "server-only";
import { z } from "zod";
import { db } from "@/server/db";

/**
 * Business rules stored in PlatformSetting so admins can change them without a deploy
 * (admin screen in Phase 5). Defaults apply when a row is missing.
 */
const schemas = {
  commission_bps: z.number().int().min(0).max(5000),
  auto_release_days: z.number().int().min(1).max(30),
  delivery_fee_minor: z.number().int().min(0).max(1_000_000),
} as const;

const defaults: { [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]> } = {
  commission_bps: 1000,
  auto_release_days: 3,
  delivery_fee_minor: 30_000,
};

export type SettingKey = keyof typeof schemas;

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof defaults)[K]> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  const parsed = schemas[key].safeParse(row?.value);
  return (parsed.success ? parsed.data : defaults[key]) as (typeof defaults)[K];
}
