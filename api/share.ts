/**
 * GET /p/<site> — Vercel Function (Node runtime) behind the `/p/(.*)` rewrite.
 *
 * Serves the built SPA shell with the unfurl meta of *that* site baked in, so
 * a shared link previews as "<Site> as a 2009 iPhone app" in Slack, iMessage,
 * X and friends. The page itself is rendered client-side by `SharePage`; this
 * function only rewrites the `<head>`.
 *
 * A failed preview never fails the page: the shell is served with generic meta
 * and the client shows the friendly error inside the phone.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { generatePreview } from "./_lib/preview.js";
import type { ScreenSpec } from "./_lib/spec.js";

export const config = { maxDuration: 20 };

/** Used when the request has no usable Host header (and for the OG image fallback). */
const PROD_ORIGIN = "https://design-system-3gs.vercel.app";
const FALLBACK_DESCRIPTION = "Any website, rebuilt in the iPhone 3GS UI.";
const MAX_TITLE = 120;
/** Longer than this and the spec's `siteName` is a headline, not a name. */
const MAX_NAME = 32;
const MAX_DESCRIPTION = 200;

/* ------------------------------------------------------------------ */
/* Rate limiting — same sliding window as /api/preview                 */
/* ------------------------------------------------------------------ */

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
let lastSweep = 0;

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function clientIp(req: IncomingMessage): string {
  const first = header(req, "x-forwarded-for")?.split(",")[0]?.trim();
  return first || header(req, "x-real-ip")?.trim() || req.socket?.remoteAddress || "unknown";
}

/** Returns the seconds to wait when the caller is over the limit, else 0. */
function rateLimited(ip: string, now = Date.now()): number {
  if (now - lastSweep > RATE_WINDOW_MS) {
    for (const [key, times] of hits) if (times[times.length - 1] < now - RATE_WINDOW_MS) hits.delete(key);
    lastSweep = now;
  }
  const recent = (hits.get(ip) ?? []).filter((t) => t > now - RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return Math.max(1, Math.ceil((recent[0] + RATE_WINDOW_MS - now) / 1000));
  }
  recent.push(now);
  hits.set(ip, recent);
  return 0;
}

/* ------------------------------------------------------------------ */
/* URL shapes                                                          */
/* ------------------------------------------------------------------ */

function decodeOnce(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // a stray % — take it literally rather than 400
  }
}

/**
 * The site a `/p/…` request is about. Supported shapes:
 *   /p/vercel.com · /p/vercel.com/pricing · /p/https://vercel.com/pricing
 *   /p/https%3A%2F%2Fvercel.com%2Fpricing · /p/anything?site=vercel.com
 * `?site=` (and the legacy `?url=`) are the fallback when the path is empty.
 * The client has a twin of this in `Preview/shareLink.ts`.
 */
export function siteFromUrl(requestUrl: string): string {
  const url = new URL(requestUrl || "/", "http://localhost");
  const match = /^\/p\/(.+)$/.exec(url.pathname);
  const raw = (match ? decodeOnce(match[1]) : "") || url.searchParams.get("site") || url.searchParams.get("url") || "";
  // Proxies like to collapse `https://` in a path down to `https:/`.
  return raw.trim().replace(/^(https?):\/+/i, "$1://");
}

/**
 * Behind a `vercel.json` rewrite the function still sees the requested path in
 * `req.url`; these headers are the belt-and-braces if a proxy ever rewrites it
 * for real. Worst case the meta stays generic — the client reads the path too.
 */
const ORIGINAL_PATH_HEADERS = ["x-vercel-original-path", "x-forwarded-uri", "x-original-uri"];

function requestUrl(req: IncomingMessage): string {
  const url = req.url ?? "/";
  if (url.startsWith("/p/") || url.includes("site=") || url.includes("url=")) return url;
  for (const name of ORIGINAL_PATH_HEADERS) {
    const value = header(req, name);
    if (value?.startsWith("/p/")) return value;
  }
  return url;
}

/** Best-effort host of raw user input — for the title when the preview failed. */
function hostOfInput(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return raw.split(/[/?#]/)[0] ?? "";
  }
}

/* ------------------------------------------------------------------ */
/* Meta injection                                                      */
/* ------------------------------------------------------------------ */

/** Every value that reaches an attribute goes through this — remote titles are hostile input. */
function escapeHtml(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/** The tags we own; the template's copies are removed so scrapers can't read the docs-site ones first. */
const OWNED = /<title\b[^>]*>[\s\S]*?<\/title>\s*|<meta\b(?=[^>]*\b(?:property|name)\s*=\s*"(?:og:(?:title|description|url|image|image:width|image:height|image:alt)|twitter:(?:card|title|description|image|image:alt)|description)")[^>]*>\s*|<link\b(?=[^>]*\brel\s*=\s*"canonical")[^>]*>\s*/gi;

export interface ShareMeta {
  title: string;
  description: string;
  canonical: string;
  image: string;
  /** Known only for the static fallback card. */
  imageSize?: { width: number; height: number };
}

/** Hosts and paths that stay readable in `/p/…`; anything else is percent-encoded. */
const PRETTY = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[\w\-./~%+]*)?$/i;

/** `https://vercel.com/pricing` → `vercel.com/pricing`, `?x=1` → percent-encoded. */
function sharePath(target: string): string {
  const bare = target.replace(/^https:\/\//i, "").replace(/\/+$/, "");
  return PRETTY.test(bare) ? bare : encodeURIComponent(target);
}

/** The `<head>` values for one share page. Pure: takes the spec, never fetches. */
export function shareMeta(site: string, origin: string, spec?: ScreenSpec): ShareMeta {
  const host = spec?.host?.replace(/^www\./, "") || hostOfInput(site);
  const siteName = spec?.siteName?.trim();
  // A sub-page's siteName is often its full headline ("Pricing: Hobby, Pro and…") —
  // too long to read as "<Site> as a 2009 iPhone app", so the host wins there.
  const usable = siteName && siteName.length <= MAX_NAME && !/[…]$/.test(siteName);
  const name = (usable ? siteName : host || siteName) || "Any website";
  const target = spec?.url || site;
  const canonical = `${origin}/p/${target ? sharePath(target) : ""}`;
  const image = spec?.imageDataUri ? `${origin}/api/image?url=${encodeURIComponent(target)}` : `${origin}/og.png`;
  return {
    title: clamp(`${name} as a 2009 iPhone app`, MAX_TITLE),
    description: clamp(spec?.description?.trim() || FALLBACK_DESCRIPTION, MAX_DESCRIPTION),
    canonical,
    image,
    imageSize: spec?.imageDataUri ? undefined : { width: 1200, height: 630 },
  };
}

function metaTags(meta: ShareMeta, site: string): string {
  const e = escapeHtml;
  const alt = `${e(site || "A website")} rendered as an iPhone 3GS app screen.`;
  return [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<link rel="canonical" href="${e(meta.canonical)}" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(meta.canonical)}" />`,
    `<meta property="og:image" content="${e(meta.image)}" />`,
    ...(meta.imageSize
      ? [
          `<meta property="og:image:width" content="${meta.imageSize.width}" />`,
          `<meta property="og:image:height" content="${meta.imageSize.height}" />`,
        ]
      : []),
    `<meta property="og:image:alt" content="${alt}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
    `<meta name="twitter:image" content="${e(meta.image)}" />`,
  ].join("\n    ");
}

/** Replace the template's own head tags with this site's. Never throws. */
export function withShareMeta(template: string, meta: ShareMeta, site: string): string {
  const stripped = template.replace(OWNED, "");
  const tags = `    ${metaTags(meta, site)}\n  `;
  return stripped.includes("</head>") ? stripped.replace("</head>", `${tags}</head>`) : `${tags}${stripped}`;
}

/**
 * Build the share page for `site`: previews it (cheap — `generatePreview` is
 * cached) and injects the meta. `preview: false` skips the network entirely.
 */
export async function renderSharePage(
  template: string,
  site: string,
  origin: string,
  preview = true,
): Promise<{ html: string; ok: boolean }> {
  const result = preview && site ? await generatePreview(site) : undefined;
  const spec = result?.ok ? result.spec : undefined;
  return { html: withShareMeta(template, shareMeta(site, origin, spec), site), ok: Boolean(spec) };
}

/* ------------------------------------------------------------------ */
/* The SPA shell                                                       */
/* ------------------------------------------------------------------ */

/** Built first, source second (so `vercel dev` and a bare `node` run both work). */
const TEMPLATE_PATHS = ["apps/site/dist/index.html", "apps/site/index.html"];
let cachedTemplate: string | undefined;

async function loadTemplate(): Promise<string | undefined> {
  if (cachedTemplate) return cachedTemplate;
  for (const rel of TEMPLATE_PATHS) {
    try {
      const html = await readFile(resolve(process.cwd(), rel), "utf8");
      if (html.includes("</head>")) return (cachedTemplate = html);
    } catch {
      /* try the next one */
    }
  }
  // Not bundled with the function (no `includeFiles`): read it back off the CDN.
  // `VERCEL_URL` is set by the platform — never the caller's Host header.
  const deployment = process.env.VERCEL_URL;
  if (!deployment) return undefined;
  try {
    const res = await fetch(`https://${deployment}/`, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    if (html.includes("</head>")) return (cachedTemplate = html);
  } catch {
    /* fall through */
  }
  return undefined;
}

/** Scheme + host of this deployment. The Host header is validated before it is echoed into meta. */
function originOf(req: IncomingMessage): string {
  const host = header(req, "x-forwarded-host") ?? header(req, "host");
  const proto = header(req, "x-forwarded-proto")?.split(",")[0] ?? "https";
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host) && /^https?$/.test(proto)) return `${proto}://${host}`;
  return PROD_ORIGIN;
}

function sendHtml(res: ServerResponse, html: string, status: number, cache: string, withBody: boolean): void {
  res.statusCode = status;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", cache);
  res.setHeader("x-content-type-options", "nosniff");
  res.end(withBody ? html : undefined);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("allow", "GET, HEAD");
    res.end();
    return;
  }
  const withBody = method === "GET";

  const template = await loadTemplate();
  if (!template) {
    sendHtml(res, "<!doctype html><title>3GS UI</title><p>The site build is unavailable.</p>", 500, "no-store", withBody);
    return;
  }

  const site = siteFromUrl(requestUrl(req));
  const origin = originOf(req);

  // Over the limit the shell is still served — only the preview (the expensive
  // part) is skipped; the client's own /api/preview call gets the 429 and shows it.
  const retryAfter = rateLimited(clientIp(req));
  if (retryAfter) {
    res.setHeader("retry-after", String(retryAfter));
    const { html } = await renderSharePage(template, site, origin, false);
    sendHtml(res, html, 200, "no-store", withBody);
    return;
  }

  const { html, ok } = await renderSharePage(template, site, origin);
  sendHtml(res, html, 200, ok ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store", withBody);
}
