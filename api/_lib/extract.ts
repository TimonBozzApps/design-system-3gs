/**
 * HTML → `Extracted`: the structural facts about a page that the mapper turns
 * into a ScreenSpec. Pure (no network); URL resolution happens here so every
 * href / image reference the mapper sees is absolute.
 */
import { parse, HTMLElement } from "node-html-parser";

export interface ExtractedLink {
  text: string;
  href: string;
  /** Points to a different site than the page. */
  external: boolean;
  /** Points at the site's own front page. */
  isHome: boolean;
}

export interface ExtractedHeading {
  level: 1 | 2;
  text: string;
}

/**
 * One piece of page content. Mirrors `SpecBlock` (spec.ts) except for images:
 * extraction is pure, so an image is still a URL here — the orchestrator turns
 * the chosen ones into data: URIs and the mapper swaps them in.
 */
export type ExtractedBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "stat"; value: string; label?: string; note?: string }
  | { kind: "qa"; question: string; answer: string }
  | { kind: "quote"; text: string; source?: string }
  | { kind: "image"; src: string; alt?: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string; external: boolean };

/** A heading with the content that follows it — the page's actual copy. */
export interface ExtractedSection {
  heading: string;
  /** The first text block, kept for clients that only read one line. */
  text?: string;
  /** Everything under this heading, in page order. */
  blocks: ExtractedBlock[];
  /** Internal link when the heading itself was a link. */
  href?: string;
}

export interface Extracted {
  /** Final URL (after redirects). */
  url: string;
  host: string;
  lang?: string;
  title?: string;
  siteName?: string;
  ogTitle?: string;
  description?: string;
  themeColor?: string;
  /** Best icon candidate (absolute URL or data: URI). */
  iconUrl?: string;
  /** All icon candidates, best first. */
  iconCandidates: string[];
  /** og:image / twitter:image, absolute. */
  imageUrl?: string;
  navLinks: ExtractedLink[];
  headings: ExtractedHeading[];
  sections: ExtractedSection[];
  /** Copy that appears before the first heading. */
  intro: ExtractedBlock[];
  /** How many sections the page really has (before the mapper's cap). */
  sectionsFound: number;
  /** Absolute URLs of the in-page images worth fetching, best first (≤ 3). */
  inlineImages: string[];
  ctas: ExtractedLink[];
  search?: { placeholder?: string; action?: string };
  footerLinks: ExtractedLink[];
  /** Visible text (script/style/noscript excluded) is tiny or the body is a bare SPA mount point. */
  clientRendered: boolean;
  /** Length of the visible text, for diagnostics. */
  textLength: number;
}

const MAX_NAV_LINKS = 12;
const MAX_HEADINGS = 8;
const MAX_CTAS = 4;
const MAX_FOOTER_LINKS = 6;
const CLIENT_RENDERED_TEXT_THRESHOLD = 200;
const TOP_OF_DOCUMENT_FRACTION = 0.3;

const CTA_RE =
  /\b(get started|getting started|sign ?up|start (?:for )?free|start free trial|free trial|try (?:it|now|free|for free)?|buy(?: now)?|pricing|download|install|book(?: a)? (?:demo|call|now)?|contact sales|log ?in|sign ?in|subscribe|donate|order(?: now)?|request (?:a )?demo|get (?:the )?app|join(?: now| free)?)\b/i;
const SKIP_LINK_RE = /^(skip|jump)( to|to)?\b|^(menu|close|open menu|toggle)$/i;
const SEARCH_RE = /search|suche|buscar|recherche|\bq\b/i;
const SEARCH_INPUT_TYPES = new Set(["search", "text", ""]);
const BLOCK_ANCESTORS = new Set(["ARTICLE", "MAIN", "ASIDE", "FOOTER"]);
const SPA_ROOT_RE = /^(root|app|__next|__nuxt|___gatsby|app-root|svelte|main|q-app)$/i;

/* ------------------------------------------------------------------ */

export function extract(html: string, finalUrl: string): Extracted {
  const page = new URL(finalUrl);
  // script / style / noscript content is dropped at parse time so it never leaks into text.
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: false, noscript: false, style: false, template: false, pre: true },
  });
  // Inline SVGs carry <title>/<desc> text that would pollute link labels.
  for (const svg of root.querySelectorAll("svg")) svg.remove();
  for (const hidden of root.querySelectorAll("[aria-hidden=true]")) hidden.remove();
  for (const hidden of root.querySelectorAll("[hidden]")) hidden.remove();

  const base = resolveBase(root, page);
  const meta = collectMeta(root);
  const head = root.querySelector("head") ?? root;
  const body = root.querySelector("body") ?? root;

  const title = clean(head.querySelector("title")?.text) || clean(root.querySelector("title")?.text) || undefined;
  const siteName = clean(meta.get("og:site_name")) || clean(meta.get("application-name")) || undefined;
  const ogTitle = clean(meta.get("og:title")) || clean(meta.get("twitter:title")) || undefined;
  const description = clean(meta.get("description")) || clean(meta.get("og:description")) || clean(meta.get("twitter:description")) || undefined;
  const themeColor = sanitizeColor(meta.get("theme-color"));
  const lang = clean(root.querySelector("html")?.getAttribute("lang"))?.toLowerCase() || undefined;

  const iconCandidates = collectIcons(root, base);
  const imageUrl = firstAbsolute(
    [meta.get("og:image:secure_url"), meta.get("og:image:url"), meta.get("og:image"), meta.get("twitter:image"), meta.get("twitter:image:src")],
    base,
  );

  const allAnchors = root.querySelectorAll("a[href]");
  const links = new LinkCollector(page, base);

  const navLinks = collectNavLinks(root, allAnchors, html.length, links);
  const headings = collectHeadings(root);
  const content = collectContent(root, body, links, base, { title: ogTitle ?? title, description });
  const ctas = collectCtas(root, links);
  const search = detectSearch(root, base);
  const footerLinks = collectFooterLinks(root, allAnchors, html.length, links, navLinks);

  const visibleText = clean(body.structuredText) ?? "";
  const clientRendered = visibleText.length < CLIENT_RENDERED_TEXT_THRESHOLD || isBareSpaMount(body);

  return {
    url: page.href,
    host: page.hostname,
    lang,
    title,
    siteName,
    ogTitle,
    description,
    themeColor,
    iconUrl: iconCandidates[0],
    iconCandidates,
    imageUrl,
    navLinks,
    headings,
    sections: content.sections,
    intro: content.intro,
    sectionsFound: content.sectionsFound,
    inlineImages: content.inlineImages,
    ctas,
    search,
    footerLinks,
    clientRendered,
    textLength: visibleText.length,
  };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Text content with a space between child elements so inline spans don't glue ("Set up" + "for free"). */
function spacedText(el: HTMLElement): string {
  return el.childNodes
    .map((n) => {
      if (n instanceof HTMLElement) {
        if (/^(SCRIPT|STYLE|NOSCRIPT|SVG|TEMPLATE)$/.test(n.tagName)) return "";
        return spacedText(n);
      }
      return n.text;
    })
    .join(" ");
}

function clean(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const t = text.replace(/[\s\u00a0\u200b]+/g, " ").trim();
  return t || undefined;
}

function resolveBase(root: HTMLElement, page: URL): URL {
  const href = root.querySelector("base[href]")?.getAttribute("href");
  if (href) {
    try {
      const b = new URL(href, page);
      if (b.protocol === "http:" || b.protocol === "https:") return b;
    } catch {
      /* ignore */
    }
  }
  return page;
}

/** meta name/property (lower-cased) → first non-empty content. */
function collectMeta(root: HTMLElement): Map<string, string> {
  const out = new Map<string, string>();
  for (const el of root.querySelectorAll("meta")) {
    const key = (el.getAttribute("property") ?? el.getAttribute("name") ?? el.getAttribute("itemprop") ?? "").trim().toLowerCase();
    const content = el.getAttribute("content");
    if (!key || !content || out.has(key)) continue;
    if (key === "theme-color" && /dark/i.test(el.getAttribute("media") ?? "")) continue; // prefer the light variant
    out.set(key, content);
  }
  return out;
}

function sanitizeColor(value: string | undefined): string | undefined {
  const v = clean(value);
  if (!v || v.length > 40) return undefined;
  return /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\))$/i.test(v) ? v : undefined;
}

function absolute(href: string | undefined, base: URL): URL | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(href.trim(), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u;
  } catch {
    return undefined;
  }
}

function firstAbsolute(candidates: (string | undefined)[], base: URL): string | undefined {
  for (const c of candidates) {
    const u = absolute(c, base);
    if (u) return u.href;
  }
  return undefined;
}

/** Icon candidates, best first: largest apple-touch-icon → largest icon → /favicon.ico. */
function collectIcons(root: HTMLElement, base: URL): string[] {
  const touch: { href: string; size: number }[] = [];
  const icons: { href: string; size: number }[] = [];
  for (const el of root.querySelectorAll("link[rel][href]")) {
    const rel = (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/);
    const rawHref = el.getAttribute("href")?.trim();
    if (!rawHref) continue;
    const href = rawHref.startsWith("data:image/") ? rawHref : absolute(rawHref, base)?.href;
    if (!href) continue;
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    const isSvg = type.includes("svg") || /\.svg(\?|$)/i.test(href);
    const size = parseSizes(el.getAttribute("sizes"), isSvg);
    if (rel.includes("apple-touch-icon") || rel.includes("apple-touch-icon-precomposed")) {
      touch.push({ href, size: size || 180 });
    } else if (rel.includes("icon")) {
      icons.push({ href, size: size || (isSvg ? 128 : 32) });
    }
  }
  const bySize = (a: { size: number }, b: { size: number }) => b.size - a.size;
  touch.sort(bySize);
  icons.sort(bySize);
  const ordered = [...touch, ...icons].map((i) => i.href);
  ordered.push(new URL("/favicon.ico", base).href);
  return [...new Set(ordered)].slice(0, 4);
}

function parseSizes(sizes: string | undefined, isSvg: boolean): number {
  if (!sizes) return 0;
  if (/any/i.test(sizes)) return isSvg ? 256 : 0;
  let best = 0;
  for (const m of sizes.matchAll(/(\d+)x(\d+)/gi)) best = Math.max(best, Number(m[1]));
  return best;
}

/**
 * Visible label of an anchor/button. Mega-menu links often wrap a title AND a
 * description ("Issues" + "Plan and track work"), which `structuredText` joins
 * into "IssuesPlan and track…"; prefer the first short text line, then fall back
 * to aria-label / title / an inner image's alt.
 */
function labelOf(el: HTMLElement): string | undefined {
  const chunk = firstTextChunk(el);
  const structured = el.structuredText ?? "";
  const firstLine = structured
    .split(/\n+/)
    .map((l) => clean(l))
    .find((l): l is string => Boolean(l));
  const text = chunk && chunk.length >= 2 ? chunk : firstLine;
  const aria = clean(el.getAttribute("aria-label"));
  // a short aria-label beats a long concatenated text
  if (aria && (!text || text.length > 28) && aria.length <= 28) return aria;
  return text ?? aria ?? clean(el.getAttribute("title")) ?? clean(el.querySelector("img[alt]")?.getAttribute("alt"));
}

/**
 * The first "unit" of text inside an element: descend through wrappers that
 * hold a single text-bearing child, then take the first child with text. For
 * `<a><span><span>Issues</span><span>Plan and track…</span></span></a>` that is
 * "Issues".
 */
function firstTextChunk(node: HTMLElement): string | undefined {
  const kids = node.childNodes.filter((n) => Boolean(clean(n.text)));
  if (kids.length === 0) return undefined;
  const first = kids[0];
  if (kids.length === 1 && first instanceof HTMLElement) return firstTextChunk(first);
  return clean(first.text);
}

function hasAncestor(el: HTMLElement, tags: Set<string>): boolean {
  let p = el.parentNode;
  while (p) {
    if (tags.has(p.tagName ?? "")) return true;
    p = p.parentNode;
  }
  return false;
}

/** Same site: identical host, or www-variants, or a subdomain of the page's apex. */
function isInternal(link: URL, page: URL): boolean {
  const strip = (h: string) => h.replace(/^www\./, "");
  const a = strip(link.hostname);
  const b = strip(page.hostname);
  if (a === b) return true;
  const apex = b.split(".").slice(-2).join(".");
  return a.endsWith(`.${apex}`) || b.endsWith(`.${a}`);
}

/** Builds de-duplicated link lists with shared normalisation rules. */
class LinkCollector {
  page: URL;
  base: URL;
  constructor(page: URL, base: URL) {
    this.page = page;
    this.base = base;
  }

  toLink(el: HTMLElement, opts: { minText: number; maxText: number }): ExtractedLink | undefined {
    const rawHref = el.getAttribute("href")?.trim() ?? "";
    if (!rawHref || rawHref.startsWith("#") || /^(javascript|mailto|tel|sms|data|blob):/i.test(rawHref)) return undefined;
    const url = absolute(rawHref, this.base);
    if (!url) return undefined;
    const text = labelOf(el);
    if (!text || text.length < opts.minText || text.length > opts.maxText) return undefined;
    if (SKIP_LINK_RE.test(text)) return undefined;
    url.hash = "";
    const isHome = (url.pathname === "/" || url.pathname === "") && !url.search && isInternal(url, this.page);
    return { text, href: url.href, external: !isInternal(url, this.page), isHome };
  }

  dedupe(links: ExtractedLink[], max: number, exclude?: Set<string>): ExtractedLink[] {
    const seenHref = new Set<string>(exclude ?? []);
    const seenText = new Set<string>();
    const out: ExtractedLink[] = [];
    for (const l of links) {
      const hrefKey = l.href.replace(/\/$/, "").toLowerCase();
      const textKey = l.text.toLowerCase();
      if (seenHref.has(hrefKey) || seenText.has(textKey)) continue;
      seenHref.add(hrefKey);
      seenText.add(textKey);
      out.push(l);
      if (out.length >= max) break;
    }
    return out;
  }
}

function inDocumentOrder(els: Iterable<HTMLElement>): HTMLElement[] {
  return [...new Set(els)].sort((a, b) => a.range[0] - b.range[0]);
}

function collectNavLinks(root: HTMLElement, allAnchors: HTMLElement[], htmlLength: number, links: LinkCollector): ExtractedLink[] {
  const FOOTER = new Set(["FOOTER"]);
  const toLinks = (els: HTMLElement[]) =>
    inDocumentOrder(els)
      .filter((a) => !hasAncestor(a, FOOTER)) // a <nav> inside the footer is not site navigation
      .map((a) => links.toLink(a, { minText: 2, maxText: 28 }))
      .filter((l): l is ExtractedLink => Boolean(l));

  const anchors: HTMLElement[] = [];
  for (const c of root.querySelectorAll("nav, [role=navigation], header")) {
    if (c.tagName === "HEADER" && hasAncestor(c, BLOCK_ANCESTORS)) continue; // article headers are not site nav
    anchors.push(...c.querySelectorAll("a[href]"));
  }
  let found = links.dedupe(toLinks(anchors), MAX_NAV_LINKS);
  if (found.length < 2) {
    // Fallback: any anchor in the top 30 % of the source.
    const cutoff = htmlLength * TOP_OF_DOCUMENT_FRACTION;
    const top = allAnchors.filter((a) => a.range[0] < cutoff);
    found = links.dedupe([...found, ...toLinks(top)], MAX_NAV_LINKS);
  }
  return found;
}

function collectHeadings(root: HTMLElement): ExtractedHeading[] {
  const out: ExtractedHeading[] = [];
  const seen = new Set<string>();
  for (const h of inDocumentOrder(root.querySelectorAll("h1, h2"))) {
    const text = clean(h.structuredText);
    if (!text || text.length < 2 || text.length > 120) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ level: h.tagName === "H1" ? 1 : 2, text });
    if (out.length >= MAX_HEADINGS) break;
  }
  return out;
}

function collectCtas(root: HTMLElement, links: LinkCollector): ExtractedLink[] {
  const out: ExtractedLink[] = [];
  const seen = new Set<string>();
  for (const el of inDocumentOrder(root.querySelectorAll("a[href], button, input[type=submit], [role=button]"))) {
    const text = el.tagName === "INPUT" ? clean(el.getAttribute("value")) : labelOf(el);
    if (!text || text.length < 2 || text.length > 32 || !CTA_RE.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    const link = el.tagName === "A" ? links.toLink(el, { minText: 2, maxText: 32 }) : undefined;
    if (el.tagName === "A" && !link) continue;
    seen.add(key);
    out.push(link ?? { text, href: "", external: false, isHome: false });
    if (out.length >= MAX_CTAS) break;
  }
  return out;
}

function detectSearch(root: HTMLElement, base: URL): Extracted["search"] | undefined {
  const inputs = root.querySelectorAll("input");
  let match: HTMLElement | undefined;
  for (const input of inputs) {
    const type = (input.getAttribute("type") ?? "").toLowerCase();
    if (type === "search") {
      match = input;
      break;
    }
  }
  if (!match) {
    for (const input of inputs) {
      const type = (input.getAttribute("type") ?? "").toLowerCase();
      if (!SEARCH_INPUT_TYPES.has(type)) continue;
      const hay = [input.getAttribute("name"), input.getAttribute("placeholder"), input.getAttribute("aria-label"), input.getAttribute("id")]
        .filter(Boolean)
        .join(" ");
      if (SEARCH_RE.test(hay) || hasAncestor(input, new Set(["FORM"])) && input.closest("form[role=search]")) {
        match = input;
        break;
      }
    }
  }
  if (!match) {
    const form = root.querySelector("form[role=search]");
    if (!form) return undefined;
    match = form.querySelector("input") ?? form;
  }
  const form = match.closest("form");
  const action = form ? absolute(form.getAttribute("action") ?? "", base)?.href : undefined;
  const placeholder = clean(match.getAttribute("placeholder")) ?? clean(match.getAttribute("aria-label"));
  return { placeholder: placeholder && placeholder.length <= 40 ? placeholder : undefined, action };
}

function collectFooterLinks(
  root: HTMLElement,
  allAnchors: HTMLElement[],
  htmlLength: number,
  links: LinkCollector,
  navLinks: ExtractedLink[],
): ExtractedLink[] {
  const exclude = new Set(navLinks.map((l) => l.href.replace(/\/$/, "").toLowerCase()));
  const containers = root.querySelectorAll("footer, [role=contentinfo]");
  let anchors: HTMLElement[] = [];
  for (const c of containers) anchors.push(...c.querySelectorAll("a[href]"));
  if (!anchors.length) {
    const cutoff = htmlLength * (1 - 0.15);
    anchors = allAnchors.filter((a) => a.range[0] > cutoff);
  }
  const found = inDocumentOrder(anchors)
    .map((a) => links.toLink(a, { minText: 2, maxText: 28 }))
    .filter((l): l is ExtractedLink => Boolean(l && !l.isHome));
  return links.dedupe(found, MAX_FOOTER_LINKS, exclude);
}

/** `<body>` whose only meaningful child is an empty SPA mount node. */
function isBareSpaMount(body: HTMLElement): boolean {
  const significant = body.childNodes.filter((n) => {
    if (n.nodeType !== 1) return n.nodeType === 3 && Boolean(clean(n.rawText));
    const tag = (n as HTMLElement).tagName;
    return !["SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "TEMPLATE"].includes(tag);
  });
  if (significant.length !== 1 || significant[0].nodeType !== 1) return false;
  const el = significant[0] as HTMLElement;
  if (el.tagName !== "DIV" || !SPA_ROOT_RE.test(el.getAttribute("id") ?? "")) return false;
  return (clean(el.structuredText)?.length ?? 0) < CLIENT_RENDERED_TEXT_THRESHOLD;
}

/* ------------------------------------------------------------------ */
/* content: sections, blocks, in-page images                           */
/* ------------------------------------------------------------------ */

const MAX_CONTENT_SECTIONS = 24;
const MAX_BLOCKS_PER_SECTION = 8;
const MAX_INTRO_BLOCKS = 4;
const TEXT_MIN = 40;
const TEXT_MAX = 400;
const MAX_TEXT_BLOCKS = 4;
const LIST_ITEM_MIN = 2;
const LIST_ITEM_MAX = 90;
const MAX_LIST_ITEMS = 8;
const MAX_LISTS = 2;
const MAX_QA = 4;
const MAX_QUOTES = 2;
const MAX_STATS = 4;
const MAX_CODE = 1;
const MAX_SECTION_LINKS = 2;
const CODE_MAX = 200;
const MAX_INLINE_IMAGES = 3;
const MIN_IMAGE_PX = 32;
const MAIN_ROOT_MIN_TEXT = 400;

/** Whole subtrees that never hold readable copy. */
const DROP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "IFRAME", "CANVAS", "FORM", "SELECT", "TEXTAREA",
  "BUTTON", "VIDEO", "AUDIO", "OBJECT", "EMBED", "DIALOG", "INPUT", "LABEL", "TABLE", "HR", "MENU",
]);
/** Page chrome: never content, wherever it sits. */
const CHROME_TAGS = new Set(["NAV", "ASIDE"]);
/** Elements that are taken whole (never descended into). */
const LEAF_BLOCK_TAGS = new Set(["P", "UL", "OL", "DL", "BLOCKQUOTE", "PRE", "FIGURE", "DETAILS", "IMG", "PICTURE", "H4", "H5", "H6"]);
/** Tags that make an element a container rather than a text leaf. */
const BLOCK_TAGS = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "UL", "OL", "DL", "LI", "DT", "DD", "H1", "H2", "H3", "H4", "H5", "H6",
  "TABLE", "FIGURE", "FIGCAPTION", "PRE", "BLOCKQUOTE", "DETAILS", "IMG", "PICTURE", "MAIN", "HEADER",
  "FOOTER", "ASIDE", "NAV", "FORM", "VIDEO", "IFRAME", "CANVAS", "HR",
]);

const JUNK_ID_RE = /cookie|consent|gdpr|banner|newsletter|subscribe-modal/i;
/** Wrappers whose text is never page copy: a11y-only labels, wiki chrome, share bars. */
const JUNK_CLASS_RE =
  /sr-only|visually-?hidden|screen-?reader|hatnote|noprint|mw-editsection|mw-jump|breadcrumb|skip-link|social-share|share-button|related-(posts|articles)|advert|\bpromo-bar\b/i;
const JUNK_ROLE_RE = /^(navigation|banner|contentinfo|dialog|alertdialog|search|menu|menubar|tablist|toolbar|complementary|alert|status)$/;
const SKIP_TEXT_RE =
  /^(skip to\b.{0,30}|jump to\b.{0,30}|menu|close|open menu|toggle\b.{0,20}|accept( all)?( cookies)?|reject( all)?|cookie settings|manage cookies|loading\.{0,3}|advertisement|share this|back to top|previous|next|(copyright\s*)?©.*|all rights reserved.*)$/i;
const READ_MORE_RE =
  /^(read|learn|find out|see|view|discover|explore|browse|get)\b[^.!?]{0,30}$|^(more|mehr|weiterlesen|docs|documentation|details)\s*[→›»]?$/i;
/** Lines that look like copy but are cross-reference chrome. */
const JUNK_COPY_RE =
  /^(main articles?|main page|see also|further information|for other uses|not to be confused|from wikipedia)\b|redirects here|^\s*\(?(pictured|source|photo|image)\b/i;
const IMAGE_JUNK_RE = /(sprite|spacer|pixel|tracking|blank|1x1|logos?[-_./]|icons?[-_./]|avatar|badge|placeholder|emoji|favicon|shield)/i;

interface Segment {
  heading?: HTMLElement;
  nodes: HTMLElement[];
}

interface ImageCandidate {
  src: string;
  alt?: string;
  score: number;
}

interface ContentResult {
  sections: ExtractedSection[];
  intro: ExtractedBlock[];
  sectionsFound: number;
  inlineImages: string[];
}

/** Normalised key used for de-duplication and "is this just the heading again?" checks. */
function normKey(text: string): string {
  return text.toLowerCase().replace(/[\s ]+/g, " ").replace(/^[^\p{L}\p{N}$€£¥]+|[^\p{L}\p{N}%+]+$/gu, "").trim();
}

function signature(b: ExtractedBlock): string {
  switch (b.kind) {
    case "text": return `t:${normKey(b.text)}`;
    case "list": return `l:${b.items.map(normKey).join("|")}`;
    case "stat": return `s:${normKey(b.value)}~${normKey(b.label ?? "")}`;
    case "qa": return `q:${normKey(b.question)}`;
    case "quote": return `Q:${normKey(b.text)}`;
    case "image": return `i:${b.src}`;
    case "code": return `c:${normKey(b.text)}`;
    case "link": return `a:${b.href}`;
  }
}

function childElements(el: HTMLElement): HTMLElement[] {
  return el.childNodes.filter((n): n is HTMLElement => n instanceof HTMLElement);
}

/** Strip footnote / edit markers that read as noise on a phone ("[ 18 ]", "[ citation needed ]"). */
function tidyCopy(text: string): string {
  return clean(text.replace(/\[\s*(?:\d{1,3}|[a-z]|note \d+|citation needed|edit|\.{3}|…)\s*\]/gi, " ")) ?? text;
}

function truncateWords(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** `pre` is parsed as raw text (so code keeps its shape); strip the markup that comes with it. */
function decodeRaw(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#0?39|apos|#x27);/gi, (_m, e: string) => {
      const k = e.toLowerCase();
      return k === "amp" ? "&" : k === "lt" ? "<" : k === "gt" ? ">" : k === "quot" ? '"' : k === "nbsp" ? " " : "'";
    });
}

function hasBlockDescendant(el: HTMLElement): boolean {
  for (const child of childElements(el)) {
    if (BLOCK_TAGS.has(child.tagName)) return true;
    if (hasBlockDescendant(child)) return true;
  }
  return false;
}

/** Fraction of an element's text that sits inside links — high means navigation. */
function linkDensity(el: HTMLElement): number {
  const total = clean(el.structuredText)?.length ?? 0;
  if (!total) return 0;
  let inLinks = 0;
  for (const a of el.querySelectorAll("a[href]")) inLinks += clean(a.structuredText)?.length ?? 0;
  return inLinks / total;
}

/** A `header`/`footer` that is site chrome (link soup) rather than an article's own header. */
function isChromeBlock(el: HTMLElement): boolean {
  const links = el.querySelectorAll("a[href]");
  if (links.length >= 4) return true;
  return linkDensity(el) > 0.6;
}

function isSkippable(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (!tag || DROP_TAGS.has(tag) || CHROME_TAGS.has(tag)) return true;
  if (el.getAttribute("aria-hidden") === "true" || el.getAttribute("hidden") !== undefined) return true;
  const role = (el.getAttribute("role") ?? "").trim().toLowerCase();
  if (role && JUNK_ROLE_RE.test(role)) return true;
  const idClass = `${el.getAttribute("id") ?? ""} ${el.getAttribute("class") ?? ""}`;
  if (idClass.length < 240 && (JUNK_ID_RE.test(idClass) || JUNK_CLASS_RE.test(idClass))) return true;
  if (tag === "HEADER" || tag === "FOOTER") return isChromeBlock(el);
  return false;
}

/** `main` → `[role=main]` → the longest `article` → `body`, with a text-length sanity check. */
function contentRoot(root: HTMLElement, body: HTMLElement): HTMLElement {
  const bodyText = clean(body.structuredText)?.length ?? 0;
  const candidates = [root.querySelector("main"), root.querySelector("[role=main]"), ...root.querySelectorAll("article").slice(0, 4)];
  let best: HTMLElement | undefined;
  let bestLen = 0;
  for (const c of candidates) {
    if (!c) continue;
    const len = clean(c.structuredText)?.length ?? 0;
    if (len > bestLen) {
      best = c;
      bestLen = len;
    }
  }
  // A `main` that holds almost nothing (shell layouts) is worse than the whole body.
  if (best && (bestLen >= MAIN_ROOT_MIN_TEXT || bestLen >= bodyText * 0.5)) return best;
  return body;
}

/** Split the content root into a pre-heading run plus one segment per h1–h3, in document order. */
function segmentContent(scope: HTMLElement): Segment[] {
  const segments: Segment[] = [{ nodes: [] }];
  const visit = (el: HTMLElement): void => {
    if (isSkippable(el)) return;
    const tag = el.tagName;
    if (tag === "H1" || tag === "H2" || tag === "H3") {
      if (segments.length <= MAX_CONTENT_SECTIONS + 8) segments.push({ heading: el, nodes: [] });
      return;
    }
    const current = segments[segments.length - 1];
    if (LEAF_BLOCK_TAGS.has(tag)) {
      current.nodes.push(el);
      return;
    }
    if (!hasBlockDescendant(el)) {
      if (clean(spacedText(el))) current.nodes.push(el);
      return;
    }
    for (const child of childElements(el)) visit(child);
  };
  for (const child of childElements(scope)) visit(child);
  return segments;
}

/* --- stats -------------------------------------------------------- */

const MONEY_RE = /^(?:[$€£¥₹]\s?\d[\d.,]*|\d[\d.,]*\s?[$€£¥₹])(?:\s?(?:\/|per\s)\s?[\w-]{1,12})?$/i;
const MAGNITUDE_RE = /^\d[\d.,]*\s?(?:(?:%|k|m|b|bn|tn|x|mio\.?|million|billion|milliarden|tausend)\+?|\+)$/i;
const FREE_RE = /^(free|kostenlos|gratis|free forever|always free|no cost|\$0)$/i;
const FROM_RE = /^(?:from|starting at|starts at|ab|nur|only|as low as)\s+/i;
const STAT_NOTE_RE = /^(per|pro|\/|billed|incl\b|excl\b|plus|each|from|starting|monthly|annually|a (month|year|user|seat)|\+ ?tax)/i;

/** The text of a stand-alone number: a price, a metric, "Free". */
function asStat(text: string): string | undefined {
  const t = text.trim().replace(/[.:]+$/, "");
  if (!t || t.length > 40) return undefined;
  if (FREE_RE.test(t)) return /^\$0$/.test(t) ? "$0" : "Free";
  if (FROM_RE.test(t)) return MONEY_RE.test(t.replace(FROM_RE, "")) ? t : undefined;
  if (MONEY_RE.test(t)) return t;
  if (MAGNITUDE_RE.test(t)) return t;
  return undefined;
}

/** A bare number ("4.9", "1,200") only counts as a stat when a label explains it. */
function asPlainNumber(text: string): string | undefined {
  const t = text.trim();
  return t.length <= 9 && /^\d[\d.,]*$/.test(t) ? t : undefined;
}

/** Anything that reads as a figure itself — it belongs to the next stat, not to this one's label. */
function looksNumeric(text: string): boolean {
  return /[$€£¥₹]|^\d|\d+(?:[.,]\d+)?\s?(?:%|k|m|bn|tn|b|x)\b/i.test(text);
}

function isStatLabel(text: string): boolean {
  if (text.length < 3 || text.length > 48 || /[.!?]$/.test(text)) return false;
  return !asStat(text) && !asPlainNumber(text) && !looksNumeric(text) && !READ_MORE_RE.test(text);
}

/* --- images ------------------------------------------------------- */

function firstSrcset(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const first = value.split(",")[0]?.trim().split(/\s+/)[0];
  return first || undefined;
}

function imageAttr(el: HTMLElement, name: string): number {
  const raw = el.getAttribute(name);
  const n = raw ? Number.parseInt(raw.replace(/[^\d]/g, ""), 10) : Number.NaN;
  return Number.isFinite(n) ? n : 0;
}

/** An in-page image worth fetching: absolute, big enough, not a logo / tracking pixel. */
function imageCandidate(el: HTMLElement, base: URL, alt: string | undefined, inSection: boolean): ImageCandidate | undefined {
  const img = el.tagName === "PICTURE" ? el.querySelector("img") ?? el : el;
  const raw =
    img.getAttribute("src") ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-lazy-src") ||
    firstSrcset(img.getAttribute("srcset") ?? img.getAttribute("data-srcset")) ||
    (el.tagName === "PICTURE" ? firstSrcset(el.querySelector("source")?.getAttribute("srcset")) : undefined);
  if (!raw || raw.startsWith("data:")) return undefined;
  const url = absolute(raw, base);
  if (!url) return undefined;
  const width = imageAttr(img, "width");
  const height = imageAttr(img, "height");
  if ((width && width < MIN_IMAGE_PX) || (height && height < MIN_IMAGE_PX)) return undefined;
  const altText = clean(alt ?? img.getAttribute("alt"));
  const haystack = `${url.pathname} ${altText ?? ""}`;
  if (IMAGE_JUNK_RE.test(haystack)) return undefined;
  let score = inSection ? 3 : 0;
  if (altText && altText.length >= 4) score += 2;
  if (width * height >= 120_000) score += 2;
  else if (width * height >= 40_000) score += 1;
  if (/\.svg(\?|$)/i.test(url.pathname)) score -= 2;
  return { src: url.href, alt: altText, score };
}

/* --- block building ------------------------------------------------ */

interface BuildCtx {
  links: LinkCollector;
  base: URL;
  seen: Set<string>;
  images: ImageCandidate[];
  inSection: boolean;
  headingKey?: string;
}

/** Turn one segment's nodes into typed blocks, in page order, within the per-kind caps. */
function buildBlocks(seg: Segment, ctx: BuildCtx): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  const counts = { text: 0, list: 0, stat: 0, qa: 0, quote: 0, code: 0, link: 0, image: 0 };
  const shorts: string[] = [];
  const consumed = new Set<number>();
  const full = seg.nodes;

  const push = (b: ExtractedBlock): boolean => {
    if (blocks.length >= MAX_BLOCKS_PER_SECTION) return false;
    const key = signature(b);
    if (ctx.seen.has(key)) return false;
    if (ctx.headingKey && (key === `t:${ctx.headingKey}` || key === `q:${ctx.headingKey}`)) return false;
    ctx.seen.add(key);
    blocks.push(b);
    counts[b.kind]++;
    return true;
  };

  const pushImage = (el: HTMLElement, alt?: string): void => {
    if (counts.image >= 1) return; // one per section: the page cap is spent across sections
    const cand = imageCandidate(el, ctx.base, alt, ctx.inSection);
    if (!cand) return;
    if (push({ kind: "image", src: cand.src, alt: cand.alt })) ctx.images.push(cand);
  };

  const pushQuote = (el: HTMLElement, source?: string): void => {
    if (counts.quote >= MAX_QUOTES) return;
    const text = clean(spacedText(el));
    if (!text || text.length < 20) return;
    const cite =
      source ??
      clean(el.querySelector("cite")?.structuredText) ??
      clean(el.querySelector("footer")?.structuredText) ??
      clean(el.getAttribute("cite"));
    const quote: ExtractedBlock = { kind: "quote", text: truncateWords(text, TEXT_MAX) };
    if (cite && cite.length <= 80) quote.source = cite;
    push(quote);
  };

  const pushCode = (el: HTMLElement): void => {
    if (counts.code >= MAX_CODE) return;
    const raw = el.tagName === "PRE" ? decodeRaw(el.rawText || el.text) : spacedText(el);
    const text = clean(raw);
    if (!text || text.length < 3) return;
    push({ kind: "code", text: truncateWords(text, CODE_MAX) });
  };

  const pushList = (el: HTMLElement): void => {
    if (counts.list >= MAX_LISTS) return;
    const items: string[] = [];
    let linkOnly = 0;
    for (const li of childElements(el)) {
      if (li.tagName !== "LI" || isSkippable(li)) continue;
      const text = liText(li);
      if (!text || text.length < LIST_ITEM_MIN || SKIP_TEXT_RE.test(text)) continue;
      const anchor = clean(li.querySelector("a[href]")?.structuredText);
      if (anchor && normKey(anchor) === normKey(text)) linkOnly++;
      items.push(truncateWords(text, LIST_ITEM_MAX));
      if (items.length >= MAX_LIST_ITEMS) break;
    }
    if (items.length < 2) return;
    // A list whose items are nothing but links is navigation — unless it is all this section has.
    if (linkOnly >= items.length * 0.8 && blocks.length > 0) return;
    push({ kind: "list", items });
  };

  const pushQa = (question: string, answer: string): void => {
    if (counts.qa >= MAX_QA) return;
    const q = truncateWords(question, 120);
    const a = truncateWords(answer, TEXT_MAX);
    if (q.length < 3 || a.length < 3) return;
    push({ kind: "qa", question: q, answer: a });
  };

  const pushDl = (el: HTMLElement): void => {
    const kids = childElements(el);
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].tagName !== "DT") continue;
      const term = clean(spacedText(kids[i]));
      const values: string[] = [];
      for (let j = i + 1; j < kids.length && kids[j].tagName === "DD"; j++) {
        const v = clean(spacedText(kids[j]));
        if (v) values.push(v);
      }
      const value = values.join(" ");
      if (!term || !value) continue;
      const stat = asStat(value) ?? (asPlainNumber(value) && isStatLabel(term) ? value : undefined);
      if (stat && counts.stat < MAX_STATS && term.length <= 48) push({ kind: "stat", value: stat, label: term });
      else pushQa(term, value);
      if (blocks.length >= MAX_BLOCKS_PER_SECTION) return;
    }
  };

  const pushText = (raw: string, node?: HTMLElement): void => {
    if (counts.text >= MAX_TEXT_BLOCKS) return;
    const text = tidyCopy(raw);
    if (JUNK_COPY_RE.test(text)) return;
    let body = text;
    let trailing: ExtractedBlock | undefined;
    if (node) {
      // "… Read more" belongs in a link block, not in the copy.
      for (const a of node.querySelectorAll("a[href]")) {
        const label = clean(a.structuredText);
        if (!label || label.length > 40 || !READ_MORE_RE.test(label)) continue;
        if (!body.endsWith(label)) continue;
        const link = ctx.links.toLink(a, { minText: 2, maxText: 40 });
        body = clean(body.slice(0, body.length - label.length)) ?? body;
        if (link && counts.link < MAX_SECTION_LINKS) trailing = { kind: "link", text: link.text, href: link.href, external: link.external };
        break;
      }
    }
    if (body.length >= TEXT_MIN) push({ kind: "text", text: truncateWords(body, TEXT_MAX) });
    else if (body.length >= 2) shorts.push(body);
    if (trailing) push(trailing);
  };

  /** "$20" / "99.9%" / "500M+" plus the short line next to it that says what it measures. */
  const tryStat = (text: string, i: number): boolean => {
    if (counts.stat >= MAX_STATS) return false;
    const stat = asStat(text);
    const plain = stat ? undefined : asPlainNumber(text);
    if (!stat && !plain) return false;
    let label: string | undefined;
    let note: string | undefined;
    for (let j = i + 1; j < Math.min(full.length, i + 3); j++) {
      if (consumed.has(j)) continue;
      const t = clean(spacedText(full[j]));
      if (!t) continue;
      if (!label && isStatLabel(t)) {
        label = t;
        consumed.add(j);
        continue;
      }
      // A note is only a qualifier ("per month", "billed annually") — never the next figure's label.
      if (label && !note && t.length <= 30 && STAT_NOTE_RE.test(t)) {
        note = t;
        consumed.add(j);
      }
      break;
    }
    if (!label && shorts.length && isStatLabel(shorts[shorts.length - 1])) label = shorts[shorts.length - 1];
    if (!stat && !label) return false; // a bare number nobody explains is not a stat
    const block: ExtractedBlock = { kind: "stat", value: stat ?? plain ?? text };
    if (label) block.label = label;
    if (note) block.note = note;
    return push(block);
  };

  for (let i = 0; i < full.length; i++) {
    if (blocks.length >= MAX_BLOCKS_PER_SECTION) break;
    if (consumed.has(i)) continue;
    const el = full[i];
    const tag = el.tagName;

    if (tag === "IMG" || tag === "PICTURE") {
      pushImage(el);
      continue;
    }
    if (tag === "FIGURE") {
      const caption = clean(el.querySelector("figcaption")?.structuredText);
      const bq = el.querySelector("blockquote");
      if (bq) pushQuote(bq, caption);
      else {
        const img = el.querySelector("img") ?? el.querySelector("picture");
        if (img) pushImage(img, caption);
        else {
          const pre = el.querySelector("pre");
          if (pre) pushCode(pre);
        }
      }
      continue;
    }
    if (tag === "PRE") {
      pushCode(el);
      continue;
    }
    if (tag === "BLOCKQUOTE") {
      pushQuote(el);
      continue;
    }
    if (tag === "DL") {
      pushDl(el);
      continue;
    }
    if (tag === "DETAILS") {
      const question = clean(el.querySelector("summary")?.structuredText);
      const whole = clean(spacedText(el)) ?? "";
      const answer = question && whole.startsWith(question) ? clean(whole.slice(question.length)) : whole;
      if (question && answer) pushQa(question, answer);
      continue;
    }
    if (tag === "UL" || tag === "OL") {
      pushList(el);
      continue;
    }

    const text = clean(spacedText(el));
    if (!text || SKIP_TEXT_RE.test(text)) continue;

    if (tag === "H4" || tag === "H5" || tag === "H6") {
      if (tryStat(text, i)) continue; // big-number headings are stats, not sub-headings
      const next = full[i + 1];
      const nextText = next && !consumed.has(i + 1) ? clean(spacedText(next)) : undefined;
      // "How much does it cost?" followed by a paragraph is an FAQ entry.
      if (/[?？]$/.test(text) && nextText && nextText.length >= 20) {
        pushQa(text, nextText);
        consumed.add(i + 1);
      } else if (text.length >= 3 && text.length <= 120) {
        push({ kind: "text", text });
      }
      continue;
    }

    // A paragraph-area link that stands on its own ("Read the docs →").
    if (tag === "A") {
      if (counts.link < MAX_SECTION_LINKS && text.length >= 2 && text.length <= 60) {
        const link = ctx.links.toLink(el, { minText: 2, maxText: 60 });
        if (link) push({ kind: "link", text: link.text, href: link.href, external: link.external });
      }
      continue;
    }

    // Link soup that slipped through as a "leaf" is navigation, not copy.
    if (el.querySelectorAll("a[href]").length >= 2 && linkDensity(el) > 0.6) continue;

    if (tryStat(text, i)) continue;
    pushText(text, el);
  }

  // Nothing substantial? A couple of short fragments still beat an empty screen.
  if (!blocks.length && shorts.length) {
    const joined = shorts.join(" — ");
    if (joined.length >= 12) push({ kind: "text", text: truncateWords(joined, TEXT_MAX) });
  }
  return blocks;
}

/** The text of an `li` up to its nested list (sub-items become their own noise otherwise). */
function liText(li: HTMLElement): string | undefined {
  const parts: string[] = [];
  for (const n of li.childNodes) {
    if (n instanceof HTMLElement) {
      if (n.tagName === "UL" || n.tagName === "OL") break;
      if (DROP_TAGS.has(n.tagName)) continue;
      parts.push(spacedText(n));
    } else {
      parts.push(n.text);
    }
  }
  return clean(parts.join(" "));
}

/**
 * Pages built out of repeated link rows (link aggregators, index pages) have no
 * prose at all. Their substance is the list of titles — collect the densest one.
 */
function fallbackList(scope: HTMLElement): ExtractedBlock | undefined {
  let best: string[] = [];
  const containers = scope.querySelectorAll("ul, ol, tbody, table, section, div");
  for (const container of containers.slice(0, 400)) {
    const kids = childElements(container);
    if (kids.length < 4 || kids.length > 150) continue;
    const items: string[] = [];
    for (const kid of kids) {
      if (isSkippable(kid)) continue;
      let text: string | undefined;
      for (const a of kid.querySelectorAll("a[href]")) {
        const label = clean(a.structuredText);
        if (label && label.length >= 18 && label.length <= 140 && !SKIP_TEXT_RE.test(label)) {
          text = label;
          break;
        }
      }
      if (!text) continue;
      items.push(truncateWords(text, LIST_ITEM_MAX));
    }
    if (items.length > best.length) best = items;
  }
  if (best.length < 4) return undefined;
  const items = [...new Set(best)].slice(0, MAX_LIST_ITEMS);
  return items.length >= 4 ? { kind: "list", items } : undefined;
}

function collectContent(
  root: HTMLElement,
  body: HTMLElement,
  links: LinkCollector,
  base: URL,
  page: { title?: string; description?: string },
): ContentResult {
  const scope = contentRoot(root, body);
  const segments = segmentContent(scope);

  const seen = new Set<string>();
  if (page.description) seen.add(`t:${normKey(page.description)}`);
  if (page.title) seen.add(`t:${normKey(page.title)}`);
  const images: ImageCandidate[] = [];

  let intro: ExtractedBlock[] = [];
  const sections: ExtractedSection[] = [];
  const seenHeadings = new Set<string>();

  for (const seg of segments) {
    if (!seg.heading) {
      intro = buildBlocks(seg, { links, base, seen, images, inSection: false }).slice(0, MAX_INTRO_BLOCKS);
      continue;
    }
    if (sections.length >= MAX_CONTENT_SECTIONS) break;
    const heading = clean(spacedText(seg.heading));
    if (!heading || heading.length < 2 || heading.length > 100 || SKIP_TEXT_RE.test(heading)) continue;
    const key = normKey(heading);
    if (!key || seenHeadings.has(key)) continue;
    seenHeadings.add(key);

    const blocks = buildBlocks(seg, { links, base, seen, images, inSection: true, headingKey: key });
    const anchor =
      seg.heading.querySelector("a[href]") ??
      (seg.heading.parentNode instanceof HTMLElement && seg.heading.parentNode.tagName === "A" ? seg.heading.parentNode : null);
    const link = anchor ? links.toLink(anchor, { minText: 1, maxText: 200 }) : undefined;
    const section: ExtractedSection = { heading, blocks };
    const lead = blocks.find((b) => b.kind === "text");
    if (lead && lead.kind === "text") section.text = lead.text;
    if (link && !link.external) section.href = link.href;
    sections.push(section);
  }

  // A heading with nothing under it is only worth a row when it goes somewhere.
  const filtered = sections.filter((s) => s.blocks.length > 0 || s.href || sections.length < 3);

  if (!filtered.length && intro.length < 2) {
    const list = fallbackList(scope);
    if (list) intro = [...intro, list].slice(0, MAX_INTRO_BLOCKS);
  }

  // Keep the best few in-page images; drop the image blocks that did not make the cut.
  const ranked = [...images]
    .map((img, order) => ({ img, order }))
    .sort((a, b) => b.img.score - a.img.score || a.order - b.order)
    .slice(0, MAX_INLINE_IMAGES)
    .map((e) => e.img.src);
  const kept = new Set(ranked);
  const prune = (blocks: ExtractedBlock[]) => blocks.filter((b) => b.kind !== "image" || kept.has(b.src));
  for (const s of filtered) s.blocks = prune(s.blocks);
  intro = prune(intro);

  return { sections: filtered, intro, sectionsFound: filtered.length, inlineImages: ranked };
}
