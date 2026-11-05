// Generates the app icons in public/icons from one SVG (run: node scripts/make-icons.mjs).
// Placeholder brand mark: replace the SVG when the brand is final, then run this again.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const BRAND = "#0F766E";
const mark = (
  size,
  padding,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${padding ? 0 : 22}" fill="${BRAND}"/>
  <text x="50" y="${padding ? 64 : 68}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${padding ? 44 : 60}" fill="#ffffff" text-anchor="middle">S</text>
</svg>`;

await writeFile("src/app/icon.svg", mark(100, false));
for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
]) {
  await sharp(Buffer.from(mark(size, maskable)))
    .png()
    .toFile(`public/icons/${name}`);
}
console.log("Icons written to public/icons and src/app/icon.svg");
