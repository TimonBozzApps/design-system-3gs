/**
 * GET /api/preview?url=<site> — Vercel Function (Node runtime, Web API signature).
 * Turns a website into a `ScreenSpec` for the 3GS renderer. Read-only, CORS-open,
 * CDN-cacheable on success, rate-limited per IP.
 */
import { generatePreview } from "./_lib/preview";
import type { PreviewErrorCode, PreviewResult } from "./_lib/spec";

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

const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;
/** ip → request timestamps within the window (sliding window). */
const hits = new Map<string, number[]>();
let lastSweep = 0;

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
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

function json(body: PreviewResult, status: number, extra: Record<string, string> = {}, includeBody = true): Response {
  return new Response(includeBody ? JSON.stringify(body) : null, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200 ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
      "x-content-type-options": "nosniff",
      ...CORS,
      ...extra,
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return json({ ok: false, code: "invalid_url", error: "Method not allowed. Use GET /api/preview?url=…" }, 405, { allow: "GET, HEAD, OPTIONS" });
  }
  const withBody = req.method === "GET";

  const retryAfter = rateLimited(clientIp(req));
  if (retryAfter) {
    return json(
      { ok: false, code: "rate_limited", error: "Too many previews — try again in a minute." },
      429,
      { "retry-after": String(retryAfter) },
      withBody,
    );
  }

  const url = new URL(req.url).searchParams.get("url") ?? "";
  const result = await generatePreview(url);
  const status = result.ok ? 200 : ERROR_STATUS[result.code] ?? 500;
  return json(result, status, result.ok ? { "x-preview-cache": result.cached ? "hit" : "miss" } : {}, withBody);
}
