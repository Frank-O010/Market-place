import { NextResponse } from "next/server";
import { getStorage } from "@/server/storage";
import { isSafeKey } from "@/server/storage/local";

/** Serves processed photos from local-disk storage (development and tests only). */
export async function GET(_request: Request, { params }: RouteContext<"/api/uploads/file/[...key]">) {
  const storage = getStorage();
  const key = (await params).key.join("/");
  // Only processed images are public; raw uploads under incoming/ never are.
  if (storage?.name !== "local" || !key.startsWith("listings/") || !key.endsWith(".webp") || !isSafeKey(key)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const file = await storage.getObject(key, 5 * 1024 * 1024);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
