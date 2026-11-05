import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { localFallbacksAllowed } from "@/server/local-mode";

/**
 * AES-256-GCM for sensitive fields at rest (for example the ID document reference).
 * Format: "v1:" + base64(iv | tag | ciphertext). Without ENCRYPTION_KEY, local development and
 * CI use a key derived from DATABASE_URL; a deployed site gets null and must switch the feature off.
 */
function key(): Buffer | null {
  const configured = env().ENCRYPTION_KEY;
  if (configured) return Buffer.from(configured, "base64");
  if (localFallbacksAllowed()) {
    return createHash("sha256").update(`local-field-encryption:${env().DATABASE_URL}`).digest();
  }
  return null;
}

export function encryptionAvailable(): boolean {
  return key() !== null;
}

export function encryptField(plaintext: string): string {
  const k = key();
  if (!k) throw new Error("ENCRYPTION_KEY is not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

export function decryptField(value: string): string {
  const k = key();
  if (!k) throw new Error("ENCRYPTION_KEY is not set");
  if (!value.startsWith("v1:")) throw new Error("Unknown encrypted field format");
  const raw = Buffer.from(value.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", k, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
