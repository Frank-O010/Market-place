/** Where listing photos live. R2 in production, the local disk in development and tests. */
export interface ObjectStorage {
  readonly name: "r2" | "local";
  /** A short-lived link the browser uploads one file to with an HTTP PUT. */
  createUploadUrl(input: { key: string; contentType: string; contentLength: number }): Promise<UploadTarget>;
  /** Reads an object, or null if it doesn't exist. Refuses objects larger than maxBytes. */
  getObject(key: string, maxBytes: number): Promise<Buffer | null>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteObjects(keys: string[]): Promise<void>;
  /** Public URL for a processed image. Only keys under "listings/" are public. */
  publicUrl(key: string): string;
}

export type UploadTarget = { url: string; headers: Record<string, string> };

export class ObjectTooLargeError extends Error {
  constructor() {
    super("The file is larger than allowed.");
    this.name = "ObjectTooLargeError";
  }
}
