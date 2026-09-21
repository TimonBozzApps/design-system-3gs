import { useEffect, useState } from "react";
import { Switch } from "@3gs/ui";
import { PhoneFrame } from "./shell/PhoneFrame";
import { TokensSection } from "./TokensSection";
import { AppStoreScreen } from "./shell/AppStoreScreen";
import { demos } from "./demos";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

type Theme = "dark" | "light";

function readTheme(): Theme {
  try {
    return localStorage.getItem("gs-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function App() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    try {
      localStorage.setItem("gs-theme", theme);
    } catch {
      /* private mode etc. */
    }
  }, [theme]);

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
            onChange={(on) => setTheme(on ? "light" : "dark")}
            label="Light theme"
            onLabel="ON"
            offLabel="OFF"
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
            <PhoneFrame theme={theme}>
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
              {meta.props && meta.props.length > 0 && (
                <dl className="demo__props">
                  {meta.props.map((p) => (
                    <div key={p.name} className="demo__prop">
                      <dt>
                        <code>{p.name}</code>
                      </dt>
                      <dd>
                        <code className="demo__prop-type">{p.type}</code>
                        {p.note && <span className="demo__prop-note">{p.note}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <div className="demo__phone">
              <PhoneFrame theme={theme}>
                <Demo />
              </PhoneFrame>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
