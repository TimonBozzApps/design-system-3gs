#!/usr/bin/env node
/**
 * export-tokens.mjs — generate W3C DTCG design-token JSON from the CSS tokens.
 *
 *   node scripts/export-tokens.mjs
 *
 * Reads packages/ui/src/tokens/tokens.css (dark, the default) and
 * theme-light.css, resolves every var() reference, classifies each value and
 * writes design/tokens/3gs.dark.tokens.json + 3gs.light.tokens.json.
 *
 * The light file is the dark set with the light block's declarations laid
 * over it *before* var() resolution, exactly like the CSS cascade: a token
 * such as --gs-emboss (= var(--gs-rim-light), var(--gs-rim-dark)) therefore
 * picks up the light rims, as it does in the browser.
 *
 * The parser is exported so figma-sheet.mjs draws from the same values.
 * No dependencies — plain Node.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PATHS = {
  dark: path.join(ROOT, "packages/ui/src/tokens/tokens.css"),
  light: path.join(ROOT, "packages/ui/src/tokens/theme-light.css"),
  outDir: path.join(ROOT, "design/tokens"),
  pkg: path.join(ROOT, "packages/ui/package.json"),
};

/* ==========================================================================
   1. CSS scanning
   ========================================================================== */

/** Top-level `selector { body }` blocks of a stylesheet (at-rules included, their
 *  selector starts with "@"; nested braces are matched, comments/strings skipped). */
export function extractBlocks(css) {
  const blocks = [];
  let i = 0;
  const n = css.length;
  let selStart = 0;
  while (i < n) {
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      selStart = i;
      continue;
    }
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i = skipString(css, i);
      continue;
    }
    if (ch === "{") {
      const selector = css.slice(selStart, i).trim();
      const close = matchBrace(css, i);
      blocks.push({ selector, body: css.slice(i + 1, close) });
      i = close + 1;
      selStart = i;
      continue;
    }
    i++;
  }
  return blocks;
}

function skipString(s, i) {
  const q = s[i];
  i++;
  while (i < s.length && s[i] !== q) {
    if (s[i] === "\\") i++;
    i++;
  }
  return i + 1;
}

function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s.startsWith("/*", i)) {
      const end = s.indexOf("*/", i + 2);
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      i = skipString(s, i) - 1;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i;
  }
  throw new Error("Unbalanced braces in CSS");
}

/**
 * Custom-property declarations (`--name: value;`) inside a block body.
 * Values may span lines and contain nested parens / var() references.
 * The description is the trailing comment on the declaration's line, or
 * else a comment on its own line directly above it (section headers of the
 * form `---- … ----` are ignored).
 * @returns {{name:string, value:string, description?:string}[]}
 */
export function parseDeclarations(body) {
  const out = [];
  let i = 0;
  const n = body.length;
  let pending = null; // last comment seen, not yet attached: { text, end }
  while (i < n) {
    if (body.startsWith("/*", i)) {
      const end = body.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      const text = body.slice(i + 2, end < 0 ? n : end);
      const last = out[out.length - 1];
      if (last && !last.description && !body.slice(last.end, i).includes("\n")) {
        last.description = cleanComment(text); // trailing comment
      } else {
        pending = { text, end: stop };
      }
      i = stop;
      continue;
    }
    if (body.startsWith("--", i) && isDeclStart(body, i)) {
      const colon = body.indexOf(":", i);
      if (colon < 0) break;
      const name = body.slice(i, colon).trim();
      let j = colon + 1;
      let depth = 0;
      while (j < n) {
        const ch = body[j];
        if (body.startsWith("/*", j)) {
          const end = body.indexOf("*/", j + 2);
          j = end < 0 ? n : end + 2;
          continue;
        }
        if (ch === '"' || ch === "'") {
          j = skipString(body, j);
          continue;
        }
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        else if ((ch === ";" || ch === "}") && depth === 0) break;
        j++;
      }
      const value = tidy(body.slice(colon + 1, j).replace(/\/\*[\s\S]*?\*\//g, ""));
      const decl = { name, value, end: j + 1 };
      if (pending) {
        const between = body.slice(pending.end, i);
        const newlines = (between.match(/\n/g) || []).length;
        const isHeader = /^\s*-{2,}/.test(pending.text) || /^\s*={2,}/.test(pending.text);
        if (newlines <= 1 && !isHeader) decl.description = cleanComment(pending.text);
      }
      out.push(decl);
      pending = null;
      i = j + 1;
      continue;
    }
    if (!/\s/.test(body[i])) pending = null; // any other declaration breaks the comment link
    i++;
  }
  return out.map(({ end, ...d }) => d);
}

function isDeclStart(s, i) {
  // a `--` that begins a declaration: preceded by whitespace, `{`, `;` or start
  const prev = i === 0 ? ";" : s[i - 1];
  return /[\s{;]/.test(prev);
}

function cleanComment(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** Collapse whitespace the way a browser serialises it: one space, none inside parens. */
function tidy(value) {
  return value.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

/* ==========================================================================
   2. var() resolution
   ========================================================================== */

/**
 * Replace every var(--x[, fallback]) in `value` with the resolved value of
 * --x from `map` (a Map or object of name → raw value), recursively.
 * Unresolvable references are left in place and reported via `unresolved`.
 */
export function resolveVars(value, map, unresolved = new Set(), stack = []) {
  const get = (k) => (map instanceof Map ? map.get(k) : map[k]);
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("var(", i);
    if (at < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    // find the matching close paren
    let depth = 0;
    let j = at + 3;
    for (; j < value.length; j++) {
      if (value[j] === "(") depth++;
      else if (value[j] === ")" && --depth === 0) break;
    }
    const inner = value.slice(at + 4, j);
    const comma = topLevelIndex(inner, ",");
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
    const raw = get(name);
    if (raw !== undefined && !stack.includes(name)) {
      out += resolveVars(raw, map, unresolved, [...stack, name]);
    } else if (fallback !== null) {
      out += resolveVars(fallback, map, unresolved, stack);
    } else {
      unresolved.add(name);
      out += `var(${name})`;
    }
    i = j + 1;
  }
  return tidy(out);
}

function topLevelIndex(s, needle) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (depth === 0 && s[i] === needle) return i;
  }
  return -1;
}

/** Split on a separator at paren depth 0. */
export function splitTop(s, sep = ",") {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/* ==========================================================================
   3. Value classification → DTCG
   ========================================================================== */

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([^()]*\)|transparent)$/i;
const LEN_RE = /^-?(\d*\.?\d+)(px)?$/;

/** #rgb / #rgba / #rrggbb / #rrggbbaa / rgb() / rgba() → "#rrggbb" or "#rrggbbaa". */
export function normalizeColor(s) {
  s = s.trim();
  if (/^transparent$/i.test(s)) return "#00000000";
  if (s[0] === "#") {
    let h = s.slice(1).toLowerCase();
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length === 6) return `#${h}`;
    if (h.length === 8) return h.endsWith("ff") ? `#${h.slice(0, 6)}` : `#${h}`;
    return null;
  }
  const m = s.match(/^rgba?\(\s*([^)]*)\)$/i);
  if (!m) return null;
  const parts = m[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const chan = parts.slice(0, 3).map((p) =>
    p.endsWith("%") ? Math.round((parseFloat(p) / 100) * 255) : Math.round(parseFloat(p)),
  );
  let hex = chan.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("");
  if (parts[3] !== undefined) {
    const a = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if (a < 1) hex += Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  }
  return `#${hex}`;
}

export function isColor(s) {
  return COLOR_RE.test(s.trim()) && normalizeColor(s) !== null;
}

/**
 * Parse `linear-gradient(...)` / `repeating-linear-gradient(...)`.
 * @returns {{ angle:number, repeating:boolean, stops:{color:string,position:number}[], period?:string }|null}
 */
export function parseGradient(s) {
  const m = s.trim().match(/^(repeating-)?linear-gradient\((.*)\)$/s);
  if (!m) return null;
  const repeating = !!m[1];
  const args = splitTop(m[2]);
  let angle = 180;
  let first = args[0].trim();
  const dir = first.match(/^to\s+(top|bottom|left|right)$/);
  const deg = first.match(/^(-?\d*\.?\d+)deg$/);
  if (dir) {
    angle = { top: 0, right: 90, bottom: 180, left: 270 }[dir[1]];
    args.shift();
  } else if (deg) {
    angle = parseFloat(deg[1]);
    args.shift();
  }
  const raw = args.map((a) => {
    const parts = splitTop(a, " ");
    const color = normalizeColor(parts[0]);
    if (!color) throw new Error(`Bad gradient stop "${a}" in ${s}`);
    return { color, pos: parts[1] ?? null };
  });
  // px-positioned stops (the pinstripe): normalise to the last stop's length
  const px = raw.some((r) => r.pos && r.pos.endsWith("px"));
  let period;
  let scale = 1;
  if (px) {
    const max = Math.max(...raw.map((r) => (r.pos ? parseFloat(r.pos) : 0)));
    period = `${max}px`;
    scale = max || 1;
  }
  const stops = raw.map((r) => ({
    color: r.color,
    position: r.pos === null ? null : px ? parseFloat(r.pos) / scale : parseFloat(r.pos) / 100,
  }));
  // fill in missing positions like the browser: first 0, last 1, evenly in between
  if (stops.length && stops[0].position === null) stops[0].position = 0;
  if (stops.length && stops[stops.length - 1].position === null) stops[stops.length - 1].position = 1;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].position !== null) continue;
    let j = i;
    while (stops[j].position === null) j++;
    const a = stops[i - 1].position;
    const b = stops[j].position;
    for (let k = i; k < j; k++) stops[k].position = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  for (const st of stops) st.position = round(st.position, 4);
  return { angle, repeating, stops, ...(period ? { period } : {}) };
}

/** Parse a box-shadow / text-shadow list. Returns null if it isn't one. */
export function parseShadows(s) {
  const parts = splitTop(s);
  const shadows = [];
  for (const part of parts) {
    const toks = splitTop(part, " ");
    let inset = false;
    let color = null;
    const lens = [];
    for (const t of toks) {
      if (t === "inset") inset = true;
      else if (isColor(t)) color = normalizeColor(t);
      else if (LEN_RE.test(t)) lens.push(t);
      else return null;
    }
    if (!color || lens.length < 2 || lens.length > 4) return null;
    const [x, y, blur = "0", spread = "0"] = lens;
    shadows.push({
      color,
      offsetX: dim(x),
      offsetY: dim(y),
      blur: dim(blur),
      spread: dim(spread),
      inset,
    });
  }
  return shadows.length ? shadows : null;
}

function dim(s) {
  return /^-?0(px)?$/.test(s) ? "0px" : s.endsWith("px") ? s : `${s}px`;
}

function round(n, d = 4) {
  return Math.round(n * 10 ** d) / 10 ** d;
}

/**
 * Classify a resolved CSS value.
 * @returns {{ $type:string, $value:any, ext?:object }}
 */
export function classify(value) {
  const v = value.trim();
  if (isColor(v)) return { $type: "color", $value: normalizeColor(v) };

  if (/^(repeating-)?linear-gradient\(/.test(v)) {
    const g = parseGradient(v);
    if (g) {
      const ext = { "com.3gs.angle": g.angle, "com.3gs.cssValue": v };
      if (g.repeating) {
        ext["com.3gs.repeating"] = true;
        if (g.period) ext["com.3gs.period"] = g.period;
      }
      return { $type: "gradient", $value: g.stops, ext };
    }
  }

  const cb = v.match(/^cubic-bezier\(([^)]*)\)$/);
  if (cb) {
    const nums = cb[1].split(",").map((x) => parseFloat(x.trim()));
    if (nums.length === 4 && nums.every((x) => !Number.isNaN(x))) return { $type: "cubicBezier", $value: nums };
  }

  if (/^\d*\.?\d+m?s$/.test(v)) return { $type: "duration", $value: v };

  if (/^-?\d*\.?\d+px$/.test(v)) return { $type: "dimension", $value: v };

  if (/^-?\d*\.?\d+$/.test(v)) return { $type: "number", $value: parseFloat(v) };

  // font stack: comma list ending in a generic family
  const fam = splitTop(v).map((f) => f.replace(/^["']|["']$/g, "").trim());
  if (fam.length > 1 && /^(sans-serif|serif|monospace|system-ui|cursive|fantasy)$/.test(fam[fam.length - 1])) {
    return { $type: "fontFamily", $value: fam };
  }

  // border shorthand: <width> <style> <color>
  const bt = splitTop(v, " ");
  if (bt.length === 3 && /^-?\d*\.?\d+px$/.test(bt[0]) && /^(solid|dashed|dotted|double|none)$/.test(bt[1]) && isColor(bt[2])) {
    return { $type: "border", $value: { color: normalizeColor(bt[2]), width: bt[0], style: bt[1] } };
  }

  const sh = parseShadows(v);
  if (sh) return { $type: "shadow", $value: sh.length === 1 ? sh[0] : sh, ext: { "com.3gs.cssValue": v } };

  return { $type: "string", $value: v };
}

/* ==========================================================================
   4. Token sets
   ========================================================================== */

/** Custom-property declarations of the first block whose selector matches
 *  (`optional`: return [] instead of throwing when there is no such block). */
export function readVars(file, match = () => true, { optional = false } = {}) {
  const block = findBlock(file, match);
  if (!block) {
    if (optional) return [];
    throw new Error(`No matching block in ${file}`);
  }
  return parseDeclarations(block.body);
}

/** First non-at-rule block of a stylesheet whose selector matches. */
export function findBlock(file, match = () => true) {
  const css = fs.readFileSync(file, "utf8");
  return extractBlocks(css).find((b) => !b.selector.startsWith("@") && match(b.selector)) || null;
}

/** The value of one ordinary declaration (`background`, `box-shadow`, …) in a block body. */
export function readProp(body, name) {
  const re = new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;}]+)`);
  const m = body.replace(/\/\*[\s\S]*?\*\//g, "").match(re);
  return m ? tidy(m[1]) : null;
}

/**
 * Build a resolved, classified token set.
 * @param {{name,value,description?}[][]} layers — later layers override earlier (raw values)
 * @returns {{ tokens: Map<string, Token>, unresolved: Set<string> }}
 *   Token = { name, raw, value, $type, $value, description?, ext?, alias? }
 */
export function buildTokenSet(...layers) {
  const raw = new Map();
  const desc = new Map();
  for (const layer of layers) {
    for (const d of layer) {
      raw.set(d.name, d.value);
      if (d.description) desc.set(d.name, d.description);
    }
  }
  const unresolved = new Set();
  const tokens = new Map();
  for (const [name, rawValue] of raw) {
    const value = resolveVars(rawValue, raw, unresolved);
    const c = classify(value);
    const alias = rawValue.match(/^var\((--[\w-]+)\)$/)?.[1];
    tokens.set(name, {
      name,
      raw: rawValue,
      value,
      $type: c.$type,
      $value: c.$value,
      description: desc.get(name),
      ext: c.ext,
      alias,
    });
  }
  return { tokens, unresolved };
}

/* ==========================================================================
   5. DTCG document
   ========================================================================== */

/** `--gs-gradient-blue` → { group: "gradient", key: "blue" } ; `--gs-font` → { group: "font", key: null } */
export function tokenPath(cssName, prefix = "--gs-") {
  const segs = cssName.slice(prefix.length).split("-");
  return { group: segs[0], key: segs.length > 1 ? segs.slice(1).join("-") : null };
}

export function toDtcg(tokens, meta = {}) {
  const groups = {};
  const bare = new Map(); // group → token with a bare name (e.g. --gs-text)
  for (const t of tokens.values()) {
    const { group, key } = tokenPath(t.name);
    groups[group] ??= {};
    if (key === null) bare.set(group, t);
    else groups[group][key] = tokenNode(t, `${group}.${key}`);
  }
  const doc = {};
  for (const [group, members] of Object.entries(groups)) {
    const b = bare.get(group);
    if (b && Object.keys(members).length === 0) {
      doc[group] = tokenNode(b, group); // lone token, e.g. gs.black
    } else {
      doc[group] = members;
      if (b) doc[group] = { default: tokenNode(b, `${group}.default`), ...members };
    }
  }
  const { description, ...info } = meta;
  return {
    $description: description,
    $extensions: { "com.3gs": info },
    ...doc,
  };
}

function tokenNode(t, pathName) {
  const node = { $type: t.$type, $value: t.$value };
  if (t.description) node.$description = t.description;
  const ext = { "com.3gs.css": t.name, ...(t.ext || {}) };
  if (t.alias) ext["com.3gs.alias"] = t.alias;
  node.$extensions = ext;
  return node;
}

/* ==========================================================================
   6. Loading both themes (shared with figma-sheet.mjs)
   ========================================================================== */

export function loadThemes() {
  const dark = readVars(PATHS.dark, (sel) => sel === ":root");
  const light = readVars(PATHS.light, (sel) => sel.includes('data-theme="light"') || sel.includes("gs-theme-light"));
  const version = JSON.parse(fs.readFileSync(PATHS.pkg, "utf8")).version;
  return {
    version,
    dark: buildTokenSet(dark),
    light: buildTokenSet(dark, light),
    lightOverrides: new Set(light.map((d) => d.name)),
  };
}

/* ==========================================================================
   7. CLI
   ========================================================================== */

function main() {
  const themes = loadThemes();
  fs.mkdirSync(PATHS.outDir, { recursive: true });
  const base = {
    name: "3GS UI design tokens",
    version: themes.version,
    prefix: "--gs-",
    source: ["packages/ui/src/tokens/tokens.css"],
    generator: "scripts/export-tokens.mjs",
  };
  const files = [
    {
      out: "3gs.dark.tokens.json",
      set: themes.dark,
      meta: { ...base, theme: "dark", description: "3GS UI — dark theme (default): black glass, --gs-* tokens from tokens.css." },
    },
    {
      out: "3gs.light.tokens.json",
      set: themes.light,
      meta: {
        ...base,
        theme: "light",
        source: [...base.source, "packages/ui/src/tokens/theme-light.css"],
        description:
          "3GS UI — light theme (classic iOS 3): the dark set with theme-light.css laid over it, var() references re-resolved against the merged set.",
      },
    },
  ];

  let ok = true;
  for (const f of files) {
    const doc = toDtcg(f.set.tokens, f.meta);
    const json = JSON.stringify(doc, null, 2) + "\n";
    JSON.parse(json); // round-trip check
    const outPath = path.join(PATHS.outDir, f.out);
    fs.writeFileSync(outPath, json);

    const counts = {};
    for (const t of f.set.tokens.values()) counts[t.$type] = (counts[t.$type] || 0) + 1;
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    console.log(`${path.relative(ROOT, outPath)}: ${f.set.tokens.size} tokens (${summary})`);
    if (f.set.unresolved.size) {
      ok = false;
      console.warn(`  WARN unresolved var(): ${[...f.set.unresolved].join(", ")}`);
    }
    const strings = [...f.set.tokens.values()].filter((t) => t.$type === "string");
    if (strings.length) console.log(`  string-typed (unclassified): ${strings.map((t) => `${t.name}=${t.value}`).join("; ")}`);
  }
  const overrides = themes.lightOverrides.size;
  console.log(`light theme overrides ${overrides} tokens (${themes.dark.tokens.size} in dark set).`);
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
