import { toPng } from "html-to-image";

/** Everything is inlined (data: URIs, system fonts) — only scripts have no business in the clone. */
const skipScripts = (node: HTMLElement) => node.tagName !== "SCRIPT";

let standardProps: string[] | undefined;

/**
 * html-to-image copies every entry of `getComputedStyle(html)` onto every
 * cloned node — including the ~100 `--gs-*` / `--site-*` custom properties
 * declared on `:root`, whose long gradient strings triple the size of the
 * intermediate SVG (3.3 MB for the phone) and the time to rasterise it.
 * Computed values are already `var()`-resolved, so the clones don't need them.
 */
function standardStyleProperties(): string[] {
  standardProps ??= Array.from(getComputedStyle(document.documentElement)).filter((p) => !p.startsWith("--"));
  return standardProps;
}

/**
 * Rasterise `el` at 2× and trigger a download. Throws an `Error` with a
 * human-readable message when the browser refuses (tainted canvas, a
 * cross-origin image that slipped through, a too-large surface, …) so the
 * caller can show it. Takes a couple of seconds; the tab must be visible
 * (html-to-image waits for an animation frame).
 */
export async function downloadPng(el: HTMLElement, filename: string): Promise<void> {
  let dataUrl: string;
  try {
    dataUrl = await toPng(el, {
      pixelRatio: 2,
      cacheBust: true,
      filter: skipScripts,
      includeStyleProperties: standardStyleProperties(),
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Couldn't render the PNG (${reason || "unknown error"}).`);
  }
  if (!dataUrl || dataUrl === "data:,") {
    throw new Error("Couldn't render the PNG (the browser produced an empty image).");
  }

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
