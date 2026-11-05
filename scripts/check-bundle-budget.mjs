// Performance budget: JavaScript a phone downloads to open key pages (gzipped), measured from
// the real HTML of a running production build. Usage:
//   pnpm build && pnpm start --port 3100 &   then   node scripts/check-bundle-budget.mjs [baseUrl]
// Exits with code 1 when a page is over budget. Slow 3G moves roughly 50 KB/s, so every
// 50 KB is about a second before the page responds to taps.
import { gzipSync } from "node:zlib";

const base = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
// Set from the measured sizes at launch plus about 5% headroom, to catch regressions. Most of
// it is React and Next.js (about 110 KB) and Clerk (about 57 KB, needed on every page to keep
// sessions fresh). Sentry is loaded lazily and not counted.
const BUDGET_KB = { "/": 285, "/search?q=phone": 280, listing: 320, "/sign-in": 275 };
const cache = new Map();

async function gzippedSize(src) {
  if (!cache.has(src)) {
    const body = Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer());
    cache.set(src, gzipSync(body).length);
  }
  return cache.get(src);
}

async function measure(path) {
  const html = await (await fetch(base + path)).text();
  const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]))];
  const sizes = await Promise.all(scripts.filter((s) => s.startsWith("/")).map(gzippedSize));
  const inline = gzipSync(
    Buffer.from([...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("")),
  ).length;
  return {
    kb: (sizes.reduce((a, b) => a + b, 0) + inline) / 1024,
    files: scripts.length,
    htmlKb: gzipSync(html).length / 1024,
  };
}

const searchHtml = await (await fetch(`${base}/search?q=phone`)).text();
const listing = searchHtml.match(/href="(\/l\/[^"]+)"/)?.[1];
let ok = true;
for (const [key, budget] of Object.entries(BUDGET_KB)) {
  const path = key === "listing" ? listing : key;
  if (!path) continue;
  const { kb, files, htmlKb } = await measure(path);
  const pass = kb <= budget;
  ok &&= pass;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${path.padEnd(40)} JS ${kb.toFixed(0)} KB gz in ${files} files (budget ${budget} KB), HTML ${htmlKb.toFixed(0)} KB gz`,
  );
}
process.exit(ok ? 0 : 1);
