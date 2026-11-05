// Load test for the public pages people hit most: home, search and a listing.
// Usage: node scripts/load-test.mjs [baseUrl] [seconds] [connections]
//   e.g. node scripts/load-test.mjs https://staging.example.com 30 50
// Run it against staging, never production. Rate limits apply per IP, so search is expected to
// return some 429s at high load from one machine: those are counted separately, not as errors.
// Checkout under contention is covered by tests/e2e/concurrency.spec.ts (no double selling).
import autocannon from "autocannon";

const base = (process.argv[2] ?? "http://localhost:3100").replace(/\/$/, "");
const duration = Number(process.argv[3] ?? 20);
const connections = Number(process.argv[4] ?? 25);
// Budgets: 97.5th percentile latency in ms. A run over budget exits with code 1.
const budgets = { home: 800, search: 1200, category: 1000, listing: 800 };

async function firstListingPath() {
  const html = await (await fetch(`${base}/search?q=phone`)).text();
  return html.match(/href="(\/l\/[^"]+)"/)?.[1] ?? "/";
}

async function run(name, path) {
  const result = await autocannon({ url: base + path, duration, connections, headers: { "accept-language": "en" } });
  const p975 = result.latency.p97_5;
  const limited = result.statusCodeStats?.["429"]?.count ?? 0;
  const errors = result.errors + result.timeouts + result.non2xx - limited;
  const ok = p975 <= budgets[name] && errors / Math.max(result.requests.total, 1) < 0.01;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name.padEnd(8)} ${String(Math.round(result.requests.average)).padStart(5)} req/s` +
      `  p50 ${result.latency.p50}ms  p97.5 ${p975}ms (budget ${budgets[name]}ms)  errors ${errors}  rate-limited ${limited}`,
  );
  return ok;
}

const listing = await firstListingPath();
const results = [
  await run("home", "/"),
  await run("search", "/search?q=phone"),
  await run("category", "/c/electronics"),
  await run("listing", listing),
];
process.exit(results.every(Boolean) ? 0 : 1);
