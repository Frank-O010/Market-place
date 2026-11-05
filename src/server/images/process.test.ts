import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ImageRejectedError, processImage, sniffImage } from "./process";

const photo = (width: number, height: number, options: { exif?: boolean; orientation?: number } = {}) => {
  let image = sharp({ create: { width, height, channels: 3, background: { r: 15, g: 118, b: 110 } } }).jpeg();
  if (options.exif || options.orientation) {
    image = image.withMetadata({
      orientation: options.orientation,
      exif: options.exif
        ? { IFD0: { Make: "TestCam" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "1/1 17/1 0/1" } }
        : undefined,
    });
  }
  return image.toBuffer();
};

describe("sniffImage", () => {
  it("accepts real JPEG, PNG and WebP files", async () => {
    const base = sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } });
    expect(await sniffImage(await base.clone().jpeg().toBuffer())).toBe("image/jpeg");
    expect(await sniffImage(await base.clone().png().toBuffer())).toBe("image/png");
    expect(await sniffImage(await base.clone().webp().toBuffer())).toBe("image/webp");
  });

  it("rejects a script renamed to .jpg, because the bytes decide, not the name", async () => {
    const fake = Buffer.from("#!/bin/sh\necho pwned\n");
    await expect(sniffImage(fake)).rejects.toBeInstanceOf(ImageRejectedError);
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    await expect(sniffImage(html)).rejects.toThrow(/isn't a photo/);
  });

  it("rejects other real file types such as PDF and GIF", async () => {
    await expect(sniffImage(Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n"))).rejects.toBeInstanceOf(ImageRejectedError);
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } })
      .gif()
      .toBuffer();
    await expect(sniffImage(gif)).rejects.toBeInstanceOf(ImageRejectedError);
  });
});

describe("processImage", () => {
  it("makes three WebP sizes and never enlarges", async () => {
    const result = await processImage(await photo(800, 600));
    expect(result).toMatchObject({ width: 800, height: 600 });
    for (const [size, max] of [
      ["thumb", 200],
      ["card", 480],
      ["full", 800],
    ] as const) {
      const meta = await sharp(result.files[size]).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(max);
    }
  });

  it("strips EXIF metadata, including GPS location", async () => {
    const input = await photo(600, 600, { exif: true });
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const result = await processImage(input);
    for (const file of Object.values(result.files)) {
      const meta = await sharp(file).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
    }
  });

  it("rotates sideways phone photos upright", async () => {
    // Stored 600x400 but tagged as rotated 90 degrees: displays as 400x600.
    const result = await processImage(await photo(600, 400, { orientation: 6 }));
    expect(result).toMatchObject({ width: 400, height: 600 });
    expect((await sharp(result.files.full).metadata()).height).toBe(600);
  });

  it("rejects photos that are too small", async () => {
    await expect(processImage(await photo(200, 800))).rejects.toThrow(/at least 300 pixels/);
  });

  it("rejects truncated files", async () => {
    const bytes = await photo(800, 800);
    await expect(processImage(bytes.subarray(0, 400))).rejects.toBeInstanceOf(ImageRejectedError);
  });
});
