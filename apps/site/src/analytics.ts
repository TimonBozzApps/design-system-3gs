/**
 * PostHog for the showcase — entirely optional and lazy.
 *
 * With no `VITE_POSTHOG_KEY` nothing is loaded: the SDK lives in its own chunk
 * that is only fetched when a key exists, and every `capture()` is a no-op.
 * The key is PostHog's public project token (write-only, meant for browsers);
 * it lives in the environment, never in the repo. Cookieless by design
 * (`persistence: "memory"`, DNT respected, no session recording) so the docs
 * site needs no consent banner.
 */
type PostHogClient = typeof import("posthog-js").default;
type Props = Record<string, string | number | boolean | null | undefined>;

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

export const analyticsEnabled = Boolean(KEY);

let client: PostHogClient | null = null;
const queue: Array<[string, Props | undefined]> = [];

if (KEY) {
  import("posthog-js").then(({ default: ph }) => {
    ph.init(KEY, {
      api_host: HOST,
      defaults: "2026-05-30",
      persistence: "memory",
      respect_dnt: true,
      disable_session_recording: true,
      autocapture: true,
      capture_exceptions: true,
    });
    client = ph;
    for (const [event, props] of queue.splice(0)) ph.capture(event, props);
  });
} else if (import.meta.env.DEV) {
  console.error(
    "VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured",
  );
}

/** Capture an event; queued until the SDK chunk has loaded, dropped when analytics is off. */
export function capture(event: string, props?: Props): void {
  if (!analyticsEnabled) return;
  if (client) client.capture(event, props);
  else queue.push([event, props]);
}

/** Fires once per section per page load when a component section scrolls into view. */
export function trackSectionViews(): () => void {
  if (!analyticsEnabled || typeof IntersectionObserver === "undefined") return () => {};
  const seen = new Set<string>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).id;
        if (e.isIntersecting && id && !seen.has(id)) {
          seen.add(id);
          capture("section_viewed", { section: id });
        }
      }
    },
    { threshold: 0.4 },
  );
  document.querySelectorAll<HTMLElement>("section.demo[id]").forEach((s) => io.observe(s));
  return () => io.disconnect();
}

/** Outbound clicks (npm, GitHub, …) — delegated so demo links need no wiring. */
export function trackOutboundClicks(): () => void {
  if (!analyticsEnabled) return () => {};
  const onClick = (ev: MouseEvent) => {
    const a = (ev.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    let url: URL;
    try {
      url = new URL(a.href, location.href);
    } catch {
      return;
    }
    if (url.origin === location.origin) return;
    capture("outbound_link_clicked", { href: url.href, host: url.host, text: a.textContent?.trim().slice(0, 80) });
  };
  document.addEventListener("click", onClick, { capture: true });
  return () => document.removeEventListener("click", onClick, { capture: true });
}
