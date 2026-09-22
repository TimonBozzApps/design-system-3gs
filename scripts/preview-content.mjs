#!/usr/bin/env node
/**
 * preview-content.mjs — print what the extractor actually got off a page, so
 * the content heuristics can be judged like a reader would judge them.
 *
 *   node scripts/preview-content.mjs                 # the built-in test set
 *   node scripts/preview-content.mjs <url>...        # just these
 *   BLOCKS=1 node scripts/preview-content.mjs <url>  # also dump full block JSON
 *
 * Same Node-native TypeScript setup as preview-smoke.mjs: no build step.
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

const PAGES = [
  "https://posthog.com/pricing",
  "https://stripe.com",
  "https://vercel.com",
  "https://github.com",
  "https://news.ycombinator.com",
  "https://en.wikipedia.org/wiki/IPhone_3GS",
  "https://tailwindcss.com",
  "https://example.com",
];

const EXCERPT = 70;
const args = process.argv.slice(2);
const pages = args.length ? args : PAGES;

const cut = (s, n = EXCERPT) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** One line per block: kind + what a reader would see. */
function line(block) {
  switch (block.kind) {
    case "text":
      return `text   ${cut(block.text)}`;
    case "list":
      return `list   (${block.items.length}) ${cut(block.items.join(" · "))}`;
    case "stat":
      return `stat   ${cut(block.value, 20)}${block.label ? ` — ${cut(block.label, 30)}` : ""}${block.note ? ` (${cut(block.note, 20)})` : ""}`;
    case "qa":
      return `qa     ${cut(block.question, 34)} → ${cut(block.answer, 34)}`;
    case "quote":
      return `quote  ${cut(block.text)}${block.source ? ` — ${cut(block.source, 20)}` : ""}`;
    case "image":
      return `image  ${Math.round(block.dataUri.length / 1024)} KB${block.alt ? ` alt="${cut(block.alt, 40)}"` : ""}`;
    case "code":
      return `code   ${cut(block.text)}`;
    case "link":
      return `link   ${cut(block.text, 30)} → ${cut(block.href, 40)}`;
    default:
      return `?      ${cut(JSON.stringify(block))}`;
  }
}

function report(url, ms, result) {
  console.log(`\n${"═".repeat(96)}\n${url}  (${ms} ms)`);
  if (!result.ok) {
    console.log(`  FAILED ${result.code}: ${result.error}`);
    return { blocks: 0, sections: 0 };
  }
  const { spec } = result;
  const sections = spec.sections ?? [];
  const intro = spec.intro ?? [];
  const blocks = intro.length + sections.reduce((n, s) => n + (s.blocks?.length ?? 0), 0);
  const kinds = {};
  for (const b of [...intro, ...sections.flatMap((s) => s.blocks ?? [])]) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
  const kb = Math.round(JSON.stringify(spec).length / 1024);

  console.log(
    `  title=${JSON.stringify(spec.title)} sections=${sections.length} intro=${intro.length} blocks=${blocks} ` +
      `[${Object.entries(kinds).map(([k, n]) => `${k}:${n}`).join(" ")}] spec=${kb} KB` +
      `${spec.notes?.length ? ` notes=${JSON.stringify(spec.notes)}` : ""}`,
  );
  console.log(`  groups=[${spec.groups.map((g) => `${g.header ?? "-"}(${g.rows.length})`).join(" ")}]`);

  if (intro.length) {
    console.log(`\n  ¶ INTRO`);
    for (const b of intro) console.log(`      ${line(b)}`);
  }
  sections.forEach((s, i) => {
    console.log(`\n  ${String(i + 1).padStart(2)}. ${s.heading}${s.href ? "  →" : ""}`);
    if (!s.blocks?.length) console.log("      (no blocks)");
    for (const b of s.blocks ?? []) console.log(`      ${line(b)}`);
  });
  if (process.env.BLOCKS) {
    console.log(JSON.stringify({ intro, sections }, (k, v) => (k === "dataUri" ? `${String(v).slice(0, 32)}…` : v), 2));
  }
  return { blocks, sections: sections.length };
}

const started = performance.now();
const results = await Promise.all(
  pages.map(async (url) => {
    const t0 = performance.now();
    const result = await generatePreview(url);
    return { url, ms: Math.round(performance.now() - t0), result };
  }),
);

const totals = results.map(({ url, ms, result }) => ({ url, ms, ...report(url, ms, result) }));

console.log(`\n${"═".repeat(96)}\nSummary (${Math.round(performance.now() - started)} ms wall clock)\n`);
for (const t of totals) {
  console.log(`  ${String(t.blocks).padStart(3)} blocks  ${String(t.sections).padStart(2)} sections  ${String(t.ms).padStart(5)} ms  ${t.url}`);
}
console.log(`\n  total blocks: ${totals.reduce((n, t) => n + t.blocks, 0)}\n`);
