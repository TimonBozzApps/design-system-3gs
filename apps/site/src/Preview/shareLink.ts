/**
 * The `/p/<site>` share link: one phone, no docs, nice unfurl.
 * Server twin of the parsing rules: `api/share.ts` (`siteFromUrl`).
 */

/** Hosts and paths that stay readable in a URL; anything else is percent-encoded. */
const PRETTY = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[\w\-./~%+]*)?$/i;

/** Absolute URL of the standalone page for `siteUrl` (`vercel.com` → `https://…/p/vercel.com`). */
export function shareUrlFor(siteUrl: string, origin: string = window.location.origin): string {
  const raw = (siteUrl ?? "").trim();
  const bare = raw.replace(/^https:\/\//i, "").replace(/\/+$/, "");
  return `${origin}/p/${PRETTY.test(bare) ? bare : encodeURIComponent(raw)}`;
}

function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // a stray % — take it literally
  }
}

/**
 * The site this share page is about, read from `/p/…` (percent-encoded or
 * not) with `?site=` / `?url=` as the fallback.
 */
export function siteFromLocation(location: { pathname: string; search: string } = window.location): string {
  const match = /^\/p\/(.+)$/.exec(location.pathname);
  const params = new URLSearchParams(location.search);
  const raw = (match ? decodeOnce(match[1]) : "") || params.get("site") || params.get("url") || "";
  return raw.trim().replace(/^(https?):\/+/i, "$1://");
}

/** Best-effort host for titles, the status bar and analytics — never throws. */
export function hostOf(input: string): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch {
    return raw.split(/[/?#]/)[0] ?? "";
  }
}

/**
 * Status-bar carrier text. The bar is 320 px wide and shares it with the 3G
 * glyph, the clock and the battery, so a long host is dropped rather than
 * squeezing the clock ("news.ycombinator.com" → no carrier).
 */
export function carrierFor(host: string): string | undefined {
  const name = host.replace(/^www\./i, "");
  return name && name.length <= 13 ? name : undefined;
}
