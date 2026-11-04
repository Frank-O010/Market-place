import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ObjectTooLargeError, type ObjectStorage } from "./types";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicOrigin: string;
};

/** Upload links expire quickly; the browser starts the upload straight away. */
const UPLOAD_URL_TTL_SECONDS = 300;

export function createR2Storage(config: R2Config): ObjectStorage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const origin = config.publicOrigin.replace(/\/$/, "");

  return {
    name: "r2",
    async createUploadUrl({ key, contentType, contentLength }) {
      // Content type and length are part of the signature, so the browser can't upload
      // a bigger file or a different type than it asked for.
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        signableHeaders: new Set(["content-type", "content-length"]),
      });
      return { url, headers: { "Content-Type": contentType } };
    },
    async getObject(key, maxBytes) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if ((result.ContentLength ?? 0) > maxBytes) throw new ObjectTooLargeError();
        const bytes = await result.Body!.transformToByteArray();
        if (bytes.byteLength > maxBytes) throw new ObjectTooLargeError();
        return Buffer.from(bytes);
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async putObject(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // Processed images never change: a new upload always gets a new key.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async deleteObjects(keys) {
      if (keys.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    },
    publicUrl: (key) => `${origin}/${key}`,
  };
}
