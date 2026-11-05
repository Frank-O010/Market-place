import "server-only";
import { env } from "@/lib/env";
import { localFallbacksAllowed } from "@/server/local-mode";
import { createLocalStorage } from "./local";
import { createR2Storage } from "./r2";
import type { ObjectStorage } from "./types";

export type { ObjectStorage } from "./types";

let cached: ObjectStorage | null | undefined;

/**
 * The configured photo storage, or null when uploads aren't available
 * (a deployed site without R2 credentials). Callers show a friendly message in that case.
 */
export function getStorage(): ObjectStorage | null {
  if (cached !== undefined) return cached;
  const e = env();
  if (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET && e.NEXT_PUBLIC_IMAGE_ORIGIN) {
    cached = createR2Storage({
      accountId: e.R2_ACCOUNT_ID,
      accessKeyId: e.R2_ACCESS_KEY_ID,
      secretAccessKey: e.R2_SECRET_ACCESS_KEY,
      bucket: e.R2_BUCKET,
      publicOrigin: e.NEXT_PUBLIC_IMAGE_ORIGIN,
    });
  } else if (localFallbacksAllowed()) {
    cached = createLocalStorage(e.UPLOAD_SIGNING_SECRET);
  } else {
    cached = null;
  }
  return cached;
}
