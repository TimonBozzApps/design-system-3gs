/**
 * Guarded HTTP fetching for the preview generator.
 *
 * Everything that talks to the network goes through `guardedFetch`, which
 * validates the URL, resolves the hostname and refuses private / loopback /
 * link-local / metadata addresses before every hop (initial request and each
 * redirect), never forwards visitor headers, and bounds time and size.
 *
 * Known limitation: the pre-flight DNS check and the connection made by
 * `fetch` are two separate lookups, so a host that flips its record between
 * them (DNS rebinding) is not caught. Pinning the resolved address would need
 * a custom undici dispatcher, which is not available without a dependency.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { PreviewErrorCode } from "./spec.js";

export const USER_AGENT =
  "Mozilla/5.0 (compatible; 3GS-UI-Preview/1.0; +https://design-system-3gs.vercel.app)";

const MAX_REDIRECTS = 3;
const HTML_MAX_BYTES = 4_000_000; // beyond this the HTML is truncated, not rejected
const HTML_TIMEOUT_MS = 8_000;
const IMAGE_MAX_BYTES = 350_000;
const IMAGE_SVG_MAX_BYTES = 60_000;
const IMAGE_TIMEOUT_MS = 4_000;

export class PreviewError extends Error {
  code: PreviewErrorCode;
  constructor(code: PreviewErrorCode, message: string) {
    super(message);
    this.name = "PreviewError";
    this.code = code;
  }
}

export function isPreviewError(e: unknown): e is PreviewError {
  return e instanceof PreviewError;
}

/* ------------------------------------------------------------------ */
/* URL validation                                                      */
/* ------------------------------------------------------------------ */

const BLOCKED_HOST_SUFFIXES = [".localhost", ".internal", ".local", ".home.arpa", ".in-addr.arpa", ".ip6.arpa"];

/**
 * Turn user input into a URL we are willing to fetch. Adds `https://` when
 * the scheme is missing. Throws `invalid_url` for unparseable / non-http
 * input and `blocked` for things we refuse on principle (credentials,
 * exotic ports, private hosts).
 */
export function normalizeUrl(input: string): URL {
  const raw = (input ?? "").trim();
  if (!raw) throw new PreviewError("invalid_url", "Enter a website URL.");
  if (raw.length > 2048) throw new PreviewError("invalid_url", "That URL is too long.");
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new PreviewError("invalid_url", "That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PreviewError("invalid_url", "Only http:// and https:// URLs are supported.");
  }
  url.hash = "";
  assertAllowedUrl(url);
  return url;
}

/** Synchronous policy checks (no network). Applied to the input and every redirect target. */
export function assertAllowedUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PreviewError("blocked", "Redirected to a non-http URL.");
  }
  if (url.username || url.password) {
    throw new PreviewError("blocked", "URLs with embedded credentials are not allowed.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new PreviewError("blocked", "Only ports 80 and 443 are allowed.");
  }
  const host = hostnameOf(url);
  if (!host) throw new PreviewError("invalid_url", "The URL has no hostname.");
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new PreviewError("blocked", "Local and internal hostnames are not allowed.");
  }
  const ipVersion = isIP(host);
  if (ipVersion) {
    if (isForbiddenAddress(host)) throw new PreviewError("blocked", "Private or reserved IP addresses are not allowed.");
    return;
  }
  if (!host.includes(".")) throw new PreviewError("invalid_url", "Enter a public website hostname (for example example.com).");
}

/** Hostname without IPv6 brackets, lower-cased, without a trailing dot. */
function hostnameOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

/** Resolve the host and refuse if ANY of its addresses is non-public. */
export async function assertPublicHost(url: URL): Promise<void> {
  const host = hostnameOf(url);
  if (isIP(host)) return; // literal, already checked synchronously
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    throw new PreviewError("fetch_failed", code === "ENOTFOUND" ? `Could not resolve ${host}.` : `DNS lookup for ${host} failed.`);
  }
  if (!addresses.length) throw new PreviewError("fetch_failed", `Could not resolve ${host}.`);
  for (const { address } of addresses) {
    if (isForbiddenAddress(address)) {
      throw new PreviewError("blocked", `${host} resolves to a private or reserved address.`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Address classification                                              */
/* ------------------------------------------------------------------ */

/** True for loopback, private, link-local, CGNAT, unspecified, multicast, reserved and documentation ranges. */
export function isForbiddenAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) return isForbiddenV4(parseV4(address));
  if (v === 6) return isForbiddenV6(address);
  return true; // not an IP at all → refuse
}

function parseV4(address: string): number {
  const parts = address.split(".").map((p) => Number(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inV4(ip: number, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((ip & mask) >>> 0) === ((parseV4(base) & mask) >>> 0);
}

const FORBIDDEN_V4 = [
  "0.0.0.0/8", // "this" network, includes 0.0.0.0
  "10.0.0.0/8", // private
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (cloud metadata lives here)
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved + broadcast
];

function isForbiddenV4(ip: number): boolean {
  return FORBIDDEN_V4.some((cidr) => inV4(ip, cidr));
}

/** Expand an IPv6 textual address into 8 16-bit groups (handles `::` and a trailing dotted IPv4). */
function parseV6(address: string): number[] | null {
  let text = address;
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);
  // Trailing embedded IPv4 (e.g. ::ffff:127.0.0.1) → two hex groups.
  const m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (m) {
    if (isIP(m[2]) !== 4) return null;
    const v4 = parseV4(m[2]);
    text = `${m[1]}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail].map((g) => parseInt(g || "0", 16));
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

function isForbiddenV6(address: string): boolean {
  const g = parseV6(address);
  if (!g) return true;
  const allZero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  const embeddedV4 = ((g[6] << 16) | g[7]) >>> 0;

  if (allZero(0, 8)) return true; // :: unspecified
  if (allZero(0, 7) && g[7] === 1) return true; // ::1 loopback
  if (allZero(0, 5) && g[5] === 0xffff) return isForbiddenV4(embeddedV4); // ::ffff:a.b.c.d IPv4-mapped
  if (allZero(0, 4) && g[4] === 0xffff && g[5] === 0) return isForbiddenV4(embeddedV4); // ::ffff:0:a.b.c.d IPv4-translated
  if (allZero(0, 6)) return isForbiddenV4(embeddedV4); // ::a.b.c.d IPv4-compatible (deprecated)
  if (g[0] === 0x64 && g[1] === 0xff9b && allZero(2, 6)) return isForbiddenV4(embeddedV4); // 64:ff9b::/96 NAT64
  if (g[0] === 0x2002) return isForbiddenV4(((g[1] << 16) | g[2]) >>> 0); // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo (tunnels to arbitrary v4)
  return false;
}

/* ------------------------------------------------------------------ */
/* Guarded fetch                                                       */
/* ------------------------------------------------------------------ */

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface GuardedFetchOptions {
  accept: string;
  timeoutMs: number;
  /** Outer budget; the request aborts when either this or the timeout fires. */
  signal?: AbortSignal;
}

interface GuardedResponse {
  response: Response;
  finalUrl: URL;
  /** The signal the request (and its body stream) is bound to. */
  signal: AbortSignal;
}

function combineSignals(timeoutMs: number, outer?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return outer ? AbortSignal.any([outer, timeout]) : timeout;
}

function describeFetchError(e: unknown): string {
  const cause = (e as { cause?: NodeJS.ErrnoException })?.cause;
  const code = cause?.code ?? (e as NodeJS.ErrnoException)?.code;
  if (code) return `Network error (${code}).`;
  const msg = e instanceof Error ? e.message : String(e);
  return msg && msg !== "fetch failed" ? `Network error: ${msg}` : "Network error while contacting the site.";
}

/**
 * GET `url` with manual redirect handling (≤ 3 hops), re-validating every
 * hop against the SSRF policy. Resolves with a non-redirect response; the
 * caller checks status / content-type and reads the body.
 */
export async function guardedFetch(url: URL, opts: GuardedFetchOptions): Promise<GuardedResponse> {
  const signal = combineSignals(opts.timeoutMs, opts.signal);
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertAllowedUrl(current);
    await assertPublicHost(current);
    if (signal.aborted) throw new PreviewError("timeout", "The site took too long to respond.");

    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: opts.accept,
          "accept-language": "en-US,en;q=0.8",
        },
      });
    } catch (e) {
      if (signal.aborted) throw new PreviewError("timeout", "The site took too long to respond.");
      throw new PreviewError("fetch_failed", describeFetchError(e));
    }

    if (!REDIRECT_STATUSES.has(response.status)) return { response, finalUrl: current, signal };

    const location = response.headers.get("location");
    await response.body?.cancel().catch(() => undefined);
    if (!location) throw new PreviewError("fetch_failed", `Redirect (${response.status}) without a location.`);
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new PreviewError("fetch_failed", "The site sent an invalid redirect.");
    }
    next.hash = "";
    current = next;
  }
  throw new PreviewError("fetch_failed", "Too many redirects.");
}

/**
 * Read a body stream into a buffer. Past `maxBytes` the stream is cancelled and,
 * when `truncate` is set, the bytes so far are returned with `truncated: true`;
 * otherwise `null` (too large) is returned.
 */
async function readBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
  truncate = false,
): Promise<{ bytes: Uint8Array; truncated: boolean } | null> {
  const declared = Number(response.headers.get("content-length"));
  if (!truncate && Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.byteLength > maxBytes) {
        if (!truncate) {
          void reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value.subarray(0, maxBytes - total));
        total = maxBytes;
        truncated = true;
        void reader.cancel().catch(() => undefined);
        break;
      }
      total += value.byteLength;
      chunks.push(value);
    }
  } catch (e) {
    if (signal.aborted) throw new PreviewError("timeout", "The site took too long to respond.");
    throw new PreviewError("fetch_failed", describeFetchError(e));
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return { bytes: out, truncated };
}

function mimeOf(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

function charsetOf(contentType: string | null): string | undefined {
  const m = /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType ?? "");
  return m?.[1]?.toLowerCase();
}

function sniffCharset(bytes: Uint8Array): string | undefined {
  const head = Buffer.from(bytes.subarray(0, 4096)).toString("latin1");
  const m =
    /<meta[^>]+charset\s*=\s*["']?\s*([\w.:-]+)/i.exec(head) ??
    /<\?xml[^>]+encoding\s*=\s*["']([\w.:-]+)["']/i.exec(head);
  return m?.[1]?.toLowerCase();
}

function decodeText(bytes: Uint8Array, charset: string | undefined): string {
  const label = charset && charset !== "utf8" ? charset : "utf-8";
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export interface FetchedHtml {
  /** URL after redirects. */
  url: string;
  html: string;
  status: number;
  contentType: string;
  bytes: number;
  /** True when the page exceeded the read cap and only its first bytes were parsed. */
  truncated: boolean;
}

/** Fetch a page as HTML text, enforcing type, size and time limits. */
export async function fetchHtml(url: URL, outerSignal?: AbortSignal): Promise<FetchedHtml> {
  const { response, finalUrl, signal } = await guardedFetch(url, {
    accept: "text/html,application/xhtml+xml;q=0.9",
    timeoutMs: HTML_TIMEOUT_MS,
    signal: outerSignal,
  });

  if (response.status >= 400) {
    void response.body?.cancel().catch(() => undefined);
    const hint = response.status === 403 || response.status === 429 ? " (the site blocks automated requests)" : "";
    throw new PreviewError("fetch_failed", `The site responded with HTTP ${response.status}${hint}.`);
  }

  const contentType = response.headers.get("content-type");
  const mime = mimeOf(contentType);
  const htmlish = mime === "text/html" || mime === "application/xhtml+xml";
  if (mime && !htmlish) {
    void response.body?.cancel().catch(() => undefined);
    throw new PreviewError("not_html", `The URL returned ${mime}, not an HTML page.`);
  }

  const body = await readBody(response, HTML_MAX_BYTES, signal, true);
  if (!body) throw new PreviewError("too_large", "The page is too large to preview.");
  const { bytes, truncated } = body;

  const html = decodeText(bytes, charsetOf(contentType) ?? sniffCharset(bytes));
  if (!mime && !/^\s*(?:<!doctype\s+html|<html|<head|<body|<!--)/i.test(html.slice(0, 1024))) {
    throw new PreviewError("not_html", "The URL did not return an HTML page.");
  }
  return { url: finalUrl.href, html, status: response.status, contentType: mime || "text/html", bytes: bytes.byteLength, truncated };
}

/* ------------------------------------------------------------------ */
/* Images → data: URIs                                                 */
/* ------------------------------------------------------------------ */

const IMAGE_MIME = /^image\/(png|jpeg|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon|bmp|apng)$/;

function sniffImageMime(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12) return undefined;
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return "image/x-icon";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "image/avif"; // ftyp box
  const head = Buffer.from(b.subarray(0, 256)).toString("latin1").trimStart();
  if (/^(<\?xml|<svg)/i.test(head)) return "image/svg+xml";
  return undefined;
}

/**
 * Fetch an image through the guard and return it as a data: URI. Any
 * failure (blocked, wrong type, too big, timeout) resolves to undefined —
 * images are decoration, never a reason to fail the preview.
 */
export async function fetchImageDataUri(src: string, outerSignal?: AbortSignal): Promise<string | undefined> {
  try {
    if (src.startsWith("data:image/")) {
      return src.length <= IMAGE_MAX_BYTES * 1.4 ? src : undefined;
    }
    const url = new URL(src);
    url.hash = "";
    const { response, signal } = await guardedFetch(url, {
      accept: "image/*,*/*;q=0.5",
      timeoutMs: IMAGE_TIMEOUT_MS,
      signal: outerSignal,
    });
    if (response.status >= 400) {
      await response.body?.cancel().catch(() => undefined);
      return undefined;
    }
    const headerMime = mimeOf(response.headers.get("content-type"));
    if (headerMime && !headerMime.startsWith("image/") && headerMime !== "application/octet-stream") {
      await response.body?.cancel().catch(() => undefined);
      return undefined;
    }
    const bytes = (await readBody(response, IMAGE_MAX_BYTES, signal))?.bytes ?? null;
    if (!bytes || bytes.byteLength === 0) return undefined;
    const sniffed = sniffImageMime(bytes);
    const mime = sniffed ?? (IMAGE_MIME.test(headerMime) ? headerMime : undefined);
    if (!mime || !IMAGE_MIME.test(mime)) return undefined;
    if (mime === "image/svg+xml" && bytes.byteLength > IMAGE_SVG_MAX_BYTES) return undefined;
    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return undefined;
  }
}
