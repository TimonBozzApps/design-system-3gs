/**
 * GET /api/image?url=<page> — the unfurl card for a share page.
 *
 * `og:image` can't be a `data:` URI, but that is exactly what a `ScreenSpec`
 * carries, so this re-serves the spec's already-fetched, already-guarded
 * `imageDataUri` as real bytes. `generatePreview` is cached, so the usual cost
 * is a map lookup and a base64 decode. No image (or an SVG, which would be
 * active content on our own origin) → redirect to the static /og.png card.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { generatePreview } from "./_lib/preview.js";

export const config = { maxDuration: 20 };

const FALLBACK = "/og.png";
/** SVG is scriptable; serving a remote one from this origin would be an XSS. */
const ALLOWED_MIME = /^image\/(png|jpeg|gif|webp|avif|x-icon|vnd\.microsoft\.icon|bmp|apng)$/;

/* Rate limiting — same sliding window as /api/preview. */
const RATE_LIMIT = 60; // scrapers fan out; the work per hit is a cache lookup
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

/** `data:image/png;base64,…` → bytes. Undefined for anything we won't serve. */
function decodeDataUri(uri: string): { mime: string; bytes: Buffer } | undefined {
  const match = /^data:([^;,]+)((?:;[^,]*)*),([\s\S]*)$/.exec(uri);
  if (!match) return undefined;
  const mime = match[1].toLowerCase();
  if (!ALLOWED_MIME.test(mime)) return undefined;
  const base64 = /;base64/i.test(match[2]);
  const bytes = base64 ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return bytes.byteLength > 0 ? { mime, bytes } : undefined;
}

function redirect(res: ServerResponse, cache: string): void {
  res.statusCode = 302;
  res.setHeader("location", FALLBACK);
  res.setHeader("cache-control", cache);
  res.end();
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("allow", "GET, HEAD");
    res.end();
    return;
  }

  if (rateLimited(clientIp(req))) {
    redirect(res, "no-store");
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost").searchParams.get("url") ?? "";
  const result = url ? await generatePreview(url) : undefined;
  const image = result?.ok && result.spec.imageDataUri ? decodeDataUri(result.spec.imageDataUri) : undefined;
  if (!image) {
    // Short TTL: a transient failure shouldn't pin the generic card for a day.
    redirect(res, "public, s-maxage=3600");
    return;
  }

  res.statusCode = 200;
  res.setHeader("content-type", image.mime);
  res.setHeader("content-length", String(image.bytes.byteLength));
  res.setHeader("cache-control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("content-security-policy", "default-src 'none'; sandbox");
  res.setHeader("access-control-allow-origin", "*");
  res.end(method === "GET" ? image.bytes : undefined);
}
