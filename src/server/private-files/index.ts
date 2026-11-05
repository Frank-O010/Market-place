import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { env } from "@/lib/env";
import { localFallbacksAllowed } from "@/server/local-mode";

/**
 * Private files: ID documents and dispute photos. They live in a bucket with no public access
 * (or .data/private locally) and are only ever streamed to staff (and, for dispute photos, the
 * order's buyer and seller) through an authorised route. They are never given a public URL.
 */

export const MAX_PRIVATE_UPLOAD_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit

type PrivateStore = {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
};

const LOCAL_ROOT = path.join(process.cwd(), ".data", "private");
const SAFE_KEY = /^(id-documents|dispute-evidence)\/[a-z0-9-]+\.jpg$/;

function localStore(): PrivateStore {
  const resolve = (key: string) => {
    if (!SAFE_KEY.test(key)) throw new Error("Invalid private key");
    return path.join(LOCAL_ROOT, key);
  };
  return {
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async get(key) {
      try {
        return await readFile(resolve(key));
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
  };
}

function r2Store(e: ReturnType<typeof env>): PrivateStore {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID!, secretAccessKey: e.R2_SECRET_ACCESS_KEY! },
  });
  const Bucket = e.R2_PRIVATE_BUCKET!;
  return {
    async put(Key, Body) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType: "image/jpeg" }));
    },
    async get(Key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket, Key }));
        return Buffer.from(await result.Body!.transformToByteArray());
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async delete(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
  };
}

export function getPrivateStore(): PrivateStore | null {
  const e = env();
  if (e.R2_PRIVATE_BUCKET && e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY) return r2Store(e);
  if (localFallbacksAllowed()) return localStore();
  return null;
}

export class PrivateUploadError extends Error {}

/**
 * Checks an uploaded photo (real type from its bytes, size), re-encodes it as JPEG at most
 * 2000 px (dropping EXIF and GPS), stores it, and returns its key.
 */
export async function storePrivatePhoto(file: File, folder: "id-documents" | "dispute-evidence"): Promise<string> {
  const store = getPrivateStore();
  if (!store) throw new PrivateUploadError("Photo uploads aren't switched on yet. Please try again later.");
  if (!(file instanceof File) || file.size === 0) throw new PrivateUploadError("Choose a photo.");
  if (file.size > MAX_PRIVATE_UPLOAD_BYTES) throw new PrivateUploadError("The photo must be under 4 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = await fileTypeFromBuffer(bytes);
  if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime)) {
    throw new PrivateUploadError("Upload a JPEG, PNG or WebP photo.");
  }
  let output: Buffer;
  try {
    output = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    throw new PrivateUploadError("That photo couldn't be read. Try another one.");
  }
  const key = `${folder}/${randomUUID()}.jpg`;
  await store.put(key, output);
  return key;
}
