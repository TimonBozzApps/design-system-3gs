import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, HUD } from "@3gs/ui";
import type { PreviewErrorCode, PreviewResult, ScreenSpec } from "../../../../api/_lib/spec";
import { capture } from "../analytics";
import { PhoneFrame } from "../shell/PhoneFrame";
import { downloadPng } from "./exportPng";
import { FIXTURE } from "./fixture";
import { SpecScreen, normalizeSpec, urlKey } from "./SpecScreen";
import { carrierFor, shareUrlFor } from "./shareLink";
import { specToJsx } from "./specToJsx";
import "./PreviewSection.css";

export interface PreviewSectionProps {
  theme: "dark" | "light";
  dir: "ltr" | "rtl";
}

const EXAMPLES = ["vercel.com", "posthog.com", "github.com", "stripe.com", "news.ycombinator.com"];

/** Deepest the phone's navigation stack goes; beyond it the oldest pushed screen is dropped. */
const MAX_STACK = 8;

/**
 * `root`: a new site — the stack restarts with its front page.
 * `push`: a link on the current screen — appended, reachable with Back.
 * `replaceRoot`: a tab — swaps the whole stack for that page (the tab bar stays).
 */
type NavMode = "root" | "push" | "replaceRoot";

const ERROR_MESSAGES: Record<PreviewErrorCode, string> = {
  invalid_url: "That doesn't look like a URL.",
  blocked: "That address isn't allowed (private or local).",
  timeout: "The site took too long to answer.",
  too_large: "That page is too big to preview.",
  not_html: "That URL isn't a web page.",
  rate_limited: "Slow down — try again in a minute.",
  fetch_failed: "The site didn't answer (bot-blocked or offline).",
};

const isErrorCode = (code: unknown): code is PreviewErrorCode =>
  typeof code === "string" && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code);

/** Best-effort host for analytics and file names — never throws, never empty. */
function hostOf(input: string): string {
  const raw = input.trim();
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "") || raw;
  } catch {
    return raw.split(/[/?#]/)[0] || "site";
  }
}

const fileSafe = (host: string) => host.replace(/[^a-z0-9.-]+/gi, "_").replace(/^_+|_+$/g, "") || "site";

/**
 * The share param, read on mount and written after each successful preview.
 * It is `?site=` rather than `?url=` because Vite's dev server claims any
 * `?url` query for its URL-import feature (`urlRE = /[?&]url\b/`) and answers
 * `/?url=…` with a 403 — `?url=` is still accepted when reading, so either
 * spelling of a shared link works.
 */
const SHARE_PARAM = "site";

function readShareParam(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(SHARE_PARAM) ?? params.get("url") ?? "";
}

function writeShareParam(url: string) {
  const next = new URL(window.location.href);
  next.searchParams.delete("url"); // legacy name; Vite reserves ?url in dev
  next.searchParams.set(SHARE_PARAM, url);
  window.history.replaceState(window.history.state, "", next);
}

export function PreviewSection({ theme, dir }: PreviewSectionProps) {
  /** The site's front page: its tabs stay on every screen, its URL decides what "internal" means. */
  const [home, setHome] = useState<ScreenSpec>(FIXTURE);
  /** The navigation stack; `stack[0]` is the tab's root, the last entry is on screen. */
  const [stack, setStack] = useState<ScreenSpec[]>([FIXTURE]);
  const [tab, setTab] = useState<string | undefined>(() => normalizeSpec(FIXTURE).tabs[0]?.value);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PreviewErrorCode | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const phoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  /** Pages already fetched for this site, so tabs and Back-and-forth are instant. Reset per site. */
  const cacheRef = useRef(new Map<string, ScreenSpec>([[urlKey(FIXTURE.url), FIXTURE]]));

  const spec = stack[stack.length - 1];
  const previousTitle = stack.length > 1 ? normalizeSpec(stack[stack.length - 2]).title : undefined;
  const rootTabs = useMemo(() => normalizeSpec(home).tabs, [home]);
  const jsx = useMemo(() => specToJsx(spec), [spec]);
  const carrier = useMemo(() => carrierFor(home.host || ""), [home.host]);

  /** Drop an in-flight fetch — a newer navigation supersedes it. */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const show = useCallback(
    (fetched: ScreenSpec, mode: NavMode) => {
      if (mode === "root") {
        setHome(fetched);
        setStack([fetched]);
        setTab(normalizeSpec(fetched).tabs[0]?.value);
        return;
      }
      // Sub-pages usually reuse the site-wide og:image; don't repeat the home hero on every screen.
      const next = fetched.imageDataUri && fetched.imageDataUri === home.imageDataUri ? { ...fetched, imageDataUri: undefined } : fetched;
      if (mode === "replaceRoot") setStack([next]);
      else setStack((s) => (s.length >= MAX_STACK ? [s[0], ...s.slice(2), next] : [...s, next]));
    },
    [home.imageDataUri],
  );

  const load = useCallback(
    async (input: string, mode: NavMode) => {
      const host = hostOf(input);
      cancel();
      setError(null);
      setActionError(null);

      const key = urlKey(input);
      const cached = mode === "root" ? undefined : cacheRef.current.get(key);
      if (cached) {
        show(cached, mode);
        capture("preview_navigated", { host, mode, cached: true });
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      let result: PreviewResult;
      try {
        const res = await fetch(`/api/preview?url=${encodeURIComponent(input)}`, { signal: controller.signal });
        result = (await res.json()) as PreviewResult;
      } catch (cause) {
        if (controller.signal.aborted) return; // superseded by a newer navigation
        result = { ok: false, code: "fetch_failed", error: cause instanceof Error ? cause.message : String(cause) };
      }
      if (controller.signal.aborted) return;
      abortRef.current = null;
      setLoading(false);

      if (result && result.ok === true && result.spec && typeof result.spec === "object") {
        const next = result.spec;
        if (mode === "root") cacheRef.current.clear(); // a new site: forget the old one's pages
        cacheRef.current.set(key, next);
        if (typeof next.url === "string") cacheRef.current.set(urlKey(next.url), next);
        show(next, mode);

        if (mode === "root") {
          writeShareParam(input);
          const n = normalizeSpec(next);
          capture("preview_generated", {
            host: next.host || host,
            generator: next.generator,
            ms: result.ms,
            cached: result.cached,
            tabs: n.tabs.length,
            sections: n.sections.length,
            rows: n.groups.reduce((sum, g) => sum + g.rows.length, 0),
          });
        } else {
          capture("preview_navigated", { host: next.host || host, mode, cached: false });
        }
      } else {
        const code: PreviewErrorCode = result && !result.ok && isErrorCode(result.code) ? result.code : "fetch_failed";
        setError(code);
        capture("preview_failed", { code, host, mode });
      }
    },
    [cancel, show],
  );

  const submit = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      capture("preview_requested", { host: hostOf(input) });
      void load(input, "root");
    },
    [load],
  );

  // A shared link (`?site=` / `?url=`) previews itself on load.
  useEffect(() => {
    const initial = readShareParam();
    if (initial) {
      setUrl(initial);
      submit(initial);
    }
    return () => {
      abortRef.current?.abort();
      window.clearTimeout(copiedTimer.current);
    };
  }, [submit]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      inputRef.current?.focus();
      return;
    }
    submit(url);
  };

  const onExample = (host: string) => {
    capture("preview_example_clicked", { host });
    setUrl(host);
    submit(host);
  };

  /* ---- in-phone navigation ---------------------------------------------- */

  const onNavigate = (href: string) => void load(href, "push");

  const onBack = () => {
    if (stack.length < 2) return;
    cancel();
    setStack((s) => s.slice(0, -1));
    capture("preview_navigated", { host: hostOf(stack[stack.length - 2].url || home.url), mode: "back" });
  };

  const onTab = (value: string, again: boolean) => {
    if (again) {
      // Tapping the selected tab pops its stack to the root, like iOS.
      if (stack.length > 1) {
        cancel();
        setStack((s) => [s[0]]);
        capture("preview_navigated", { host: hostOf(stack[0].url || home.url), mode: "popToRoot" });
      }
      return;
    }
    setTab(value);
    const target = rootTabs.find((t) => t.value === value);
    if (target?.href) void load(target.href, "replaceRoot");
  };

  /* ---- actions under the phone ------------------------------------------ */

  const onDownload = async () => {
    const el = phoneRef.current;
    if (!el) return;
    setActionError(null);
    try {
      await downloadPng(el, `3gs-${fileSafe(hostOf(spec.host || spec.url || "site"))}.png`);
      capture("preview_downloaded", { host: spec.host });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Couldn't export the PNG.");
    }
  };

  const onCopy = async () => {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(jsx);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1500);
      capture("preview_code_copied", { host: spec.host });
    } catch {
      setActionError("Couldn't copy — select the code below instead.");
    }
  };

  const originalHref = /^https?:\/\//i.test(spec.url || "") ? spec.url : `https://${spec.host || home.host || "vercel.com"}/`;
  const notes = Array.isArray(spec.notes) ? spec.notes.filter((n) => typeof n === "string" && n.trim()) : [];

  return (
    <section className="demo preview" id="try-it">
      <div className="demo__text">
        <h2>Try it on your site</h2>
        <p>
          Paste a URL and we rebuild it as a 2009 iPhone app from these components — a caricature, not
          a port. Tap tabs and rows to browse the real site inside the phone.
        </p>

        <form className="preview__form" onSubmit={onSubmit}>
          <label className="preview__label" htmlFor="preview-url">
            Website
          </label>
          <div className="preview__row">
            <input
              ref={inputRef}
              id="preview-url"
              className="preview__input"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="your-startup.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={error === "invalid_url" || undefined}
            />
            <Button type="submit" variant="primary" disabled={loading}>
              3GS-ify
            </Button>
          </div>
        </form>

        <div className="preview__chips" aria-label="Examples">
          <span className="preview__chips-label">Try:</span>
          {EXAMPLES.map((host) => (
            <button
              key={host}
              type="button"
              className="preview__chip"
              onClick={() => onExample(host)}
              disabled={loading}
            >
              {host}
            </button>
          ))}
        </div>
      </div>

      <div className="preview__phone">
        <div ref={phoneRef} className="preview__capture">
          <PhoneFrame theme={theme} dir={dir} statusBar={{ carrier, time: "9:41 AM", network: "3G" }}>
            <SpecScreen
              key={`${stack.length}:${spec.url || spec.host}`}
              spec={spec}
              siteUrl={home.url}
              tabs={rootTabs}
              tab={tab}
              onTab={onTab}
              previousTitle={previousTitle}
              onBack={onBack}
              onNavigate={onNavigate}
            />
            <HUD contained open={loading} kind="loading" title="Loading…" />
            <Alert
              contained
              open={error !== null}
              title="Couldn't fetch that"
              message={error ? ERROR_MESSAGES[error] : undefined}
              actions={[{ label: "OK", variant: "primary" }]}
              onClose={() => setError(null)}
            />
          </PhoneFrame>
        </div>

        {notes.length > 0 && <p className="preview__notes">{notes.join(" · ")}</p>}

        <div className="preview__actions">
          <Button size="sm" onClick={onDownload} disabled={loading}>
            Download PNG
          </Button>
          <Button size="sm" onClick={onCopy} disabled={loading} aria-live="polite">
            {copied ? "Copied" : "Copy JSX"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const link = shareUrlFor(spec.url || spec.host);
              void navigator.clipboard?.writeText(link).catch(() => undefined);
              capture("preview_share_copied", { host: spec.host });
              setShared(true);
              window.setTimeout(() => setShared(false), 1500);
            }}
            disabled={loading}
            aria-live="polite"
            title="A page with just the phone — good for posting"
          >
            {shared ? "Link copied" : "Copy share link"}
          </Button>
          <a className="gs-button gs-button--default gs-button--sm" href={originalHref} target="_blank" rel="noopener noreferrer">
            <span className="gs-button__label">Open original ↗</span>
          </a>
        </div>
        {actionError && (
          <p className="preview__action-error" role="alert">
            {actionError}
          </p>
        )}
      </div>

      <details className="preview__code">
        <summary>Generated JSX</summary>
        <pre className="demo__usage">
          <code>{jsx}</code>
        </pre>
      </details>
    </section>
  );
}
