/**
 * Orchestrator: validate → fetch → extract → map → cache.
 *
 * `generatePreview` never rejects; every failure becomes a `PreviewResult`
 * with a `PreviewErrorCode` so the handler and the dev middleware can map it
 * to an HTTP status.
 */
import { LruCache } from "./cache.js";
import { extract } from "./extract.js";
import { fetchHtml, fetchImageDataUri, isPreviewError, normalizeUrl } from "./fetch.js";
import { mapToSpec } from "./map.js";
import type { PreviewResult, ScreenSpec } from "./spec.js";

const CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Whole-preview budget; the page fetch alone may use up to 8 s of it. */
const TOTAL_BUDGET_MS = 12_000;
/** How many icon candidates to try (in parallel) before giving up. */
const ICON_ATTEMPTS = 3;

const cache = new LruCache<ScreenSpec>(CACHE_ENTRIES, CACHE_TTL_MS);
/** Coalesces concurrent requests for the same URL into one fetch. */
const inflight = new Map<string, Promise<ScreenSpec>>();

/** Cache key: normalised URL (scheme + lower-case host + path + query, no hash, no trailing-slash noise). */
function cacheKey(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
}

export async function generatePreview(input: string): Promise<PreviewResult> {
  const started = Date.now();
  const ms = () => Date.now() - started;

  let target: URL;
  try {
    target = normalizeUrl(input);
  } catch (e) {
    return toError(e);
  }

  const key = cacheKey(target);
  const hit = cache.get(key);
  if (hit) return { ok: true, spec: hit, cached: true, ms: ms() };

  const pending = inflight.get(key);
  if (pending) {
    try {
      return { ok: true, spec: await pending, cached: true, ms: ms() };
    } catch (e) {
      return toError(e);
    }
  }

  const job = build(target).finally(() => inflight.delete(key));
  inflight.set(key, job);
  try {
    const spec = await job;
    cache.set(key, spec);
    return { ok: true, spec, cached: false, ms: ms() };
  } catch (e) {
    return toError(e);
  }
}

async function build(target: URL): Promise<ScreenSpec> {
  const budget = AbortSignal.timeout(TOTAL_BUDGET_MS);

  const page = await fetchHtml(target, budget);
  const extracted = extract(page.html, page.url);

  // Images are decoration: fetch them in parallel, bounded by the remaining budget, never fatal.
  const [iconDataUri, imageDataUri] = await Promise.all([
    pickIcon(extracted.iconCandidates, budget),
    extracted.imageUrl ? fetchImageDataUri(extracted.imageUrl, budget) : Promise.resolve(undefined),
  ]);

  const spec = mapToSpec(extracted, { iconDataUri, imageDataUri });
  if (page.truncated) spec.notes = [...spec.notes, "Large page — only the first 4 MB was read."].slice(0, 3);
  return spec;
}

/** Try the best few icon candidates concurrently and keep the highest-ranked one that worked. */
async function pickIcon(candidates: string[], signal: AbortSignal): Promise<string | undefined> {
  const results = await Promise.all(candidates.slice(0, ICON_ATTEMPTS).map((c) => fetchImageDataUri(c, signal)));
  return results.find((r): r is string => Boolean(r));
}

function toError(e: unknown): PreviewResult {
  if (isPreviewError(e)) return { ok: false, code: e.code, error: e.message };
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return { ok: false, code: "timeout", error: "The preview took too long to generate." };
  }
  return { ok: false, code: "fetch_failed", error: "Could not generate a preview for that site." };
}
