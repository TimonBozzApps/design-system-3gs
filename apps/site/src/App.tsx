import { useEffect, useState } from "react";
import { Switch } from "@3gs/ui";
import { PhoneFrame } from "./shell/PhoneFrame";
import { TokensSection } from "./TokensSection";
import { capture, trackOutboundClicks, trackSectionViews } from "./analytics";
import { AppStoreScreen } from "./shell/AppStoreScreen";
import { PropsTable } from "./PropsTable";
import { demos } from "./demos";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

type Theme = "dark" | "light";

function readTheme(): Theme {
  // ?theme=light|dark wins (handy for screenshots), then the remembered choice.
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (fromUrl === "light" || fromUrl === "dark") return fromUrl;
  try {
    return localStorage.getItem("gs-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function App() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [dir, setDir] = useState<"ltr" | "rtl">(() =>
    new URLSearchParams(window.location.search).get("dir") === "rtl" ? "rtl" : "ltr",
  );
  useEffect(() => {
    try {
      localStorage.setItem("gs-theme", theme);
    } catch {
      /* private mode etc. */
    }
  }, [theme]);

  // Analytics (no-ops unless VITE_POSTHOG_KEY is set — see analytics.ts).
  useEffect(() => {
    const stopSections = trackSectionViews();
    const stopOutbound = trackOutboundClicks();
    return () => {
      stopSections();
      stopOutbound();
    };
  }, []);

  return (
    <div className="site">
      <aside className="site__nav">
        <a className="site__brand" href="#top">
          <span className="site__brand-mark">3GS</span>
          <span className="site__brand-text">UI</span>
        </a>
        <label className="site__theme">
          <span>Light theme</span>
          <Switch
            checked={theme === "light"}
            onChange={(on) => {
              const next = on ? "light" : "dark";
              setTheme(next);
              capture("theme_changed", { theme: next });
            }}
            label="Light theme"
            onLabel="ON"
            offLabel="OFF"
          />
        </label>
        <label className="site__theme">
          <span>Right-to-left</span>
          <Switch
            checked={dir === "rtl"}
            onChange={(on) => {
              const next = on ? "rtl" : "ltr";
              setDir(next);
              capture("direction_changed", { dir: next });
            }}
            label="Right-to-left"
            onLabel="RTL"
            offLabel="LTR"
          />
        </label>
        <nav>
          <ul>
            <li>
              <a href="#tokens">Tokens</a>
            </li>
            {demos.map(({ meta }) => (
              <li key={meta.title}>
                <a href={`#${slug(meta.title)}`}>{meta.title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="site__nav-foot">
          React · lucide-react · CSS tokens
        </p>
      </aside>

      <main className="site__main" id="top">
        <header className="hero">
          <div className="hero__text">
            <p className="hero__eyebrow">Design system</p>
            <h1>
              The 2009 glass, <br />
              back in <em>dark mode</em>.
            </h1>
            <p className="hero__lede">
              A React component library that reproduces the iPhone 3GS / iOS 3
              look: gel gradients with the hard 50&nbsp;% highlight, 1&nbsp;px
              black outlines with an inner light rim, embossed type — recast on
              black glass. Icons are lucide, tinted through an SVG gradient.
            </p>
            <pre className="hero__install"><code>pnpm add @3gs/ui{"\n"}import "@3gs/ui/styles.css";</code></pre>
            <p className="hero__note">
              The phone on the right is the App Store “Categories” screen rebuilt
              from the library — tap a row.
            </p>
          </div>
          <div className="hero__phone">
            <PhoneFrame theme={theme} dir={dir}>
              <AppStoreScreen />
            </PhoneFrame>
          </div>
        </header>

        <TokensSection theme={theme} />

        {demos.map(({ meta, default: Demo }) => (
          <section className="demo" id={slug(meta.title)} key={meta.title}>
            <div className="demo__text">
              <h2>{meta.title}</h2>
              <p>{meta.description}</p>
              <pre className="demo__usage"><code>{meta.usage}</code></pre>
              <PropsTable propTypes={meta.propTypes} notes={meta.props} />
            </div>
            <div className="demo__phone">
              <PhoneFrame theme={theme} dir={dir}>
                <Demo />
              </PhoneFrame>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
