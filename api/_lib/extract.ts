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

/** One entry of a page's repeated item pattern (a story, a post, a release). */
export interface ExtractedFeedItem {
  title: string;
  href: string;
  /** The item's own small print, collapsed into one line ("382 points · 214 comments · 5h ago"). */
  meta?: string;
  external: boolean;
  /** Absolute URL of the card's thumbnail, for the first few items only. */
  imgSrc?: string;
}

/** The page's dominant repeated item pattern: what makes an index page an index page. */
export interface ExtractedFeed {
  items: ExtractedFeedItem[];
  /** Nearest preceding heading / the page's h1 / "Latest". */
  label?: string;
  /** How many items the pattern really had, before the cap. */
  total: number;
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
  /** The repeated item list a feed / index page is made of, when there is one. */
  feed?: ExtractedFeed;
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
  const visibleText = clean(body.structuredText) ?? "";
  const found = collectFeed(root, allAnchors, links, base, visibleText.length);
  const feed = found?.feed;
  const content = collectContent(root, body, links, base, { title: ogTitle ?? title, description }, Boolean(feed));
  // An index page's items are headings, list rows and thumbnails too — the feed already shows them.
  if (found) {
    const feedImages = new Set(found.feed.items.map((i) => i.imgSrc).filter((s): s is string => Boolean(s)));
    for (const section of content.sections) {
      section.blocks = section.blocks.filter((b) => !repeatsFeed(b, found.titles, feedImages));
      const lead = section.blocks.find((b) => b.kind === "text");
      section.text = lead?.kind === "text" ? lead.text : undefined;
    }
    // The section the list came out of is the list: it is on screen already.
    const feedHeading = normKey(found.feed.label ?? "");
    content.sections = content.sections.filter(
      (s) =>
        !found.titles.has(normKey(s.heading)) &&
        normKey(s.heading) !== feedHeading &&
        (s.blocks.length > 0 || Boolean(s.href)),
    );
    content.sectionsFound = content.sections.length;
    content.intro = content.intro.filter((b) => !repeatsFeed(b, found.titles, feedImages));
  }
  const ctas = collectCtas(root, links);
  const search = detectSearch(root, base);
  const footerLinks = collectFooterLinks(root, allAnchors, html.length, links, navLinks);

  const clientRendered = visibleText.length < CLIENT_RENDERED_TEXT_THRESHOLD || isBareSpaMount(body);
  // A feed page's thumbnails are its substance; they get the inline-image budget first.
  const inlineImages = [
    ...new Set([...(feed?.items ?? []).map((i) => i.imgSrc).filter((s): s is string => Boolean(s)), ...content.inlineImages]),
  ].slice(0, MAX_INLINE_IMAGES);

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
    feed,
    intro: content.intro,
    sectionsFound: content.sectionsFound,
    inlineImages,
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

  /** Where an anchor points, without looking at its text. */
  target(el: HTMLElement): { href: string; external: boolean; isHome: boolean } | undefined {
    const rawHref = el.getAttribute("href")?.trim() ?? "";
    if (!rawHref || rawHref.startsWith("#") || /^(javascript|mailto|tel|sms|data|blob):/i.test(rawHref)) return undefined;
    const url = absolute(rawHref, this.base);
    if (!url) return undefined;
    url.hash = "";
    const isHome = (url.pathname === "/" || url.pathname === "") && !url.search && isInternal(url, this.page);
    return { href: url.href, external: !isInternal(url, this.page), isHome };
  }

  toLink(el: HTMLElement, opts: { minText: number; maxText: number }): ExtractedLink | undefined {
    const target = this.target(el);
    if (!target) return undefined;
    const text = labelOf(el);
    if (!text || text.length < opts.minText || text.length > opts.maxText) return undefined;
    if (SKIP_LINK_RE.test(text)) return undefined;
    return { text, href: target.href, external: target.external, isHome: target.isHome };
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

/** Links, buttons and menu items: text a reader taps, not text a reader reads. */
const CONTROL_SELECTOR = "a[href], button, [role=button], [role=menuitem], [role=tab], summary";

/** Fraction of an element's text that sits inside controls — high means navigation. */
function linkDensity(el: HTMLElement): number {
  const total = clean(el.structuredText)?.length ?? 0;
  if (!total) return 0;
  let inControls = 0;
  for (const c of el.querySelectorAll(CONTROL_SELECTOR)) inControls += clean(c.structuredText)?.length ?? 0;
  return inControls / total;
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
    if (el.querySelectorAll(CONTROL_SELECTOR).length >= 2 && linkDensity(el) > 0.6) continue;

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
  hasFeed = false,
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

  // The feed already is the list of titles — repeating it as intro copy just doubles it up.
  if (!filtered.length && intro.length < 2 && !hasFeed) {
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

/* ------------------------------------------------------------------ */
/* feed: the page's dominant repeated item pattern                     */
/* ------------------------------------------------------------------ */

const FEED_MIN_ITEMS = 5;
const FEED_MAX_ITEMS = 15;
const FEED_TITLE_MIN = 12;
const FEED_TITLE_MAX = 140;
const FEED_META_MAX = 90;
/** Thumbnails cost a fetch each, so only the top of the list gets one. */
const FEED_THUMBS = 3;
/** How many ancestors make up an item's structural signature. */
const FEED_SIGNATURE_DEPTH = 3;
/** How far above the anchor an item's card may sit. */
const FEED_CARD_MAX_LEVELS = 5;
/** The items must together carry a real share of the page's words — otherwise they are a widget. */
const FEED_MIN_TEXT_SHARE = 0.06;
/** More nav-shaped titles than this share means navigation, not a feed. */
const FEED_MAX_SHORT_SHARE = 0.6;
/** Items packed into less markup than this sit in one small box, not across a page. */
const FEED_MIN_SPAN = 600;
/** Characters an item must carry beyond its headline for short titles to still be items. */
const FEED_MIN_ITEM_EXTRA = 24;
/** Items sampled when judging how much each one says. */
const FEED_RICHNESS_SAMPLE = 5;
/** A page with less text than this has no list worth reading. */
const FEED_MIN_PAGE_TEXT = 200;
/** An item's card stops growing here: past it we are swallowing the section around it. */
const FEED_CARD_MAX_TEXT = 600;
/** A card's next sibling this long is the next item, not this item's second row. */
const FEED_SIBLING_MAX_TEXT = 240;

/** Containers whose repeated links are never a feed. */
const FEED_JUNK_RE =
  /reference|citation|footnote|bibliograph|cookie|consent|gdpr|newsletter|promo|advert|sidebar|widget|breadcrumb|pagination|paginate|social|share|related-|recommend|carousel|banner|toc\b|table-of/i;
/** Class / id of the small print that belongs to an item. */
const FEED_META_RE =
  /subtext|meta|byline|score|points|comment|author|date|time|source|domain|site|host|posted|published|excerpt|summary|snippet|teaser|dek\b|caption|tagline|detail|info/i;
/** Segments of small print that are controls, not information. */
const FEED_META_JUNK_RE =
  /^(hide|flag|share|save|saved|reply|replies|discuss|past|favorite|favourite|context|parent|permalink|edit|delete|report|link|caches?|archive(\.org)?|ghostarchive|more|read more|comments?|reactions?|\d{1,5}[.)]?|\W*)$/i;
/** Buttons and icon labels dressed as spans — controls, not small print. */
const FEED_CONTROL_CLASS_RE = /(^|[\s_-])(btn|button|cta|sr-only|visually-hidden|screen-reader|tooltip)/i;
/** Headings that name what is left over rather than the list itself. */
const FEED_LABEL_JUNK_RE = /^(everything else|the rest|more|others?|all (posts|articles|stories|updates)|archives?|index)$/i;
/** Elements that hold running copy: a link inside one is a word in a sentence, not an item. */
const FEED_PROSE_TAGS = new Set(["P", "LI", "DD", "DT", "BLOCKQUOTE", "FIGCAPTION", "TD", "TH", "SUMMARY"]);
/** How much longer than its link a paragraph may be before the link is just part of the copy. */
const FEED_PROSE_RATIO = 2.5;
/** Share of items whose headline must lead their card (the rest of the card comes after it). */
const FEED_MIN_LEADING = 0.6;
/** Item containers whose own `header` / `footer` is part of the item, not page chrome. */
const FEED_ITEM_ANCESTORS = new Set(["ARTICLE", "LI", "TR", "TD"]);
/** Subtrees that never hold an item's small print. */
const FEED_META_SKIP_TAGS = new Set([
  "DETAILS", "SUMMARY", "NAV", "FORM", "BUTTON", "SELECT", "TEXTAREA", "SCRIPT", "STYLE", "TEMPLATE", "SVG", "IFRAME",
  "UL", "OL",
]);

interface FeedCandidate {
  a: HTMLElement;
  title: string;
  href: string;
  external: boolean;
}

/** The element's ancestors, nearest first, at most `max` of them. */
function ancestorsOf(el: HTMLElement, max: number): HTMLElement[] {
  const out: HTMLElement[] = [];
  let p = el.parentNode;
  while (p && p.tagName && out.length < max) {
    out.push(p);
    p = p.parentNode;
  }
  return out;
}

function isAncestorOf(ancestor: HTMLElement, el: HTMLElement): boolean {
  let p = el.parentNode;
  while (p && p.tagName) {
    if (p === ancestor) return true;
    p = p.parentNode;
  }
  return false;
}

/**
 * A link that is a word inside a sentence ("uses <a>direct manipulation</a> to…")
 * rather than a line of its own. Walking up stops at the first block: only a
 * paragraph-ish ancestor that says much more than the link makes it prose.
 */
function inRunningText(el: HTMLElement, titleLength: number): boolean {
  for (const p of ancestorsOf(el, 6)) {
    if (FEED_PROSE_TAGS.has(p.tagName)) return (clean(p.structuredText)?.length ?? 0) > titleLength * FEED_PROSE_RATIO;
    if (BLOCK_TAGS.has(p.tagName)) return false;
  }
  return false;
}

/** Site navigation / page header / footer — the page's chrome, never its items. */
function inPageChrome(el: HTMLElement): boolean {
  for (const p of ancestorsOf(el, 24)) {
    const tag = p.tagName;
    if (tag === "NAV" || tag === "ASIDE") return true;
    const role = (p.getAttribute("role") ?? "").trim().toLowerCase();
    if (role === "navigation" || role === "banner" || role === "contentinfo" || role === "search") return true;
    // An `article`'s own header is part of the item; the page's header is not.
    if ((tag === "HEADER" || tag === "FOOTER") && !hasAncestor(p, FEED_ITEM_ANCESTORS)) return true;
  }
  return false;
}

/** Reference lists, cookie bars, "related posts" rails: repeated links that are not the page. */
function inFeedJunk(el: HTMLElement): boolean {
  for (const p of ancestorsOf(el, 12)) {
    const idClass = `${p.getAttribute("id") ?? ""} ${p.getAttribute("class") ?? ""}`;
    if (idClass.length > 200) continue; // utility-class soup carries no meaning
    if (FEED_JUNK_RE.test(idClass) || JUNK_ID_RE.test(idClass) || JUNK_CLASS_RE.test(idClass)) return true;
  }
  return false;
}

/**
 * The part of a class list that says what an element *is*. Generated names
 * (`css-1x2y3z`, `Post_title__aB12`) and utility soup (`flex items-center …`)
 * carry no structure, so they collapse to "".
 */
function stableClass(el: HTMLElement): string {
  const raw = (el.getAttribute("class") ?? "").trim();
  if (!raw) return "";
  const classes = raw.split(/\s+/).filter(Boolean);
  if (classes.length > 4) return "";
  for (const c of classes) {
    const name = c.toLowerCase().replace(/__[a-z0-9_-]{4,}$/, "").replace(/[-_]?\d+$/, "");
    if (name.length < 2 || name.length > 40) continue;
    if (/\d{2,}|[a-f0-9]{6,}$|^(css|sc|jsx|svelte|emotion|chakra|mui|styles?)[-_]/.test(name)) continue;
    return name;
  }
  return "";
}

function nodeKey(el: HTMLElement): string {
  const cls = stableClass(el);
  return cls ? `${el.tagName}.${cls}` : el.tagName;
}

/** `a.u-url<SPAN.link<DIV.details<DIV.story_liner` — what makes two links "the same kind of thing". */
function feedSignature(a: HTMLElement): string {
  return [a, ...ancestorsOf(a, FEED_SIGNATURE_DEPTH)].map(nodeKey).join("<");
}

/** The headline of an item link: an inner heading, the whole label, or its first line. */
function feedTitle(a: HTMLElement): string | undefined {
  const heading = a.querySelector("h1, h2, h3, h4, h5, h6");
  if (heading) {
    const t = clean(spacedText(heading));
    if (t && t.length >= FEED_TITLE_MIN) return t;
  }
  const whole = clean(spacedText(a));
  if (whole && whole.length <= FEED_TITLE_MAX) return whole;
  return (a.structuredText ?? "")
    .split(/\n+/)
    .map((l) => clean(l))
    .find((l): l is string => Boolean(l));
}

/**
 * A "navigation-shaped" label: a couple of words and short with it ("Pricing",
 * "Contact sales"). Long two-word titles ("anthropics / financial-services")
 * are real items, so length has a say as well as word count.
 */
function isShortTitle(text: string): boolean {
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return words <= 3 && text.length < 30;
}

/** Drop the headline wherever it shows up inside an item's small print. */
function stripTitle(text: string, title: string): string {
  let out = clean(text) ?? "";
  const needle = title.toLowerCase();
  for (let i = out.toLowerCase().indexOf(needle); i !== -1; i = out.toLowerCase().indexOf(needle)) {
    out = `${out.slice(0, i)} ${out.slice(i + title.length)}`;
  }
  return out;
}

/** Text of an element, minus the child sub-trees that only ever hold controls or tag lists. */
function metaText(el: HTMLElement): string {
  return el.childNodes
    .map((n) => {
      if (!(n instanceof HTMLElement)) return n.text;
      if (FEED_META_SKIP_TAGS.has(n.tagName)) return "";
      const cls = n.getAttribute("class") ?? "";
      if (cls.length <= 120 && FEED_CONTROL_CLASS_RE.test(cls)) return ""; // "Star", "Sponsor", "Copy"
      return metaText(n);
    })
    .join(" ");
}

/** The item's own description, where a card keeps one. */
function firstParagraph(card: HTMLElement, title: string): string | undefined {
  for (const p of card.querySelectorAll("p")) {
    const text = clean(stripTitle(metaText(p), title));
    if (text && text.length >= 20) return text;
  }
  return undefined;
}

/** "382 points by pg 5 hours ago | hide | 93 comments" → "382 points by pg 5 hours ago · 93 comments". */
function tidyMeta(raw: string, title: string): string | undefined {
  // A machine timestamp reads as a date on a phone: "2026-09-22 00:23:55" → "2026-09-22".
  const text = clean(stripTitle(raw, title).replace(/(\d{4}-\d{2}-\d{2})[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g, "$1"));
  if (!text) return undefined;
  const seen = new Set<string>();
  const segments: string[] = [];
  for (const part of text.split(/\s*[|•·‧–—]\s*|\s{2,}/)) {
    const seg = clean(part)?.replace(/^[(\[\s,;:·•|]+|[)\]\s,;:·•|]+$/g, "").trim();
    if (!seg || FEED_META_JUNK_RE.test(seg)) continue;
    const key = seg.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    segments.push(seg);
    if (segments.join(" · ").length >= FEED_META_MAX) break;
  }
  // Responsive markup prints the same date twice (one copy per breakpoint).
  const meta = segments.join(" · ").replace(/\b(.{4,40}?)\s+\1\b/g, "$1");
  if (meta.length < 2 || normKey(meta) === normKey(title)) return undefined;
  return truncateWords(meta, FEED_META_MAX);
}

/**
 * The parts of an item's small print that say what they are: `<time>` and
 * elements classed `subtext` / `byline` / `score` / `date` …, outermost first.
 */
function metaParts(scope: HTMLElement, title: string): string[] {
  const parts: string[] = [];
  const taken: HTMLElement[] = [];
  for (const el of scope.querySelectorAll("time, [class], [id]")) {
    if (el.tagName !== "TIME") {
      const idClass = `${el.getAttribute("class") ?? ""} ${el.getAttribute("id") ?? ""}`;
      if (idClass.length > 120 || !FEED_META_RE.test(idClass)) continue;
    }
    if (taken.some((t) => isAncestorOf(t, el))) continue;
    const text = clean(stripTitle(metaText(el), title));
    if (!text || text.length < 2) continue;
    taken.push(el);
    parts.push(text);
    if (parts.join(" · ").length > FEED_META_MAX * 2) break;
  }
  return parts;
}

/**
 * One line of small print for an item. Labelled parts win; when the card holds
 * none, whatever it says besides the headline does. A layout table splits an
 * item over two rows (HN), so the card's plain next sibling counts as part of it.
 */
function itemMeta(card: HTMLElement, sibling: HTMLElement | undefined, title: string): string | undefined {
  const parts = [...metaParts(card, title), ...(sibling ? metaParts(sibling, title) : [])];
  if (parts.length) return tidyMeta(parts.join(" · "), title);
  const own = firstParagraph(card, title) ?? metaText(card);
  return tidyMeta(own, title) ?? (sibling ? tidyMeta(metaText(sibling), title) : undefined);
}

/** The highest ancestor that still belongs to this item alone. */
function itemCard(a: HTMLElement, members: Map<HTMLElement, number>, titleLength: number): HTMLElement {
  const maxText = Math.max(FEED_CARD_MAX_TEXT, titleLength * 10);
  let card = a;
  for (const p of ancestorsOf(a, FEED_CARD_MAX_LEVELS)) {
    const tag = p.tagName;
    if (tag === "BODY" || tag === "HTML" || tag === "MAIN") break;
    if ((members.get(p) ?? 0) > 1) break; // it already holds the next item
    if ((clean(p.structuredText)?.length ?? 0) > maxText) break;
    card = p;
  }
  return card;
}

/** The element after the card, when it is that item's second row (HN's `subtext` tr). */
function metaSibling(card: HTMLElement, members: Set<HTMLElement>): HTMLElement | undefined {
  const parent = card.parentNode;
  if (!parent || !parent.tagName) return undefined;
  const siblings = childElements(parent);
  const next = siblings[siblings.indexOf(card) + 1];
  if (!next || (clean(next.structuredText)?.length ?? 0) > FEED_SIBLING_MAX_TEXT) return undefined;
  for (const a of next.querySelectorAll("a[href]")) if (members.has(a)) return undefined;
  return next;
}

function itemImage(card: HTMLElement, base: URL): string | undefined {
  for (const el of card.querySelectorAll("img, picture")) {
    const cand = imageCandidate(el, base, undefined, false);
    if (cand) return cand.src;
  }
  return undefined;
}

/** A heading this list is filed under: short, real copy, not one of the items. */
function headingText(h: HTMLElement, itemTitles: Set<string>): string | undefined {
  const t = clean(spacedText(h));
  if (!t || t.length < 2 || t.length > 40 || SKIP_TEXT_RE.test(t) || itemTitles.has(normKey(t))) return undefined;
  if (FEED_LABEL_JUNK_RE.test(t)) return undefined;
  return t;
}

/**
 * What the page calls the list: the heading right before it, or the page's h1.
 * A list that runs past other headings belongs to the page, not to the section
 * it happens to start in — then the h1 is the honest label. `undefined` when
 * the page says nothing; naming it is then the mapper's business.
 */
function feedLabel(root: HTMLElement, items: FeedCandidate[], itemTitles: Set<string>): string | undefined {
  const start = items[0].a.range[0];
  const end = items[items.length - 1].a.range[0];
  let preceding: string | undefined;
  let spansSections = false;
  for (const h of inDocumentOrder(root.querySelectorAll("h1, h2, h3"))) {
    if (h.range[1] > start && h.range[0] < end) spansSections = spansSections || Boolean(headingText(h, itemTitles));
    if (h.range[0] >= start) continue;
    if (h.range[1] > start) continue; // the heading wraps the first item itself
    preceding = headingText(h, itemTitles) ?? preceding;
  }
  const h1 = root.querySelector("h1");
  const pageHeading = h1 ? headingText(h1, itemTitles) : undefined;
  return spansSections ? pageHeading ?? preceding : preceding ?? pageHeading;
}

/** How many of a group's items sit under each ancestor — that is where one card ends. */
function ancestorCounts(items: FeedCandidate[]): Map<HTMLElement, number> {
  const counts = new Map<HTMLElement, number>();
  for (const c of items) {
    for (const p of ancestorsOf(c.a, FEED_CARD_MAX_LEVELS + 1)) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return counts;
}

/**
 * What a group's cards look like, from a sample of them:
 * `extra` — characters the average item carries beyond its headline (an excerpt,
 * a byline, a star count); menus and link lists carry none, which is what tells
 * a short-titled feed ("owner / repo") from navigation.
 * `leading` — the share of items whose headline leads their card. A card that
 * says everything *before* its link is a section with a call to action, not an item.
 */
function sampleCards(items: FeedCandidate[]): { extra: number; leading: number } {
  const counts = ancestorCounts(items);
  const sample = items.slice(0, FEED_RICHNESS_SAMPLE);
  let extra = 0;
  let leads = 0;
  for (const c of sample) {
    const card = itemCard(c.a, counts, c.title.length);
    const text = clean(card.structuredText) ?? "";
    extra += Math.max(0, text.length - c.title.length);
    const at = text.toLowerCase().indexOf(c.title.toLowerCase());
    if (at === -1 || text.length - at - c.title.length + 8 >= at) leads++;
  }
  return { extra: extra / sample.length, leading: leads / sample.length };
}

/**
 * Find the page's dominant repeated item pattern (HN's story rows, a blog
 * index's cards, a changelog's entries) and read it as a list of items.
 *
 * Anchors are grouped by a structural signature — their own tag/class plus
 * three ancestors — and the biggest, wordiest group wins, provided it looks
 * like content: at least five items, real titles (not 1–3-word nav labels),
 * spread across the markup, and carrying a noticeable share of the page's text.
 */
function collectFeed(
  root: HTMLElement,
  allAnchors: HTMLElement[],
  links: LinkCollector,
  base: URL,
  pageTextLength: number,
): { feed: ExtractedFeed; titles: Set<string> } | undefined {
  if (pageTextLength < FEED_MIN_PAGE_TEXT || allAnchors.length < FEED_MIN_ITEMS) return undefined;

  const groups = new Map<string, FeedCandidate[]>();
  for (const a of allAnchors) {
    const target = links.target(a);
    if (!target || target.isHome) continue;
    const title = feedTitle(a);
    if (!title || title.length < FEED_TITLE_MIN || title.length > FEED_TITLE_MAX) continue;
    if (SKIP_TEXT_RE.test(title) || READ_MORE_RE.test(title) || JUNK_COPY_RE.test(title)) continue;
    if (inRunningText(a, title.length) || inPageChrome(a) || inFeedJunk(a)) continue;
    const sig = feedSignature(a);
    const bucket = groups.get(sig);
    const candidate: FeedCandidate = { a, title, href: target.href, external: target.external };
    if (bucket) bucket.push(candidate);
    else groups.set(sig, [candidate]);
  }

  let best: FeedCandidate[] | undefined;
  let bestScore = 0;
  for (const bucket of groups.values()) {
    if (bucket.length < FEED_MIN_ITEMS) continue;
    const items = dedupeCandidates(bucket);
    if (items.length < FEED_MIN_ITEMS) continue;
    const { extra, leading } = sampleCards(items);
    // A card that says everything before its link is a section with a call to action.
    if (leading < FEED_MIN_LEADING) continue;
    // Mostly short titles means navigation — unless every item carries small print of its own.
    const short = items.filter((i) => isShortTitle(i.title)).length;
    if (short > items.length * FEED_MAX_SHORT_SHARE && extra < FEED_MIN_ITEM_EXTRA) continue;
    // Items packed into a few hundred characters of markup are one box, not a page of items.
    if (items[items.length - 1].a.range[0] - items[0].a.range[0] < FEED_MIN_SPAN) continue;
    const textLength = items.reduce((n, i) => n + i.title.length, 0);
    // What the items say together — headlines plus their small print — against what the page says.
    if ((textLength + extra * items.length) / pageTextLength < FEED_MIN_TEXT_SHARE) continue;
    const score = items.length + textLength / 100;
    if (score > bestScore) {
      bestScore = score;
      best = items;
    }
  }
  if (!best) return undefined;

  const memberSet = new Set(best.map((c) => c.a));
  const memberCounts = ancestorCounts(best);

  const titles = new Set(best.map((c) => normKey(c.title)));
  const items: ExtractedFeedItem[] = [];
  let thumbs = 0;
  for (const c of best.slice(0, FEED_MAX_ITEMS)) {
    const card = itemCard(c.a, memberCounts, c.title.length);
    const item: ExtractedFeedItem = { title: c.title, href: c.href, external: c.external };
    const meta = itemMeta(card, metaSibling(card, memberSet), c.title);
    if (meta) item.meta = meta;
    if (thumbs < FEED_THUMBS) {
      const src = itemImage(card, base);
      if (src) {
        item.imgSrc = src;
        thumbs++;
      }
    }
    items.push(item);
  }

  const feed: ExtractedFeed = { items, total: best.length };
  const label = feedLabel(root, best, titles);
  if (label) feed.label = label;
  return { feed, titles };
}

/** Copy that is really the item list in another shape (the stories as a plain `<ol>`, a card's thumbnail). */
function repeatsFeed(block: ExtractedBlock, titles: Set<string>, images: Set<string>): boolean {
  if (block.kind === "image") return images.has(block.src);
  const matches = (text: string): boolean => {
    const key = normKey(text);
    if (titles.has(key)) return true;
    for (const t of titles) if (t.length >= FEED_TITLE_MIN && key.includes(t)) return true;
    return false;
  };
  if (block.kind === "list") return block.items.filter(matches).length >= Math.max(2, block.items.length / 2);
  if (block.kind === "text") return matches(block.text);
  if (block.kind === "link") return matches(block.text);
  return false;
}

/** One entry per URL and per headline, in document order. */
function dedupeCandidates(bucket: FeedCandidate[]): FeedCandidate[] {
  const seenHref = new Set<string>();
  const seenTitle = new Set<string>();
  const out: FeedCandidate[] = [];
  for (const c of bucket) {
    const hrefKey = c.href.replace(/\/$/, "").toLowerCase();
    const titleKey = normKey(c.title);
    if (seenHref.has(hrefKey) || seenTitle.has(titleKey)) continue;
    seenHref.add(hrefKey);
    seenTitle.add(titleKey);
    out.push(c);
  }
  return out;
}
