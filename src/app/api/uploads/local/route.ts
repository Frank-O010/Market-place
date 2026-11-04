import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { MAX_UPLOAD_BYTES } from "@/lib/images";
import { getStorage } from "@/server/storage";
import { verifyLocalUpload } from "@/server/storage/local";

/**
 * Upload target for local-disk storage (development and tests only). Behaves like an R2
 * presigned PUT: the signed link fixes the key, content type and exact size.
 */
export async function PUT(request: NextRequest) {
  const storage = getStorage();
  if (storage?.name !== "local") return new NextResponse("Not found", { status: 404 });

  const params = request.nextUrl.searchParams;
  const claims = {
    key: params.get("key") ?? "",
    contentType: params.get("type") ?? "",
    contentLength: Number(params.get("length")),
    expires: Number(params.get("expires")),
  };
  if (!verifyLocalUpload(env().UPLOAD_SIGNING_SECRET, claims, params.get("signature") ?? "")) {
    return new NextResponse("Invalid or expired upload link", { status: 403 });
  }
  if (request.headers.get("content-type") !== claims.contentType) {
    return new NextResponse("Content type doesn't match the upload link", { status: 403 });
  }
  const declared = Number(request.headers.get("content-length"));
  if (declared !== claims.contentLength || declared > MAX_UPLOAD_BYTES) {
    return new NextResponse("Size doesn't match the upload link", { status: 403 });
  }
  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength !== claims.contentLength) {
    return new NextResponse("Size doesn't match the upload link", { status: 403 });
  }
  await storage.putObject(claims.key, body, claims.contentType);
  return new NextResponse(null, { status: 200 });
}
