/**
 * GET /api/preview?url=<site> — Vercel Function (Node runtime, `(req, res)` signature).
 * Turns a website into a `ScreenSpec` for the 3GS renderer. Read-only, CORS-open,
 * CDN-cacheable on success, rate-limited per IP.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { generatePreview } from "./_lib/preview.js";
import type { PreviewErrorCode, PreviewResult } from "./_lib/spec.js";

export const config = { maxDuration: 20 };

const ERROR_STATUS: Record<PreviewErrorCode, number> = {
  invalid_url: 400,
  blocked: 400,
  rate_limited: 429,
  timeout: 504,
  fetch_failed: 502,
  too_large: 413,
  not_html: 415,
};

const RATE_LIMIT = 40; // in-phone navigation makes several calls per visitor
const RATE_WINDOW_MS = 60_000;
/** ip → request timestamps within the window (sliding window). */
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

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD, OPTIONS" };

function send(res: ServerResponse, body: PreviewResult, status: number, extra: Record<string, string> = {}, includeBody = true): void {
  res.statusCode = status;
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": status === 200 ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
    "x-content-type-options": "nosniff",
    ...CORS,
    ...extra,
  };
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(includeBody ? JSON.stringify(body) : undefined);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  if (method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    res.end();
    return;
  }
  if (method !== "GET" && method !== "HEAD") {
    send(res, { ok: false, code: "invalid_url", error: "Method not allowed. Use GET /api/preview?url=…" }, 405, { allow: "GET, HEAD, OPTIONS" });
    return;
  }
  const withBody = method === "GET";

  const retryAfter = rateLimited(clientIp(req));
  if (retryAfter) {
    send(res, { ok: false, code: "rate_limited", error: "Too many previews — try again in a minute." }, 429, { "retry-after": String(retryAfter) }, withBody);
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost").searchParams.get("url") ?? "";
  const result = await generatePreview(url);
  const status = result.ok ? 200 : ERROR_STATUS[result.code] ?? 500;
  send(res, result, status, result.ok ? { "x-preview-cache": result.cached ? "hit" : "miss" } : {}, withBody);
}
