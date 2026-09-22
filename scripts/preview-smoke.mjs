#!/usr/bin/env node
/**
 * preview-smoke.mjs — exercise the preview generator end to end.
 *
 *   node scripts/preview-smoke.mjs            # built-in positive + negative cases
 *   node scripts/preview-smoke.mjs <url>...   # only these URLs
 *
 * Runs the TypeScript sources directly through Node's native type stripping.
 * The api/ modules use extensionless relative imports (what Vite and Vercel
 * resolve) written with `.js` extensions (what Node ESM on Vercel needs); a
 * resolve hook maps `./x.js` → `./x.ts` for Node's native type stripping.
 * No build step, no dependencies.
 */
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (err?.code === "ERR_MODULE_NOT_FOUND" && /^\.\.?\//.test(specifier)) {
        if (/\.js$/.test(specifier)) return next(specifier.replace(/\.js$/, ".ts"), context);
        if (!/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});

const { generatePreview } = await import("../api/_lib/preview.ts");

const POSITIVE = [
  "https://vercel.com",
  "https://posthog.com",
  "https://github.com",
  "https://stripe.com",
  "https://news.ycombinator.com",
  "https://example.com",
];

/** [input, expected error code] */
const NEGATIVE = [
  ["http://localhost:5173", "blocked"],
  ["http://169.254.169.254/latest/meta-data", "blocked"],
  ["https://10.0.0.1", "blocked"],
  ["http://[::1]/", "blocked"],
  ["http://127.1", "blocked"],
  ["http://user:pw@example.com", "blocked"],
  ["https://example.com:8443", "blocked"],
  ["ftp://x", "invalid_url"],
  ["not a url", "invalid_url"],
  ["", "invalid_url"],
  ["https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "not_html"],
  ["https://upload.wikimedia.org/wikipedia/commons/3/3f/Fronalpstock_big.jpg", "not_html"],
  // A huge page is truncated at the read cap, not rejected — it must still preview.
  ["https://html.spec.whatwg.org/", "ok"],
];

const args = process.argv.slice(2);
const positive = args.length ? args : POSITIVE;
const negative = args.length ? [] : NEGATIVE;

const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
const trunc = (s, n) => (String(s ?? "").length > n ? `${String(s).slice(0, n - 1)}…` : String(s ?? ""));

function describe(result) {
  if (!result.ok) return { status: result.code, detail: trunc(result.error, 70) };
  const { spec } = result;
  const rows = spec.groups.reduce((n, g) => n + g.rows.length, 0);
  return {
    status: "ok",
    detail: [
      `title=${JSON.stringify(spec.title)}`,
      `tabs=[${spec.tabs.map((t) => t.label + (t.badge ? `(${t.badge})` : "")).join(", ")}]`,
      `groups=${spec.groups.length}/rows=${rows}`,
      `actions=[${spec.actions.map((a) => a.label).join(", ")}]`,
      `icon=${spec.iconDataUri ? "y" : "n"}`,
      `img=${spec.imageDataUri ? "y" : "n"}`,
      spec.search ? `search="${spec.search.placeholder}"` : "search=n",
      spec.notes.length ? `notes=${JSON.stringify(spec.notes)}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

async function run(input) {
  const t0 = performance.now();
  const result = await generatePreview(input);
  return { input, ms: Math.round(performance.now() - t0), result };
}

console.log(`\nPositive cases (${positive.length}) — run in parallel\n`);
const posResults = await Promise.all(positive.map(run));
for (const { input, ms, result } of posResults) {
  const d = describe(result);
  console.log(`${pad(d.status, 12)} ${pad(`${ms}ms`, 8)} ${pad(input, 34)} ${d.detail}`);
}

// Second pass on the first positive: must be a cache hit.
if (posResults.length) {
  const again = await run(positive[0]);
  const hit = again.result.ok && again.result.cached;
  console.log(`${pad(hit ? "cache-hit" : "CACHE-MISS", 12)} ${pad(`${again.ms}ms`, 8)} ${pad(positive[0], 34)} second call`);
}

let failures = 0;
if (negative.length) {
  console.log(`\nNegative cases (${negative.length}) — must be rejected with the expected code\n`);
  const negResults = await Promise.all(negative.map(([input]) => run(input)));
  negResults.forEach(({ input, ms, result }, i) => {
    const expected = negative[i][1];
    const got = result.ok ? "ok" : result.code;
    const pass = got === expected;
    if (!pass) failures++;
    const detail = result.ok ? `title=${JSON.stringify(result.spec.title)}` : trunc(result.error, 70);
    console.log(`${pad(pass ? "PASS" : "FAIL", 6)} ${pad(got, 12)} ${pad(`${ms}ms`, 8)} ${pad(JSON.stringify(input), 46)} expected=${expected} ${detail}`);
  });
}

if (args.length === 1 && posResults[0]?.result.ok && process.env.DUMP) {
  console.log(JSON.stringify(posResults[0].result.spec, (k, v) => (k.endsWith("DataUri") && typeof v === "string" ? `${v.slice(0, 40)}… (${v.length} chars)` : v), 2));
}

console.log(`\n${failures ? `${failures} negative case(s) FAILED` : "all negative cases rejected as expected"}\n`);
process.exit(failures ? 1 : 0);
