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
