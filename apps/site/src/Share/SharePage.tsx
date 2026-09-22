import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, HUD } from "@3gs/ui";
import type { PreviewErrorCode, PreviewResult, ScreenSpec } from "../../../../api/_lib/spec";
import { capture } from "../analytics";
import { PhoneFrame } from "../shell/PhoneFrame";
import { SpecScreen, normalizeSpec } from "../Preview/SpecScreen";
import { hostOf, siteFromLocation } from "../Preview/shareLink";
// The `.spec-*` rules SpecScreen renders against still live next to the docs
// section (hero card, text cells, gel button row). Imported, never edited —
// when they move to a stylesheet SpecScreen imports itself, drop this line.
import "../Preview/PreviewSection.css";
import "./SharePage.css";

/**
 * The standalone `/p/<site>` page: one phone on a dark backdrop, nothing else.
 * Meant to be posted — `api/share.ts` gives the same URL its unfurl meta.
 * The docs page lives in `App`; `main.tsx` picks between them by path.
 */

/** Same texts as the preview section, so both surfaces fail the same way. */
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

/** Deepest the in-phone navigation stack goes. */
const MAX_STACK = 8;

/** An empty screen to sit behind the loading HUD before the spec arrives. */
function blankSpec(host: string): ScreenSpec {
  return {
    url: "",
    host,
    title: host || "3GS UI",
    siteName: host,
    tabs: [],
    sections: [],
    groups: [],
    actions: [],
    notes: [],
    generator: "heuristic",
    generatedAt: "",
  };
}

export function SharePage() {
  const [site] = useState(siteFromLocation);
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const theme = params.get("theme") === "light" ? "light" : "dark";
  const dir = params.get("dir") === "rtl" ? "rtl" : "ltr";

  const [home, setHome] = useState<ScreenSpec | null>(null);
  const [stack, setStack] = useState<ScreenSpec[]>([]);
  const [tab, setTab] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PreviewErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const inputHost = useMemo(() => hostOf(site), [site]);
  const spec = stack[stack.length - 1] ?? blankSpec(inputHost);
  const rootSpec = home ?? spec;
  const rootTabs = useMemo(() => normalizeSpec(rootSpec).tabs, [rootSpec]);
  const previousTitle = stack.length > 1 ? normalizeSpec(stack[stack.length - 2]).title : undefined;

  const host = (spec.host || inputHost).replace(/^www\./, "");
  const carrier = host.length > 18 ? `${host.slice(0, 17)}…` : host || "3GS";
  const originalHref = /^https?:\/\//i.test(spec.url) ? spec.url : host ? `https://${host}/` : "https://design-system-3gs.vercel.app/";

  // The poster backdrop follows ?theme so the page around the phone matches it.
  useEffect(() => {
    document.documentElement.dataset.shareTheme = theme;
    return () => {
      delete document.documentElement.dataset.shareTheme;
    };
  }, [theme]);

  const load = useCallback(async (input: string, mode: "root" | "push" | "replaceRoot") => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setLoading(true);

    let result: PreviewResult;
    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(input)}`, { signal: controller.signal });
      result = (await res.json()) as PreviewResult;
    } catch (cause) {
      if (controller.signal.aborted) return; // superseded, or the page went away
      result = { ok: false, code: "fetch_failed", error: cause instanceof Error ? cause.message : String(cause) };
    }
    if (controller.signal.aborted) return;
    abortRef.current = null;
    setLoading(false);

    if (result && result.ok === true && result.spec && typeof result.spec === "object") {
      const next = result.spec;
      if (mode === "root") {
        setHome(next);
        setStack([next]);
        setTab(normalizeSpec(next).tabs[0]?.value);
      } else if (mode === "replaceRoot") {
        setStack([next]);
      } else {
        setStack((s) => (s.length >= MAX_STACK ? [s[0], ...s.slice(2), next] : [...s, next]));
      }
    } else {
      setError(result && !result.ok && isErrorCode(result.code) ? result.code : "fetch_failed");
    }
  }, []);

  useEffect(() => {
    capture("share_page_viewed", { host: inputHost || "none", theme, dir });
    if (!site) {
      setLoading(false);
      setError("invalid_url");
      return;
    }
    void load(site, "root");
    return () => abortRef.current?.abort();
    // Mount only: the URL doesn't change without a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBack = () => {
    if (stack.length < 2) return;
    abortRef.current?.abort();
    setLoading(false);
    setStack((s) => s.slice(0, -1));
  };

  const onTab = (value: string, again: boolean) => {
    if (again) {
      if (stack.length > 1) setStack((s) => [s[0]]);
      return;
    }
    setTab(value);
    const target = rootTabs.find((t) => t.value === value);
    if (target?.href) void load(target.href, "replaceRoot");
  };

  return (
    <div className="share" data-theme={theme} dir={dir}>
      <header className="share__bar">
        <a className="site__brand share__brand" href="/" aria-label="3GS UI — home">
          <span className="site__brand-mark">3GS</span>
          <span className="site__brand-text">UI</span>
        </a>
      </header>

      <main className="share__stage">
        <div className="share__phone">
          <PhoneFrame theme={theme} dir={dir} statusBar={{ carrier, time: "9:41 AM", network: "3G" }}>
            <SpecScreen
              key={`${stack.length}:${spec.url || spec.host}`}
              spec={spec}
              siteUrl={rootSpec.url || spec.url}
              tabs={rootTabs}
              tab={tab}
              onTab={onTab}
              previousTitle={previousTitle}
              onBack={onBack}
              onNavigate={(href) => void load(href, "push")}
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
      </main>

      <footer className="share__links">
        <a href="/">Made with 3GS UI</a>
        {/* only once a real page answered — the input alone may not be a site at all */}
        {home && (
          <>
            <span className="share__dot" aria-hidden="true">
              ·
            </span>
            <a href={originalHref} target="_blank" rel="noopener noreferrer">
              Open original ↗
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
