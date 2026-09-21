#!/usr/bin/env node
/**
 * figma-sheet.mjs — draw the 3GS gel styles as an SVG sticker sheet.
 *
 *   node scripts/figma-sheet.mjs
 *
 * Writes design/3gs-gel-sheet-dark.svg and design/3gs-gel-sheet-light.svg:
 * 1200 px wide spec pages with every core gel drawn as real vector geometry
 * (linearGradient stops incl. the hard 49 / 50 % split, rims, strokes,
 * feDropShadow filters), so Figma's SVG import yields editable styles.
 *
 * Every colour comes from the CSS: the theme tokens through the parser in
 * export-tokens.mjs, and the component-local custom properties (switch knob,
 * tab-bar gel, alert gels, keyboard keys, page-control dots, …) straight from
 * the component stylesheets — nothing is hand-copied, so the sheet cannot
 * drift from the library. Output is deterministic (no randomness).
 * No dependencies — plain Node.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PATHS,
  buildTokenSet,
  findBlock,
  normalizeColor,
  parseGradient,
  parseShadows,
  readProp,
  readVars,
  resolveVars,
  splitTop,
} from "./export-tokens.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENTS = path.join(ROOT, "packages/ui/src/components");
const OUT_DIR = path.join(ROOT, "design");

const WIDTH = 1200;
const GRID = 24;
const MARGIN = 2 * GRID;
const GAP = GRID; // between items in a row
const CONTENT = WIDTH - 2 * MARGIN;
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

/* ==========================================================================
   Small helpers
   ========================================================================== */

const fmt = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const px = (s) => parseFloat(String(s));

/** "#rrggbb" | "#rrggbbaa" → { hex: "#rrggbb", opacity: 0..1 } */
function paint(hex) {
  const n = normalizeColor(hex);
  if (!n) throw new Error(`Not a colour: ${hex}`);
  return n.length === 9 ? { hex: n.slice(0, 7), opacity: parseInt(n.slice(7), 16) / 255 } : { hex: n, opacity: 1 };
}
const fillAttrs = (hex) => {
  const p = paint(hex);
  return `fill="${p.hex}"${p.opacity < 1 ? ` fill-opacity="${fmt(p.opacity)}"` : ""}`;
};
const strokeAttrs = (hex, width = 1) => {
  const p = paint(hex);
  return `fill="none" stroke="${p.hex}"${p.opacity < 1 ? ` stroke-opacity="${fmt(p.opacity)}"` : ""} stroke-width="${fmt(width)}"`;
};

/* Helvetica advance widths (units per em × 1000) for the labels we set — an
   estimate is enough to size buttons and centre text like the browser does. */
const W_REG = {
  " ": 278, ".": 278, ",": 278, ":": 278, "-": 333, "…": 1000, "?": 556, "!": 278, "/": 278, "'": 191,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
};
const W_BOLD = {
  ...W_REG, ":": 333, "!": 333, "?": 611, "'": 238,
  A: 722, B: 722, E: 667, J: 556, K: 722, L: 611, P: 667, R: 722, S: 667, T: 611, U: 722, V: 667, X: 667, Y: 667,
  a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889,
  n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500,
};
function textWidth(str, size, bold = false) {
  const t = bold ? W_BOLD : W_REG;
  let w = 0;
  for (const ch of str) w += t[ch] ?? 600;
  return (w / 1000) * size;
}
/** "1px solid rgba(0, 0, 0, 0.9)" → { width: 1, color: "#000000e6" } */
function parseBorder(value) {
  const [width, , color] = splitTop(value, " ");
  return { width: px(width), color: normalizeColor(color) };
}
/** baseline y for text vertically centred on cy (Helvetica cap height ≈ 0.72 em) */
const baseline = (cy, size) => cy + size * 0.36;

/* ==========================================================================
   Token context — one per theme
   ========================================================================== */

function localVars(file, base, theme) {
  const f = path.join(COMPONENTS, file);
  const dark = readVars(f, (sel) => sel === base);
  const light = theme === "light"
    ? readVars(f, (sel) => sel.includes('data-theme="light"') && sel.includes(base), { optional: true })
    : [];
  return [dark, light];
}

/** Resolved value / colour / gradient / shadow lookups over a token Map. */
function accessors(set) {
  const { tokens } = set;
  const val = (name) => {
    const t = tokens.get(name);
    if (!t) throw new Error(`Unknown token ${name}`);
    return t.value;
  };
  return {
    tokens,
    val,
    color: (name) => normalizeColor(val(name)) ?? (() => { throw new Error(`${name} is not a colour: ${val(name)}`); })(),
    grad: (name) => parseGradient(val(name)) ?? (() => { throw new Error(`${name} is not a gradient: ${val(name)}`); })(),
    shadows: (name) => parseShadows(val(name)) ?? (() => { throw new Error(`${name} is not a shadow: ${val(name)}`); })(),
    shadow: (name, i = 0) => parseShadows(val(name))[i],
    border: (name) => parseBorder(val(name)),
  };
}

function loadContext(theme) {
  const themeLayers = [readVars(PATHS.dark, (s) => s === ":root")];
  if (theme === "light") themeLayers.push(readVars(PATHS.light, (s) => s.includes('data-theme="light"')));

  // theme-following components: their locals resolve against the theme tokens
  const themed = buildTokenSet(
    ...themeLayers,
    ...localVars("Switch/Switch.css", ".gs-switch", theme),
    ...localVars("Keyboard/Keyboard.css", ".gs-keyboard", theme),
    ...localVars("PageControl/PageControl.css", ".gs-pagecontrol", theme),
    ...localVars("SegmentedControl/SegmentedControl.css", ".gs-segmented", theme),
    ...localVars("Slider/Slider.css", ".gs-slider", theme),
    ...localVars("Progress/Progress.css", ".gs-progress", theme),
  );
  // always-dark components (tab bar, alert, HUD): resolve against the DARK tokens only
  const pinned = buildTokenSet(
    themeLayers[0],
    ...localVars("TabBar/TabBar.css", ".gs-tabbar", "dark"),
    ...localVars("TabBar/TabBar.css", ".gs-tabbar-item", "dark"),
    ...localVars("Alert/Alert.css", ".gs-alert", "dark"),
  );
  for (const s of [themed, pinned]) {
    if (s.unresolved.size) throw new Error(`Unresolved var(): ${[...s.unresolved].join(", ")}`);
  }

  // literal declarations of the alert panel / action and the HUD box
  const prop = (file, selector, name, set) => {
    const block = findBlock(path.join(COMPONENTS, file), (s) => s === selector);
    const raw = readProp(block.body, name);
    if (raw === null) throw new Error(`${selector} has no ${name}`);
    const map = new Map([...set.tokens].map(([k, t]) => [k, t.raw]));
    const unresolved = new Set();
    const value = resolveVars(raw, map, unresolved);
    if (unresolved.size) throw new Error(`${selector} ${name}: unresolved ${[...unresolved].join(", ")}`);
    return value;
  };
  const alertBg = prop("Alert/Alert.css", ".gs-alert", "background", pinned).split(/,\s*(?=linear-gradient)/);
  const literal = {
    alertPanel: parseGradient(alertBg[1]),
    alertPanelShadow: parseShadows(prop("Alert/Alert.css", ".gs-alert", "box-shadow", pinned)),
    alertBorder: parseBorder(prop("Alert/Alert.css", ".gs-alert", "border", pinned)),
    alertActionShadow: parseShadows(prop("Alert/Alert.css", ".gs-alert__action", "box-shadow", pinned)),
    alertActionBorder: parseBorder(prop("Alert/Alert.css", ".gs-alert__action", "border", pinned)),
    hudBg: normalizeColor(prop("HUD/HUD.css", ".gs-hud", "background", pinned)),
    hudShadow: parseShadows(prop("HUD/HUD.css", ".gs-hud", "box-shadow", pinned)),
    tabbarRim: parseShadows(prop("TabBar/TabBar.css", ".gs-tabbar", "box-shadow", pinned))[0],
    tabbarWell: normalizeColor(prop("TabBar/TabBar.css", ".gs-tabbar-item--selected::before", "background", pinned)),
    listGroupShadow: parseShadows(prop("List/List.css", ".gs-list--grouped .gs-list__group", "box-shadow", themed))[0],
    progressFillShadow: parseShadows(prop("Progress/Progress.css", ".gs-progress__fill", "box-shadow", themed)),
    knobShadow: parseShadows(prop("Switch/Switch.css", ".gs-switch__knob", "box-shadow", themed)),
    badgeShadow: parseShadows(prop("Badge/Badge.css", ".gs-badge", "box-shadow", themed)),
    // pressed gel: the literal inset in Button.css / NavigationBar.css / SegmentedControl.css
    pressed: parseShadows("inset 0 2px 4px rgba(0, 0, 0, 0.6)")[0],
  };

  return { theme, t: accessors(themed), p: accessors(pinned), literal };
}

/* ==========================================================================
   <defs> registry: gradients, filters, clip paths — ids are stable & unique
   ========================================================================== */

/* filter region relative to each element's box: half a box of margin on every
   side, enough for the widest blur (0 8px 24px) on the smallest boxes */
const FILTER_REGION = 'x="-50%" y="-50%" width="200%" height="200%"';

class Defs {
  constructor() {
    this.items = new Map(); // id → markup
    this.byValue = new Map(); // dedupe key → id
    this.clipN = 0;
  }
  add(id, markup) {
    if (this.items.has(id) && this.items.get(id) !== markup) throw new Error(`defs id clash: ${id}`);
    this.items.set(id, markup);
    return id;
  }
  /** linearGradient from a parsed gradient; `to bottom` → x2=0 y2=1, `to right` → x2=1 y2=0 */
  gradient(id, g) {
    const key = `g:${JSON.stringify(g)}`;
    if (this.byValue.has(key)) return this.byValue.get(key);
    if (this.items.has(id)) id = `${id}-${this.items.size}`;
    const dir = { 180: "0 0 0 1", 90: "0 0 1 0", 0: "0 1 0 0", 270: "1 0 0 0" }[g.angle] ?? "0 0 0 1";
    const [x1, y1, x2, y2] = dir.split(" ");
    const stops = g.stops
      .map((s) => {
        const p = paint(s.color);
        return `<stop offset="${fmt(s.position)}" stop-color="${p.hex}"${p.opacity < 1 ? ` stop-opacity="${fmt(p.opacity)}"` : ""}/>`;
      })
      .join("");
    this.add(id, `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`);
    this.byValue.set(key, id);
    return id;
  }
  /** the alert's elliptical top gloss: radial-gradient(ellipse 120% 60% at 50% -10%, …) */
  radial(id, stops) {
    const s = stops
      .map(([o, c]) => {
        const p = paint(c);
        return `<stop offset="${fmt(o)}" stop-color="${p.hex}"${p.opacity < 1 ? ` stop-opacity="${fmt(p.opacity)}"` : ""}/>`;
      })
      .join("");
    return this.add(
      id,
      `<radialGradient id="${id}" cx="0.5" cy="-0.1" r="0.6" gradientTransform="translate(0.5 -0.1) scale(2 1) translate(-0.5 0.1)">${s}</radialGradient>`,
    );
  }
  /** drop shadows (one feDropShadow per non-inset entry, chained) */
  drop(id, shadows) {
    const list = shadows.filter((s) => !s.inset);
    const key = `d:${JSON.stringify(list)}`;
    if (this.byValue.has(key)) return this.byValue.get(key);
    let prev = "SourceGraphic";
    const steps = list
      .map((s, i) => {
        const p = paint(s.color);
        const res = `s${i}`;
        const el = `<feDropShadow in="${prev}" dx="${fmt(px(s.offsetX))}" dy="${fmt(px(s.offsetY))}" stdDeviation="${fmt(px(s.blur) / 2)}" flood-color="${p.hex}" flood-opacity="${fmt(p.opacity)}" result="${res}"/>`;
        prev = res;
        return el;
      })
      .join("");
    this.add(id, `<filter id="${id}" ${FILTER_REGION} color-interpolation-filters="sRGB">${steps}</filter>`);
    this.byValue.set(key, id);
    return id;
  }
  /** inner shadow: the shape's outside, drop-shadowed (feDropShadow) and clipped back to the shape */
  inset(id, shadow) {
    const key = `i:${JSON.stringify(shadow)}`;
    if (this.byValue.has(key)) return this.byValue.get(key);
    const p = paint(shadow.color);
    this.add(
      id,
      `<filter id="${id}" ${FILTER_REGION} color-interpolation-filters="sRGB">` +
        `<feFlood flood-color="#000000" result="flood"/>` +
        `<feComposite in="flood" in2="SourceAlpha" operator="out" result="outside"/>` +
        `<feDropShadow in="outside" dx="${fmt(px(shadow.offsetX))}" dy="${fmt(px(shadow.offsetY))}" stdDeviation="${fmt(px(shadow.blur) / 2)}" flood-color="${p.hex}" flood-opacity="${fmt(p.opacity)}" result="cast"/>` +
        `<feComposite in="cast" in2="SourceAlpha" operator="in" result="inner"/>` +
        `<feComposite in="inner" in2="SourceGraphic" operator="over"/>` +
        `</filter>`,
    );
    this.byValue.set(key, id);
    return id;
  }
  clip(markup) {
    const id = `clip-${++this.clipN}`;
    return this.add(id, `<clipPath id="${id}">${markup}</clipPath>`);
  }
  render() {
    return `<defs>\n${[...this.items.values()].map((m) => `  ${m}`).join("\n")}\n</defs>`;
  }
}

/** gradient id for a token name: --gs-gradient-blue → grad-blue, --gs-gloss → grad-gloss */
const gradIdFor = (name) =>
  `grad-${name.replace(/^--gs-/, "").replace(/^gradient-/, "").replace(/-gradient$/, "")}`;

/* ==========================================================================
   Drawing primitives
   ========================================================================== */

const rrect = (x, y, w, h, r, attrs) =>
  `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"${r ? ` rx="${fmt(Math.min(r, w / 2, h / 2))}"` : ""} ${attrs}/>`;

/** 1 px inner top highlight (box-shadow: inset 0 1px 0 <color>) — straight part of the top edge */
function rimLine(x, y, w, r, color) {
  const inset = Math.min(Math.ceil(r / 2), w / 2 - 1);
  return rrect(x + inset, y + 1, w - 2 * inset, 1, 0, fillAttrs(color));
}

/** 1 px outline drawn just inside the box (CSS border) */
const outline = (x, y, w, h, r, color, width = 1) =>
  rrect(x + width / 2, y + width / 2, w - width, h - width, Math.max(0, r - width / 2), strokeAttrs(color, width));

/**
 * A gel box: gradient fill (+ gloss) + top rim + 1 px border, optionally
 * embossed with the theme's bottom drop edge. Returns SVG.
 */
function gel(D, x, y, w, h, o) {
  const r = o.r ?? 8;
  const parts = [];
  parts.push(rrect(x, y, w, h, r, `fill="url(#${o.gel})"`));
  if (o.gloss) parts.push(rrect(x, y, w, h, r, `fill="url(#${o.gloss})"`));
  if (o.rim) parts.push(rimLine(x, y, w, r, o.rim));
  if (o.border) parts.push(outline(x, y, w, h, r, o.border.color, o.border.width ?? 1));
  const filter = o.filter ? ` filter="url(#${o.filter})"` : "";
  return `<g${filter}>${parts.join("")}</g>`;
}

/** text with a CSS-style text-shadow (drawn as a second text behind) */
function label(x, y, str, o) {
  const size = o.size ?? 17;
  const weight = o.bold === false ? 400 : 700;
  const anchor = o.anchor ? ` text-anchor="${o.anchor}"` : "";
  const base = `font-family="${FONT}" font-size="${fmt(size)}" font-weight="${weight}"${anchor}`;
  let out = "";
  if (o.shadow) {
    const s = o.shadow;
    out += `<text x="${fmt(x + px(s.offsetX))}" y="${fmt(y + px(s.offsetY))}" ${base} ${fillAttrs(s.color)}>${esc(str)}</text>`;
  }
  out += `<text x="${fmt(x)}" y="${fmt(y)}" ${base} ${fillAttrs(o.color)}>${esc(str)}</text>`;
  return out;
}

/* ---- glyphs (24-unit boxes) --------------------------------------------- */
const star = (cx, cy, R, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push(`${fmt(cx + rad * Math.cos(a))},${fmt(cy + rad * Math.sin(a))}`);
  }
  return pts.join(" ");
};
const gear = (cx, cy, R, r, teeth = 8) => {
  const pts = [];
  for (let i = 0; i < teeth * 2; i++) {
    const rad = i % 2 ? r : R;
    for (const off of [-0.16, 0.16]) {
      const a = (i * Math.PI) / teeth + off;
      pts.push(`${fmt(cx + rad * Math.cos(a))},${fmt(cy + rad * Math.sin(a))}`);
    }
  }
  return pts.join(" ");
};
const GLYPHS = {
  star: (f) => `<polygon points="${star(12, 12.5, 11, 4.6)}" ${f}/>`,
  grid: (f) =>
    [[3, 3], [13.5, 3], [3, 13.5], [13.5, 13.5]].map(([x, y]) => rrect(x, y, 7.5, 7.5, 1.5, f)).join(""),
  list: (f) => [3, 9.5, 16].map((y) => rrect(3, y, 18, 4.5, 1.5, f)).join(""),
  search: (f) =>
    `<path fill-rule="evenodd" d="M10 2a8 8 0 1 0 0 16a8 8 0 1 0 0-16zm0 3.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9z" ${f}/>` +
    `<path d="M14.8 14.8l2.1-2.1l5.3 5.3a1.5 1.5 0 0 1-2.1 2.1z" ${f}/>`,
  updates: (f) =>
    `<path d="M12 2l6.5 7h-4v6h-5V9h-4z" ${f}/>` + `<path d="M3 15h4v4h10v-4h4v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" ${f}/>`,
  gear: (f) => `<polygon points="${gear(12, 12, 11, 8)}" ${f}/><circle cx="12" cy="12" r="3.5" fill="#000" fill-opacity="0.35"/>`,
  note: (f) => `<path d="M9 3h2.5l6 4.5v3l-6-3.5V16.5a4 4 0 1 1-2.5-3.7z" ${f}/>`,
  chevron: (s) => `<path d="M9 5l7 7-7 7" ${s} stroke-linecap="round" stroke-linejoin="round"/>`,
  check: (s) => `<path d="M4 12.5l5 5L20 6.5" ${s} stroke-linecap="round" stroke-linejoin="round"/>`,
  magnifier: (s) => `<circle cx="10.5" cy="10.5" r="6.5" ${s}/><path d="M15.5 15.5L21 21" ${s} stroke-linecap="round"/>`,
};
const glyph = (name, x, y, size, attrs) =>
  `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(size / 24)})">${GLYPHS[name](attrs)}</g>`;

/* ==========================================================================
   Components — each returns { w, h, svg } for the given origin
   ========================================================================== */

function makeComponents(ctx, D) {
  const { t, p, literal, theme } = ctx;
  const light = theme === "light";

  // shared ids
  const G = {
    gloss: D.gradient("grad-gloss", t.grad("--gs-gloss")),
    glossSoft: D.gradient("grad-gloss-soft", t.grad("--gs-gloss-soft")),
    blue: D.gradient("grad-blue", t.grad("--gs-gradient-blue")),
    bluePressed: D.gradient("grad-blue-pressed", t.grad("--gs-gradient-blue-pressed")),
    red: D.gradient("grad-red", t.grad("--gs-gradient-red")),
    redPressed: D.gradient("grad-red-pressed", t.grad("--gs-gradient-red-pressed")),
    dark: D.gradient("grad-dark", t.grad("--gs-gradient-dark")),
    neutral: D.gradient("grad-neutral", t.grad("--gs-gradient-neutral")),
    neutralPressed: D.gradient("grad-neutral-pressed", t.grad("--gs-gradient-neutral-pressed")),
    bar: D.gradient("grad-bar", t.grad("--gs-gradient-bar")),
    barbutton: D.gradient("grad-barbutton", t.grad("--gs-gradient-barbutton")),
    knob: D.gradient("grad-switch-knob-gel", t.grad("--gs-switch-knob-gel")),
  };
  const F = {
    emboss: D.drop("f-emboss", t.shadows("--gs-rim-dark")),
    pressed: D.inset("f-pressed", literal.pressed),
    well: D.inset("f-well", t.shadow("--gs-inset", 0)),
  };
  const border = t.border("--gs-border");
  const rimLight = t.shadow("--gs-rim-light").color;
  const shDark = t.shadow("--gs-text-shadow-dark");
  const shOnBar = t.shadow("--gs-text-shadow-on-bar");
  const emboss = t.shadow("--gs-text-emboss");
  const white = t.color("--gs-white");

  const C = {};

  /* ---- Button ---------------------------------------------------------- */
  C.button = (x, y, { variant = "default", pressed = false, size = "md", text = "Button" }) => {
    const h = size === "sm" ? 30 : 44;
    const fs = size === "sm" ? px(t.val("--gs-font-size-sm")) : px(t.val("--gs-font-size-lg"));
    const pad = size === "sm" ? 10 : 14;
    const r = size === "sm" ? px(t.val("--gs-radius-sm")) : px(t.val("--gs-radius-md"));
    const w = Math.ceil(textWidth(text, fs, true) + 2 * pad + 2);
    const gels = {
      default: [G.neutral, G.neutralPressed, t.color("--gs-text-on-neutral"), t.shadow("--gs-text-shadow-on-neutral")],
      primary: [G.blue, G.bluePressed, white, shDark],
      destructive: [G.red, G.redPressed, white, shDark],
    }[variant];
    const [gelId, pressedId, color, shadow] = gels;
    const box = pressed
      ? gel(D, x, y, w, h, { r, gel: pressedId, border, filter: F.emboss })
      : gel(D, x, y, w, h, { r, gel: gelId, gloss: G.gloss, rim: rimLight, border, filter: F.emboss });
    const inner = pressed ? `<g filter="url(#${F.pressed})">${rrect(x, y, w, h, r, `fill="url(#${pressedId})"`)}</g>` : "";
    return {
      w, h,
      svg: `${box}${inner}${label(x + w / 2, baseline(y + h / 2, fs), text, { size: fs, color, shadow, anchor: "middle" })}`,
    };
  };

  /* ---- BarButton / back button ---------------------------------------- */
  const barText = t.color("--gs-text-on-bar");
  C.barButton = (x, y, { text = "Done", done = false }) => {
    const fs = 12;
    const w = Math.ceil(textWidth(text, fs, true) + 20 + 2);
    const h = 30;
    const r = px(t.val("--gs-radius-sm"));
    const svg =
      gel(D, x, y, w, h, { r, gel: done ? G.blue : G.barbutton, gloss: G.gloss, rim: rimLight, border, filter: F.emboss }) +
      label(x + w / 2, baseline(y + h / 2, fs), text, { size: fs, color: done ? white : barText, shadow: done ? shDark : shOnBar, anchor: "middle" });
    return { w, h, svg };
  };
  C.backButton = (x, y, { text = "Back" }) => {
    const fs = 12;
    const h = 30;
    const r = px(t.val("--gs-radius-sm"));
    const point = 9;
    const w = Math.ceil(textWidth(text, fs, true) + 16 + 10 + 2);
    const outlineColor = light ? t.color("--gs-bar-border") : t.color("--gs-black");
    // ::before — the silhouette, the polygon from NavigationBar.css
    const outer = `M${fmt(x + point)} ${fmt(y)} H${fmt(x + w - r)} A${r} ${r} 0 0 1 ${fmt(x + w)} ${fmt(y + r)} V${fmt(y + h - r)} A${r} ${r} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)} H${fmt(x + point)} L${fmt(x)} ${fmt(y + h / 2)} Z`;
    // ::after — the gel inset 1 px: polygon(8.6px 0, 100% 0, 100% 100%, 8.6px 100%, 0.2px 50%) inside a 1 px inset box
    const ri = r - 1;
    const inner = `M${fmt(x + 1 + 8.6)} ${fmt(y + 1)} H${fmt(x + w - 1 - ri)} A${ri} ${ri} 0 0 1 ${fmt(x + w - 1)} ${fmt(y + 1 + ri)} V${fmt(y + h - 1 - ri)} A${ri} ${ri} 0 0 1 ${fmt(x + w - 1 - ri)} ${fmt(y + h - 1)} H${fmt(x + 1 + 8.6)} L${fmt(x + 1 + 0.2)} ${fmt(y + h / 2)} Z`;
    const svg =
      `<g filter="url(#${F.emboss})">` +
      `<path d="${outer}" ${fillAttrs(outlineColor)}/>` +
      `<path d="${inner}" fill="url(#${G.barbutton})"/>` +
      `<path d="${inner}" fill="url(#${G.gloss})"/>` +
      rrect(x + point + 2, y + 2, w - point - 2 - Math.ceil(r / 2) - 1, 1, 0, fillAttrs(rimLight)) +
      `</g>` +
      label(x + 16 + (w - 26) / 2, baseline(y + h / 2, fs), text, { size: fs, color: barText, shadow: shOnBar, anchor: "middle" });
    return { w, h, svg };
  };

  /* ---- NavigationBar 320×44 ------------------------------------------- */
  C.navBar = (x, y) => {
    const w = 320;
    const h = px(t.val("--gs-bar-height"));
    const back = C.backButton(x + 5, y + 7, { text: "Featured" });
    const doneW = C.barButton(0, 0, { text: "Done", done: true }).w;
    const done = C.barButton(x + w - 5 - doneW, y + 7, { text: "Done", done: true });
    const svg =
      rrect(x, y, w, h, 0, `fill="url(#${G.bar})"`) +
      rrect(x, y, w, h, 0, `fill="url(#${G.glossSoft})"`) +
      rrect(x, y, w, 1, 0, fillAttrs(t.color("--gs-bar-rim"))) +
      rrect(x, y + h - 1, w, 1, 0, fillAttrs(t.color("--gs-bar-border"))) +
      label(x + w / 2, baseline(y + h / 2, 20), "Categories", { size: 20, color: barText, shadow: shOnBar, anchor: "middle" }) +
      back.svg +
      done.svg;
    return { w, h, svg };
  };

  /* ---- TabBar 320×49 (black in both themes) --------------------------- */
  C.tabBar = (x, y) => {
    const w = 320;
    const h = px(p.val("--gs-tabbar-height"));
    const tabGel = D.gradient("grad-tabbar", p.grad("--gs-tabbar-gradient"));
    const glossSoftDark = D.gradient("grad-gloss-soft", p.grad("--gs-gloss-soft"));
    const iconInactive = D.gradient("grad-icon-inactive", {
      angle: 180, repeating: false,
      stops: [{ color: p.color("--gs-icon-inactive-top"), position: 0 }, { color: p.color("--gs-icon-inactive-bottom"), position: 1 }],
    });
    const iconActive = D.gradient("grad-icon-active", {
      angle: 180, repeating: false,
      stops: [{ color: p.color("--gs-icon-active-top"), position: 0 }, { color: p.color("--gs-icon-active-bottom"), position: 1 }],
    });
    const sunk = D.inset("f-tab-sunk", p.shadow("--gs-tabbar-item-sunk"));
    const items = [
      ["Featured", "star", true],
      ["Categories", "grid", false],
      ["Top 25", "list", false],
      ["Search", "search", false],
      ["Updates", "updates", false, "43"],
    ];
    const iw = w / items.length;
    let svg =
      rrect(x, y, w, h, 0, fillAttrs(p.color("--gs-black"))) +
      rrect(x, y + 1, w, h - 1, 0, `fill="url(#${tabGel})"`) +
      rrect(x, y + 1, w, h - 1, 0, `fill="url(#${glossSoftDark})"`) +
      rrect(x, y + 1, w, 1, 0, fillAttrs(literal.tabbarRim.color));
    items.forEach(([name, icon, selected, badge], i) => {
      const ix = x + i * iw;
      if (selected) {
        svg += `<g filter="url(#${sunk})">${rrect(ix + 2, y + 3, iw - 4, h - 5, 4, fillAttrs(literal.tabbarWell))}</g>`;
      }
      const gx = ix + iw / 2 - 13;
      svg += glyph(icon, gx, y + 6, 26, `fill="url(#${selected ? iconActive : iconInactive})"`);
      svg += label(ix + iw / 2, y + 42, name, {
        size: 10, color: selected ? p.color("--gs-tabbar-label-selected") : p.color("--gs-tabbar-label"), shadow: shDark, anchor: "middle",
      });
      if (badge) {
        const b = C.badge(0, 0, { text: badge });
        // top: -3px; right: -11px; scale(.85) from the icon's top-right corner
        svg += `<g transform="translate(${fmt(gx + 26 + 11 - b.w * 0.85)} ${fmt(y + 6 - 3)}) scale(0.85)">${b.svg}</g>`;
      }
    });
    return { w, h, svg };
  };

  /* ---- Badge ----------------------------------------------------------- */
  C.badge = (x, y, { text = "43", gray = false }) => {
    const fs = px(t.val("--gs-font-size-sm"));
    const h = 20;
    const w = Math.max(20, Math.ceil(textWidth(text, fs, true) + 12 + 4));
    const drop = D.drop("f-badge", literal.badgeShadow);
    const borderColor = gray ? "#ffffffcc" : white;
    const svg =
      `<g filter="url(#${drop})">` +
      rrect(x, y, w, h, h / 2, fillAttrs(borderColor)) +
      rrect(x + 2, y + 2, w - 4, h - 4, h / 2 - 2, `fill="url(#${gray ? G.dark : G.red})"`) +
      rrect(x + 2, y + 2, w - 4, h - 4, h / 2 - 2, `fill="url(#${G.gloss})"`) +
      `</g>` +
      label(x + w / 2, baseline(y + h / 2, fs), text, { size: fs, color: white, shadow: shDark, anchor: "middle" });
    return { w, h, svg };
  };

  /* ---- Switch 94×27 ---------------------------------------------------- */
  C.switch = (x, y, { on = true }) => {
    const w = px(t.val("--gs-switch-width"));
    const h = px(t.val("--gs-switch-height"));
    const k = px(t.val("--gs-switch-knob"));
    const offGel = D.gradient("grad-switch-off-gel", t.grad("--gs-switch-off-gel"));
    const fs = px(t.val("--gs-font-size-md"));
    const clip = D.clip(rrect(x + 1, y + 1, w - 2, h - 2, (h - 2) / 2, ""));
    const knobDrop = D.drop("f-knob", literal.knobShadow);
    const ring = literal.knobShadow.find((s) => px(s.spread) > 0 && !s.inset);
    const knobRim = literal.knobShadow.find((s) => s.inset);
    const strip = on
      ? rrect(x + 1, y + 1, w - 2, h - 2, 0, `fill="url(#${G.blue})"`) +
        rrect(x + 1, y + 1, w - 2, h - 2, 0, `fill="url(#${G.gloss})"`) +
        label(x + 1 + 10, baseline(y + h / 2, fs), "ON", { size: fs, color: t.color("--gs-text-on-blue"), shadow: shDark })
      : rrect(x + 1, y + 1, w - 2, h - 2, 0, `fill="url(#${offGel})"`) +
        rrect(x + 1, y + 1, w - 2, h - 2, 0, `fill="url(#${G.gloss})"`) +
        label(x + w - 1 - 10, baseline(y + h / 2, fs), "OFF", { size: fs, color: t.color("--gs-switch-off-text"), shadow: t.shadow("--gs-switch-off-text-shadow"), anchor: "end" });
    const cx = on ? x + w - k / 2 : x + k / 2;
    const cy = y + h / 2;
    const chord = Math.sqrt(k * k / 4 - (k / 2 - 1.5) ** 2);
    const svg =
      `<g filter="url(#${F.well})"><g clip-path="url(#${clip})">${strip}</g></g>` +
      outline(x, y, w, h, h / 2, border.color, border.width) +
      `<g filter="url(#${knobDrop})">` +
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(k / 2)}" fill="url(#${G.knob})"/>` +
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(k / 2)}" fill="url(#${G.gloss})"/>` +
      rrect(cx - chord, cy - k / 2 + 1, 2 * chord, 1, 0.5, fillAttrs(knobRim.color)) +
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(k / 2 + px(ring.spread) / 2)}" ${strokeAttrs(ring.color, px(ring.spread))}/>` +
      `</g>`;
    return { w: w + 1, h, svg };
  };

  /* ---- Grouped list 300 ------------------------------------------------ */
  C.groupedList = (x, y) => {
    const w = 300;
    const rowH = px(t.val("--gs-control-height"));
    const r = px(t.val("--gs-radius-lg"));
    const surface = t.color("--gs-surface");
    const sep = t.color("--gs-separator");
    const sepLight = t.color("--gs-separator-light");
    const headerColor = t.color("--gs-header-text");
    const glossSurface = light ? D.gradient("grad-surface-gloss", t.grad("--gs-surface-gloss")) : null;
    const chevronStroke = strokeAttrs(t.color("--gs-gray-400"), 2.25);
    const checkStroke = strokeAttrs(t.color("--gs-blue-300"), 2.25);
    const tileGlyphShadow = { offsetX: "0px", offsetY: "-1px", color: "#000000b3" }; // drop-shadow(0 -1px 0 rgba(0,0,0,.7))
    const groupDrop = D.drop("f-list-group", [literal.listGroupShadow]);

    const tile = (tx, ty, gelId, name) =>
      gel(D, tx, ty, 29, 29, { r: 6, gel: gelId, gloss: G.gloss, rim: rimLight, border, filter: F.emboss }) +
      glyph(name, tx + 5.5 + px(tileGlyphShadow.offsetX), ty + 5.5 + px(tileGlyphShadow.offsetY), 18, fillAttrs(tileGlyphShadow.color)) +
      glyph(name, tx + 5.5, ty + 5.5, 18, fillAttrs(white));

    const group = (gy, rows) => {
      const gh = rows.length * rowH;
      const clip = D.clip(rrect(x + 1, gy + 1, w - 2, gh - 2, r - 1, ""));
      let s = `<g filter="url(#${groupDrop})">${rrect(x, gy, w, gh, r, fillAttrs(surface))}</g>`;
      s += `<g clip-path="url(#${clip})">`;
      rows.forEach((row, i) => {
        const ry = gy + i * rowH;
        if (glossSurface) s += rrect(x + 1, ry, w - 2, rowH, 0, `fill="url(#${glossSurface})"`);
        if (i > 0) s += rrect(x + 1, ry, w - 2, 1, 0, fillAttrs(sep));
        s += rrect(x + 1, ry + (i > 0 ? 1 : 0), w - 2, 1, 0, fillAttrs(sepLight));
        let cx = x + 10;
        if (row.tile) {
          s += tile(cx, ry + (rowH - 29) / 2, row.tile[0], row.tile[1]);
          cx += 29 + 10;
        }
        s += label(cx, baseline(ry + rowH / 2, 17), row.title, { size: 17, color: t.color("--gs-text"), shadow: emboss });
        const ax = x + w - 10 - 20; // accessory slot
        if (row.detail) {
          s += label(ax - 10, baseline(ry + rowH / 2, 17), row.detail, { size: 17, bold: false, color: t.color("--gs-text-link"), shadow: emboss, anchor: "end" });
        }
        if (row.accessory === "chevron") s += glyph("chevron", ax, ry + (rowH - 20) / 2, 20, chevronStroke);
        if (row.accessory === "checkmark") s += glyph("check", ax, ry + (rowH - 20) / 2, 20, checkStroke);
      });
      s += `</g>`;
      s += outline(x, gy, w, gh, r, border.color, border.width);
      return { svg: s, h: gh };
    };

    // the dark sheet is black; the list belongs on the grouped-table pinstripe, so give it a panel
    let svg = light ? "" : pinstripe(x - 12, y - 6, w + 24, 24 + 3 * rowH + 24 + 24 + 2 * rowH + 12, t.grad("--gs-pinstripe-bg"));
    svg += label(x + 10, y + 14, "Store", { size: 15, color: headerColor, shadow: emboss });
    let cy = y + 24;
    const g1 = group(cy, [
      { tile: [G.red, "star"], title: "Games", accessory: "chevron" },
      { tile: [G.blue, "note"], title: "Music", accessory: "chevron" },
      { tile: [G.dark, "gear"], title: "Settings", accessory: "chevron" },
    ]);
    svg += g1.svg;
    cy += g1.h + 24;
    svg += label(x + 10, cy + 14, "Sort by", { size: 15, color: headerColor, shadow: emboss });
    cy += 24;
    const g2 = group(cy, [
      { title: "Order", detail: "Name", accessory: "chevron" },
      { title: "Newest first", accessory: "checkmark" },
    ]);
    svg += g2.svg;
    cy += g2.h;
    return { w, h: cy - y + (light ? 0 : 6), svg };
  };

  /* ---- TextField well / SearchField pill ------------------------------ */
  const well = (x, y, w, h, r) =>
    `<g filter="url(#${F.well})">${rrect(x, y, w, h, r, fillAttrs(t.color("--gs-surface-sunken")))}</g>` +
    outline(x, y, w, h, r, border.color, border.width);

  C.textField = (x, y) => {
    const w = 280;
    const h = px(t.val("--gs-control-height"));
    const r = px(t.val("--gs-radius-md"));
    const svg =
      well(x, y, w, h, r) +
      label(x + 10, baseline(y + h / 2, 15), "Name", { size: 15, color: t.color("--gs-text"), shadow: emboss }) +
      rrect(x + 10 + 90 - 1, y + 9, 1, h - 18, 0, fillAttrs(t.color("--gs-separator"))) +
      rrect(x + 10 + 90, y + 9, 1, h - 18, 0, fillAttrs(t.color("--gs-separator-light"))) +
      label(x + 10 + 90 + 8, baseline(y + h / 2, 17), "required", { size: 17, bold: false, color: t.color("--gs-text-tertiary") });
    return { w, h, svg };
  };

  C.searchField = (x, y) => {
    const w = 280;
    const h = 32;
    const gray = t.color("--gs-gray-400");
    const svg =
      well(x, y, w, h, h / 2) +
      glyph("magnifier", x + 10, y + (h - 16) / 2, 16, strokeAttrs(gray, 2.25)) +
      label(x + 10 + 16 + 6, baseline(y + h / 2, 15), "Search", { size: 15, bold: false, color: t.color("--gs-text-tertiary") }) +
      `<circle cx="${fmt(x + w - 8 + 4 - 12)}" cy="${fmt(y + h / 2)}" r="9" ${fillAttrs(gray)}/>` +
      `<path d="M${fmt(x + w - 16 - 3.5)} ${fmt(y + h / 2 - 3.5)}l7 7m0-7l-7 7" ${strokeAttrs(t.color("--gs-surface-sunken"), 2)} stroke-linecap="round"/>`;
    return { w, h, svg };
  };

  /* ---- SegmentedControl ----------------------------------------------- */
  C.segmented = (x, y) => {
    const segs = ["Day", "Week", "Month"];
    const sw = 80;
    const w = sw * segs.length;
    const h = px(t.val("--gs-control-height"));
    const r = px(t.val("--gs-radius-sm"));
    const fs = px(t.val("--gs-font-size-md"));
    const segGel = D.gradient("grad-segment-gel", t.grad("--gs-segment-gel"));
    const selGel = D.gradient("grad-segment-selected", t.grad("--gs-segment-gel-selected"));
    const sunkList = t.shadows("--gs-segment-sunk");
    const sunk = D.inset("f-segment-sunk", sunkList[0]);
    const clip = D.clip(rrect(x + 1, y + 1, w - 2, h - 2, r - 1, ""));
    let inner = "";
    segs.forEach((name, i) => {
      const sx = x + 1 + i * sw;
      const selected = i === 1;
      if (selected) {
        inner += `<g filter="url(#${sunk})">${rrect(sx, y + 1, sw, h - 2, 0, `fill="url(#${selGel})"`)}</g>`;
        const bottomRim = sunkList[1];
        if (bottomRim) inner += rrect(sx, y + h - 2, sw, 1, 0, fillAttrs(bottomRim.color));
      } else {
        inner += rrect(sx, y + 1, sw, h - 2, 0, `fill="url(#${segGel})"`) + rrect(sx, y + 1, sw, h - 2, 0, `fill="url(#${G.gloss})"`);
        inner += rrect(sx, y + 2, sw, 1, 0, fillAttrs(rimLight));
      }
      if (i > 0) {
        inner += rrect(sx, y + 1, 1, h - 2, 0, fillAttrs(t.color("--gs-segment-divider")));
        inner += rrect(sx + 1, y + 1, 1, h - 2, 0, fillAttrs(t.color("--gs-segment-divider-rim")));
      }
      inner += label(sx + sw / 2, baseline(y + h / 2, fs), name, { size: fs, color: barText, shadow: shOnBar, anchor: "middle" });
    });
    const svg =
      `<g filter="url(#${F.emboss})">${rrect(x, y, w, h, r, fillAttrs(border.color))}</g>` +
      `<g clip-path="url(#${clip})">${inner}</g>` +
      outline(x, y, w, h, r, border.color, border.width);
    return { w, h, svg };
  };

  /* ---- Slider ---------------------------------------------------------- */
  C.slider = (x, y, { pct = 0.6 }) => {
    const w = 240;
    const track = px(t.val("--gs-slider-track"));
    const k = px(t.val("--gs-slider-thumb"));
    const h = k;
    const ty = y + (h - track) / 2;
    const knobGel = D.gradient("grad-slider-knob-gel", t.grad("--gs-slider-knob-gel"));
    const knobShadow = t.shadows("--gs-slider-knob-shadow");
    const knobDrop = D.drop("f-slider-knob", knobShadow);
    const ring = knobShadow.find((s) => px(s.spread) > 0 && !s.inset);
    const knobRim = knobShadow.find((s) => s.inset);
    const cx = x + k / 2 + (w - k) * pct;
    const cy = y + h / 2;
    const clip = D.clip(rrect(x + 1, ty + 1, w - 2, track - 2, (track - 2) / 2, ""));
    const chord = Math.sqrt(k * k / 4 - (k / 2 - 1.5) ** 2);
    const svg =
      `<g filter="url(#${F.well})">${rrect(x, ty, w, track, track / 2, fillAttrs(t.color("--gs-surface-sunken")))}` +
      `<g clip-path="url(#${clip})">` +
      rrect(x + 1, ty + 1, cx - x - 1, track - 2, 0, `fill="url(#${G.blue})"`) +
      rrect(x + 1, ty + 1, cx - x - 1, track - 2, 0, `fill="url(#${G.gloss})"`) +
      `</g></g>` +
      outline(x, ty, w, track, track / 2, border.color, border.width) +
      `<g filter="url(#${knobDrop})">` +
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(k / 2)}" fill="url(#${knobGel})"/>` +
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(k / 2)}" fill="url(#${G.gloss})"/>` +
      rrect(cx - chord, cy - k / 2 + 1, 2 * chord, 1, 0.5, fillAttrs(knobRim.color)) +
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(k / 2 + px(ring.spread) / 2)}" ${strokeAttrs(ring.color, px(ring.spread))}/>` +
      `</g>`;
    return { w, h, svg };
  };

  /* ---- ProgressBar ----------------------------------------------------- */
  C.progress = (x, y, { pct = 0.6 }) => {
    const w = 240;
    const h = 9;
    const clip = D.clip(rrect(x + 1, y + 1, w - 2, h - 2, (h - 2) / 2, ""));
    const edge = D.drop("f-progress-edge", literal.progressFillShadow);
    const fillRim = literal.progressFillShadow.find((s) => s.inset);
    const fw = Math.round((w - 2) * pct);
    const svg =
      `<g filter="url(#${F.well})">${rrect(x, y, w, h, h / 2, fillAttrs(t.color("--gs-surface-sunken")))}` +
      `<g clip-path="url(#${clip})"><g filter="url(#${edge})">` +
      rrect(x + 1, y + 1, fw, h - 2, (h - 2) / 2, `fill="url(#${G.blue})"`) +
      rrect(x + 1, y + 1, fw, h - 2, (h - 2) / 2, `fill="url(#${G.gloss})"`) +
      rrect(x + 3, y + 2, fw - 4, 1, 0.5, fillAttrs(fillRim.color)) +
      `</g></g></g>` +
      outline(x, y, w, h, h / 2, border.color, border.width);
    return { w, h, svg };
  };

  /* ---- PageControl ----------------------------------------------------- */
  C.pageControl = (x, y, { count = 5, current = 1 }) => {
    const dot = px(t.val("--gs-pagecontrol-dot"));
    const pitch = dot + 10 + 4; // padding 0 5px + gap 4px
    const w = count * (dot + 10) + (count - 1) * 4;
    const h = 36;
    const currentGel = D.gradient("grad-pagecontrol-current", t.grad("--gs-pagecontrol-current"));
    const inactiveShadows = t.shadows("--gs-pagecontrol-inactive-shadow");
    const currentShadows = t.shadows("--gs-pagecontrol-current-shadow");
    const inactiveInset = D.inset("f-dot-inset", inactiveShadows.find((s) => s.inset));
    const inactiveDrop = D.drop("f-dot-drop", inactiveShadows);
    const currentDrop = D.drop("f-dot-current", currentShadows);
    const currentRing = currentShadows.find((s) => px(s.spread) > 0 && !s.inset);
    const currentRim = currentShadows.find((s) => s.inset);
    let svg = "";
    for (let i = 0; i < count; i++) {
      const cx = x + 5 + dot / 2 + i * pitch;
      const cy = y + h / 2;
      if (i === current) {
        svg += `<g filter="url(#${currentDrop})"><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(dot / 2)}" fill="url(#${currentGel})"/>`;
        if (currentRim) svg += rrect(cx - dot / 4, cy - dot / 2 + 1, dot / 2, 1, 0.5, fillAttrs(currentRim.color));
        if (currentRing) svg += `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(dot / 2 + px(currentRing.spread) / 2)}" ${strokeAttrs(currentRing.color, px(currentRing.spread))}/>`;
        svg += `</g>`;
      } else {
        svg += `<g filter="url(#${inactiveDrop})"><g filter="url(#${inactiveInset})"><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(dot / 2)}" ${fillAttrs(t.color("--gs-pagecontrol-inactive"))}/></g></g>`;
      }
    }
    return { w, h, svg };
  };

  /* ---- Alert 284 -------------------------------------------------------- */
  C.alert = (x, y) => {
    const w = 284;
    const r = px(p.val("--gs-radius-lg"));
    const panel = D.gradient("grad-alert-panel", literal.alertPanel);
    const glossEllipse = D.radial("grad-alert-gloss", [[0, "#ffffff47"], [0.55, "#ffffff0f"], [0.6, "#ffffff00"]]);
    const gelDefault = D.gradient("grad-alert-gel-default", p.grad("--gs-alert-gel-default"));
    const gelPrimary = D.gradient("grad-alert-gel-primary", p.grad("--gs-alert-gel-primary"));
    const pop = D.drop("f-alert-pop", literal.alertPanelShadow);
    const innerRing = literal.alertPanelShadow.find((s) => s.inset);
    const bwN = literal.alertBorder.width;
    const ab = literal.alertActionBorder;
    const actionDrop = D.drop("f-alert-action", literal.alertActionShadow);
    const actionRim = literal.alertActionShadow.find((s) => s.inset);
    const glossDark = D.gradient("grad-gloss", p.grad("--gs-gloss"));
    const titleShadow = parseShadows("0 -1px 0 rgba(0, 0, 0, 0.6)")[0];

    const padX = 12;
    const titleY = y + 2 + 14;
    const msgY = titleY + 21.6 + 6;
    const btnY = Math.round(msgY + 2 * 19.5 + 14);
    const btnH = 43;
    const h = btnY + btnH + 10 + 2 - y;

    const button = (bx, bwid, text, gelId, primary) =>
      `<g filter="url(#${actionDrop})">` +
      rrect(bx, btnY, bwid, btnH, 8, `fill="url(#${gelId})"`) +
      rrect(bx, btnY, bwid, btnH, 8, `fill="url(#${glossDark})"`) +
      rimLine(bx, btnY, bwid, 8, actionRim.color) +
      outline(bx, btnY, bwid, btnH, 8, ab.color, ab.width) +
      `</g>` +
      label(bx + bwid / 2, baseline(btnY + btnH / 2, 17), text, {
        size: 17, color: primary ? "#0f2650" : white, shadow: primary ? p.shadow("--gs-text-shadow-light") : shDark, anchor: "middle",
      });

    const inner = (w - 2 * bwN - 2 * padX - 10) / 2;
    const svg =
      `<g filter="url(#${pop})">` +
      rrect(x, y, w, h, r, `fill="url(#${panel})"`) +
      rrect(x, y, w, h, r, `fill="url(#${glossEllipse})"`) +
      outline(x, y, w, h, r, literal.alertBorder.color, bwN) +
      outline(x + bwN, y + bwN, w - 2 * bwN, h - 2 * bwN, r - bwN, innerRing.color, px(innerRing.spread)) +
      `</g>` +
      label(x + w / 2, titleY + 16, "Delete Playlist?", { size: 18, color: white, shadow: titleShadow, anchor: "middle" }) +
      label(x + w / 2, msgY + 14.5, "This will remove the playlist from", { size: 15, bold: false, color: white, shadow: titleShadow, anchor: "middle" }) +
      label(x + w / 2, msgY + 14.5 + 19.5, "your iPhone.", { size: 15, bold: false, color: white, shadow: titleShadow, anchor: "middle" }) +
      button(x + bwN + padX, inner, "Cancel", gelDefault, false) +
      button(x + bwN + padX + inner + 10, inner, "OK", gelPrimary, true);
    return { w, h, svg };
  };

  /* ---- HUD 140×140 ------------------------------------------------------ */
  C.hud = (x, y) => {
    const w = 140;
    const h = 140;
    const r = px(p.val("--gs-radius-lg"));
    const drop = D.drop("f-hud", literal.hudShadow);
    const ring = literal.hudShadow.find((s) => s.inset && px(s.spread) > 0);
    const rim = literal.hudShadow.find((s) => s.inset && px(s.spread) === 0);
    const size = 37;
    const scx = x + w / 2;
    const scy = y + 36 + size / 2;
    let spokes = "";
    for (let i = 0; i < 12; i++) {
      const opacity = 1 - ((12 - i) % 12) * 0.065;
      spokes += `<rect x="18" y="3" width="4" height="10" rx="2" fill="#ffffff" opacity="${fmt(opacity)}" transform="rotate(${i * 30} 20 20)"/>`;
    }
    const svg =
      `<g filter="url(#${drop})">` +
      rrect(x, y, w, h, r, fillAttrs(literal.hudBg)) +
      outline(x, y, w, h, r, ring.color, px(ring.spread)) +
      rimLine(x, y, w, r, rim.color) +
      `</g>` +
      `<g transform="translate(${fmt(scx - size / 2)} ${fmt(scy - size / 2)}) scale(${fmt(size / 40)})">${spokes}</g>` +
      label(x + w / 2, y + 36 + size + 12 + 15, "Loading…", { size: 16, color: white, shadow: shDark, anchor: "middle" });
    return { w, h, svg };
  };

  /* ---- Keyboard key 26×39 + popup ---------------------------------------- */
  const keyBox = (x, y, gelId, letter, keyText, keyTextShadow) => {
    const w = px(t.val("--gs-key-width"));
    const h = px(t.val("--gs-key-height"));
    const r = px(t.val("--gs-key-radius"));
    const shadows = t.shadows("--gs-key-shadow");
    const rim = shadows.find((s) => s.inset);
    const drop = D.drop("f-key", shadows);
    const kb = t.border("--gs-key-border");
    return gel(D, x, y, w, h, { r, gel: gelId, gloss: G.gloss, rim: rim?.color, border: kb, filter: drop }) +
      (letter ? label(x + w / 2, baseline(y + h / 2, 22), letter, { size: 22, bold: false, color: keyText, shadow: keyTextShadow, anchor: "middle" }) : "");
  };
  C.key = (x, y, { letter = "G", fn = false }) => {
    const w = fn ? 38 : px(t.val("--gs-key-width"));
    const h = px(t.val("--gs-key-height"));
    const gelId = D.gradient(fn ? "grad-key-fn" : "grad-key-gel", t.grad(fn ? "--gs-key-fn" : "--gs-key-gel"));
    if (fn) {
      const r = px(t.val("--gs-key-radius"));
      const shadows = t.shadows("--gs-key-shadow");
      const svg = gel(D, x, y, w, h, { r, gel: gelId, gloss: G.gloss, rim: shadows.find((s) => s.inset)?.color, border: t.border("--gs-key-border"), filter: D.drop("f-key", shadows) }) +
        label(x + w / 2, baseline(y + h / 2, 15), letter, { size: 15, color: t.color("--gs-key-fn-text"), shadow: t.shadow("--gs-key-fn-text-shadow"), anchor: "middle" });
      return { w, h, svg };
    }
    return { w, h, svg: keyBox(x, y, gelId, letter, t.color("--gs-key-text"), t.shadow("--gs-key-text-shadow")) };
  };
  C.keyPopup = (x, y, { letter = "G" }) => {
    const kw = px(t.val("--gs-key-width"));
    const kh = px(t.val("--gs-key-height"));
    const kr = px(t.val("--gs-key-radius"));
    const pw = 46;
    const ph = 58;
    const w = pw;
    const h = ph - 2 + kh;
    const keyX = x + (pw - kw) / 2;
    const keyY = y + ph - 2;
    const pressed = D.gradient("grad-key-gel-pressed", t.grad("--gs-key-gel-pressed"));
    const popup = D.gradient("grad-key-popup", t.grad("--gs-key-popup"));
    const outlineColor = t.color("--gs-key-popup-outline");
    const drop = D.drop("f-key-popup", t.shadows("--gs-key-popup-shadow"));
    const neckColor = t.color("--gs-key-popup-bottom");
    const svg =
      keyBox(keyX, keyY, pressed, null) +
      `<g filter="url(#${drop})">` +
      // neck: key-wide column from 2 px above the bubble's bottom edge down over the key (+1 px),
      // rounded at the bottom like the key, outlined on its three free sides
      `<path d="${neck(keyX, y + ph - 2, kw, kh + 1, kr)}" ${fillAttrs(neckColor)}/>` +
      `<path d="${neck(keyX - 0.5, y + ph - 2, kw + 1, kh + 1.5, kr + 0.5, true)}" ${strokeAttrs(outlineColor, 1)}/>` +
      rrect(x, y, pw, ph, 8, `fill="url(#${popup})"`) +
      rrect(x, y, pw, ph, 8, `fill="url(#${G.glossSoft})"`) +
      rrect(x - 0.5, y - 0.5, pw + 1, ph + 1, 8.5, strokeAttrs(outlineColor, 1)) +
      `</g>` +
      label(x + pw / 2, baseline(y + (ph - 2) / 2, 36), letter, { size: 36, bold: false, color: t.color("--gs-key-popup-text"), shadow: t.shadow("--gs-key-popup-text-shadow"), anchor: "middle" });
    return { w, h, svg };
  };

  /* ---- gradient swatch ---------------------------------------------------- */
  C.swatch = (x, y, { name }) => {
    const w = 96;
    const h = 44;
    const g = t.grad(name);
    const id = D.gradient(gradIdFor(name), g);
    let svg = "";
    if (g.repeating) {
      svg += pinstripe(x, y, w, h, g, 8);
    } else if (/gloss/.test(name)) {
      svg += rrect(x, y, w, h, 8, fillAttrs(t.color("--gs-gray-500"))) + rrect(x, y, w, h, 8, `fill="url(#${id})"`);
    } else {
      svg += rrect(x, y, w, h, 8, `fill="url(#${id})"`);
    }
    svg += outline(x, y, w, h, 8, border.color, border.width);
    return { w, h, svg };
  };

  return C;
}

/** a column with rounded bottom corners (open at the top when `open`, for a 3-sided outline) */
function neck(x, y, w, h, r, open = false) {
  const d = `M${fmt(x)} ${fmt(y)} V${fmt(y + h - r)} A${fmt(r)} ${fmt(r)} 0 0 0 ${fmt(x + r)} ${fmt(y + h)} H${fmt(x + w - r)} A${fmt(r)} ${fmt(r)} 0 0 0 ${fmt(x + w)} ${fmt(y + h - r)} V${fmt(y)}`;
  return open ? d : `${d} Z`;
}

/** the grouped-table pinstripe drawn as real stripes (Figma has no <pattern> support) */
function pinstripe(x, y, w, h, g, r = 0) {
  const period = px(g.period ?? "7px");
  const stops = g.stops;
  let svg = rrect(x, y, w, h, r, fillAttrs(stops[0].color));
  // segments after the base colour: pairs of equal-colour stops
  const segs = [];
  for (let i = 2; i + 1 < stops.length; i += 2) {
    segs.push({ from: stops[i].position * period, to: stops[i + 1].position * period, color: stops[i].color });
  }
  for (const s of segs) {
    for (let sx = x + s.from; sx < x + w; sx += period) {
      svg += rrect(sx, y, Math.min(s.to - s.from, x + w - sx), h, 0, fillAttrs(s.color));
    }
  }
  return svg;
}

/* ==========================================================================
   Sheet layout — 24 px grid, rows of labelled items
   ========================================================================== */

class Sheet {
  constructor(ctx, D, C) {
    this.ctx = ctx;
    this.D = D;
    this.C = C;
    this.y = MARGIN;
    this.body = "";
    this.ids = new Set();
    const t = ctx.t;
    this.ink = t.color("--gs-text");
    this.muted = t.color("--gs-text-secondary");
    this.rule = ctx.theme === "light" ? t.color("--gs-bar-border") : t.color("--gs-gray-600");
  }
  header(title, subtitle) {
    this.body += label(MARGIN, this.y + 22, title, { size: 24, color: this.ink });
    this.body += label(MARGIN, this.y + 22 + 22, subtitle, { size: 12, bold: false, color: this.muted });
    this.y += 3 * GRID;
  }
  section(title) {
    this.y += GRID;
    this.body += rrect(MARGIN, this.y, CONTENT, 1, 0, fillAttrs(this.rule));
    this.body += label(MARGIN, this.y + 22, title, { size: 14, color: this.ink });
    this.y += 2 * GRID;
  }
  /** items: { label, draw: (x, y) => { w, h, svg } } — wraps at the content width */
  row(items) {
    let x = MARGIN;
    let rowTop = this.y;
    let rowH = 0;
    const flush = () => {
      this.y = rowTop + GRID + Math.ceil(rowH / GRID) * GRID + GRID;
      rowTop = this.y;
      rowH = 0;
      x = MARGIN;
    };
    for (const it of items) {
      const probe = it.draw(0, 0);
      const slot = Math.ceil(Math.max(probe.w, textWidth(it.label, 12)) / GRID) * GRID;
      if (x > MARGIN && x + slot > MARGIN + CONTENT) flush();
      const el = it.draw(x, rowTop + GRID);
      const name = it.label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
      if (this.ids.has(name)) throw new Error(`duplicate element id ${name}`);
      this.ids.add(name);
      this.body += `<g id="${name}">`; // Figma names the imported layer after the id
      this.body += label(x, rowTop + 12, it.label, { size: 12, bold: false, color: this.muted });
      this.body += el.svg;
      this.body += `</g>\n`;
      rowH = Math.max(rowH, el.h);
      x += slot + GAP;
    }
    flush();
  }
  render(title, background) {
    const height = this.y + MARGIN;
    const bg = typeof background === "function" ? background(height) : rrect(0, 0, WIDTH, height, 0, fillAttrs(background));
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">\n` +
      `<title>${esc(title)}</title>\n` +
      `${this.D.render()}\n` +
      `<g id="page-background">${bg}</g>\n` +
      this.body +
      `</svg>\n`
    );
  }
}

function buildSheet(theme, version, date) {
  const ctx = loadContext(theme);
  const D = new Defs();
  const C = makeComponents(ctx, D);
  const S = new Sheet(ctx, D, C);
  const { t } = ctx;
  const Theme = theme === "light" ? "Light" : "Dark";

  S.header(`3GS UI — gel sticker sheet (${Theme})`, `Tokens v${version} · ${date} · generated by scripts/figma-sheet.mjs from packages/ui/src/tokens/*.css and the component CSS`);

  S.section("Buttons — 44 px gel push buttons, 30 px small (Button.css)");
  S.row([
    { label: "Button / default", draw: (x, y) => C.button(x, y, { text: "Sign Out" }) },
    { label: "Button / default / pressed", draw: (x, y) => C.button(x, y, { text: "Sign Out", pressed: true }) },
    { label: "Button / primary", draw: (x, y) => C.button(x, y, { variant: "primary", text: "Buy Now" }) },
    { label: "Button / primary / pressed", draw: (x, y) => C.button(x, y, { variant: "primary", text: "Buy Now", pressed: true }) },
    { label: "Button / destructive", draw: (x, y) => C.button(x, y, { variant: "destructive", text: "Delete" }) },
    { label: "Button / destructive / pressed", draw: (x, y) => C.button(x, y, { variant: "destructive", text: "Delete", pressed: true }) },
    { label: "Button / sm", draw: (x, y) => C.button(x, y, { size: "sm", text: "Edit" }) },
    { label: "Button / sm / primary", draw: (x, y) => C.button(x, y, { size: "sm", variant: "primary", text: "Install" }) },
  ]);

  S.section("Bars — NavigationBar 320×44 with back / title / Done, TabBar 320×49 (black in both themes)");
  S.row([
    { label: "NavigationBar", draw: (x, y) => C.navBar(x, y) },
    { label: "TabBar", draw: (x, y) => C.tabBar(x, y) },
    { label: "BarButton", draw: (x, y) => C.barButton(x, y, { text: "Edit" }) },
    { label: "BarButton / back", draw: (x, y) => C.backButton(x, y, { text: "Featured" }) },
    { label: "BarButton / done", draw: (x, y) => C.barButton(x, y, { text: "Done", done: true }) },
  ]);

  S.section("Switch 94×27, SegmentedControl, Badge, PageControl");
  S.row([
    { label: "Switch / on", draw: (x, y) => C.switch(x, y, { on: true }) },
    { label: "Switch / off", draw: (x, y) => C.switch(x, y, { on: false }) },
    { label: "SegmentedControl", draw: (x, y) => C.segmented(x, y) },
    { label: "Badge / red", draw: (x, y) => C.badge(x, y, { text: "43" }) },
    { label: "Badge / gray", draw: (x, y) => C.badge(x, y, { text: "12", gray: true }) },
    { label: "PageControl", draw: (x, y) => C.pageControl(x, y, {}) },
  ]);

  S.section("Wells — TextField, SearchField, Slider, ProgressBar (sunken --gs-inset surfaces)");
  S.row([
    { label: "TextField", draw: (x, y) => C.textField(x, y) },
    { label: "SearchField", draw: (x, y) => C.searchField(x, y) },
    { label: "Slider / 60 %", draw: (x, y) => C.slider(x, y, { pct: 0.6 }) },
    { label: "ProgressBar / 60 %", draw: (x, y) => C.progress(x, y, { pct: 0.6 }) },
  ]);

  S.section("Grouped list 300 px, Alert 284 px, HUD 140×140, Keyboard key 26×39 + popup");
  S.row([
    { label: "List / grouped", draw: (x, y) => C.groupedList(x, y) },
    { label: "Alert", draw: (x, y) => C.alert(x, y) },
    { label: "HUD", draw: (x, y) => C.hud(x, y) },
    { label: "Key", draw: (x, y) => C.key(x, y, { letter: "G" }) },
    { label: "Key / fn", draw: (x, y) => C.key(x, y, { letter: "123", fn: true }) },
    { label: "Key / popup", draw: (x, y) => C.keyPopup(x, y, { letter: "G" }) },
  ]);

  S.section("Gel gradients — every --gs-*gradient* / gloss token, fill = linearGradient (import as Figma styles)");
  const gradientTokens = [...t.tokens.values()].filter((tok) => tok.$type === "gradient" && tok.name.startsWith("--gs-") && !/^--gs-(switch|key|keyboard|pagecontrol|segment|slider)-/.test(tok.name));
  S.row(gradientTokens.map((tok) => ({ label: tok.name, draw: (x, y) => C.swatch(x, y, { name: tok.name }) })));

  const background = theme === "light"
    ? (h) => pinstripe(0, 0, WIDTH, h, t.grad("--gs-pinstripe-bg"))
    : t.color("--gs-screen-bg");
  return S.render(`3GS UI gel sticker sheet — ${Theme}`, background);
}

/* ==========================================================================
   main
   ========================================================================== */

function main() {
  const version = JSON.parse(fs.readFileSync(PATHS.pkg, "utf8")).version;
  const epoch = process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) * 1000 : Date.now();
  const date = new Date(epoch).toISOString().slice(0, 10);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const theme of ["dark", "light"]) {
    const svg = buildSheet(theme, version, date);
    const out = path.join(OUT_DIR, `3gs-gel-sheet-${theme}.svg`);
    fs.writeFileSync(out, svg);
    const height = svg.match(/height="(\d+)"/)[1];
    console.log(`${path.relative(ROOT, out)}: ${WIDTH}×${height}, ${(svg.length / 1024).toFixed(1)} kB, ${(svg.match(/<linearGradient/g) || []).length} gradients, ${(svg.match(/<filter /g) || []).length} filters`);
  }
}

main();
