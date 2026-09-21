import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Icon } from "@3gs/ui";
import { Star } from "lucide-react";
import "./TokensSection.css";

export interface TokensSectionProps {
  theme: "dark" | "light";
}

/* ------------------------------------------------------------------------ */
/* gallery definition                                                        */
/* ------------------------------------------------------------------------ */

/** Inline custom properties (`--tk-*`) that the sample CSS reads. */
type Vars = CSSProperties & Record<`--${string}`, string>;

interface CardDef {
  /** Token names shown (and resolved) under the sample, in order. */
  tokens: string[];
  sample: ReactNode;
  /** Take two grid columns and lay the token list out in two columns too. */
  wide?: boolean;
}

interface GroupDef {
  title: string;
  note: string;
  /** Column density of the card grid. */
  grid?: "default" | "wide" | "compact";
  cards: CardDef[];
}

const SAMPLE = "Helvetica Neue";

/** A gel tile: gloss over the gradient, black outline, inner rim. */
function Gel({
  gradient,
  pressed,
  children,
  className = "",
}: {
  gradient: string;
  pressed?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const style: Vars = { "--tk-gel": `var(${gradient})` };
  return (
    <div
      className={`tk-gel${pressed ? " tk-gel--pressed" : ""} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

/** A gradient with its `-pressed` twin next to it. */
function gelPair(gradient: string): CardDef {
  return {
    tokens: [gradient, `${gradient}-pressed`],
    sample: (
      <div className="tk-pair">
        <Gel gradient={gradient} />
        <Gel gradient={`${gradient}-pressed`} pressed />
      </div>
    ),
  };
}

/** A grouped-table cell: text on `--gs-surface`. */
function Cell({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className="tk-cell" style={style}>
      {children}
    </div>
  );
}

function swatch(token: string): CardDef {
  const style: Vars = { "--tk-swatch": `var(${token})` };
  return { tokens: [token], sample: <span className="tk-swatch" style={style} /> };
}

function radius(token: string, pill = false): CardDef {
  const style: Vars = { "--tk-radius": `var(${token})` };
  return {
    tokens: [token],
    sample: <span className={`tk-radius${pill ? " tk-radius--pill" : ""}`} style={style} />,
  };
}

function sizeBar(
  token: string,
  label: string,
  gradient: string,
  opts: { neutral?: boolean; extraTokens?: string[] } = {},
): CardDef {
  const style: Vars = { "--tk-h": `var(${token})`, "--tk-gel": `var(${gradient})` };
  return {
    tokens: [token, ...(opts.extraTokens ?? [])],
    sample: (
      <div
        className={`tk-bar-sample${opts.neutral ? " tk-bar-sample--neutral" : ""}`}
        style={style}
      >
        {label}
      </div>
    ),
  };
}

function fontSize(token: string): CardDef {
  const style: Vars = { "--tk-size": `var(${token})` };
  return {
    tokens: [token],
    sample: (
      <span className="tk-type" style={style}>
        {SAMPLE}
      </span>
    ),
  };
}

const GROUPS: GroupDef[] = [
  {
    title: "Gel gradients",
    note: "Every control is the gloss (hard 50 % split) layered over one of these gels, with --gs-border and --gs-emboss around it. Pressed twins lose the gloss and sink.",
    grid: "wide",
    cards: [
      {
        tokens: ["--gs-gradient-bar", "--gs-bar-border", "--gs-bar-rim"],
        sample: <div className="tk-bar-tile" />,
      },
      gelPair("--gs-gradient-barbutton"),
      gelPair("--gs-gradient-neutral"),
      gelPair("--gs-gradient-dark"),
      gelPair("--gs-gradient-blue"),
      gelPair("--gs-gradient-red"),
      {
        tokens: ["--gs-gloss", "--gs-gloss-soft"],
        sample: (
          <div className="tk-pair">
            <Gel gradient="--tk-flat-gray" className="tk-gel--flat" />
            <Gel gradient="--tk-flat-gray" className="tk-gel--flat tk-gel--soft" />
          </div>
        ),
      },
    ],
  },
  {
    title: "Surfaces",
    note: "The screen, the grouped-table pinstripe it shows through, and the cell surfaces that sit on it.",
    cards: [
      {
        tokens: ["--gs-screen-bg"],
        sample: <span className="tk-fill" style={{ background: "var(--gs-screen-bg)" }} />,
      },
      { tokens: ["--gs-pinstripe-bg"], sample: null },
      { tokens: ["--gs-surface"], sample: <Cell /> },
      {
        tokens: ["--gs-surface-raised"],
        sample: <Cell style={{ background: "var(--gs-surface-raised)" }} />,
      },
      {
        tokens: ["--gs-surface-sunken", "--gs-inset"],
        sample: <div className="tk-cell tk-cell--sunken" />,
      },
      {
        tokens: ["--gs-separator", "--gs-separator-light"],
        sample: (
          <div className="tk-cell tk-cell--rows">
            <span />
            <span />
          </div>
        ),
      },
      {
        tokens: ["--gs-surface-gloss"],
        sample: <div className="tk-cell tk-cell--gloss" />,
      },
    ],
  },
  {
    title: "Palette",
    note: "The raw scale. Components read the semantic tokens below instead, so a theme can retint them.",
    grid: "compact",
    cards: [
      ...[900, 800, 700, 600, 500, 400, 300, 200, 100].map((n) => swatch(`--gs-gray-${n}`)),
      ...[100, 300, 500, 700, 900].map((n) => swatch(`--gs-blue-${n}`)),
      ...[300, 500, 700].map((n) => swatch(`--gs-red-${n}`)),
      swatch("--gs-green-500"),
    ],
  },
  {
    title: "Text",
    note: "Type on cells is embossed: white on dark gel throws a shadow upward, black on light gel a highlight downward.",
    cards: [
      {
        tokens: ["--gs-text", "--gs-text-emboss"],
        sample: (
          <Cell>
            <span className="tk-text tk-text--strong">Settings</span>
          </Cell>
        ),
      },
      {
        tokens: ["--gs-text-secondary"],
        sample: (
          <Cell>
            <span className="tk-text" style={{ color: "var(--gs-text-secondary)" }}>
              Settings
            </span>
          </Cell>
        ),
      },
      {
        tokens: ["--gs-text-tertiary"],
        sample: (
          <Cell>
            <span className="tk-text" style={{ color: "var(--gs-text-tertiary)" }}>
              Settings
            </span>
          </Cell>
        ),
      },
      {
        tokens: ["--gs-text-link"],
        sample: (
          <Cell>
            <span className="tk-text" style={{ color: "var(--gs-text-link)" }}>
              Settings
            </span>
          </Cell>
        ),
      },
      {
        tokens: ["--gs-text-disabled"],
        sample: (
          <Cell>
            <span className="tk-text" style={{ color: "var(--gs-text-disabled)" }}>
              Settings
            </span>
          </Cell>
        ),
      },
      {
        tokens: ["--gs-header-text"],
        sample: <span className="tk-text tk-text--header">SETTINGS</span>,
      },
      {
        tokens: ["--gs-text-on-bar", "--gs-text-shadow-on-bar"],
        sample: (
          <div className="tk-bar-tile">
            <span className="tk-text tk-text--on-bar">Settings</span>
          </div>
        ),
      },
      {
        tokens: ["--gs-text-on-neutral", "--gs-text-shadow-on-neutral"],
        sample: (
          <Gel gradient="--gs-gradient-neutral">
            <span className="tk-text tk-text--on-neutral">Sign Out</span>
          </Gel>
        ),
      },
    ],
  },
  {
    title: "Rims & shadows",
    note: "The 1 px inner light rim and the black drop edge that make a gel feel raised; the inset that makes a well feel sunk.",
    cards: [
      {
        tokens: ["--gs-emboss"],
        sample: <span className="tk-box" style={{ boxShadow: "var(--gs-emboss)" }} />,
      },
      {
        tokens: ["--gs-rim-light", "--gs-rim-dark"],
        sample: (
          <div className="tk-pair tk-pair--narrow">
            <span className="tk-box" style={{ boxShadow: "var(--gs-rim-light)" }} />
            <span className="tk-box" style={{ boxShadow: "var(--gs-rim-dark)" }} />
          </div>
        ),
      },
      {
        tokens: ["--gs-inset"],
        sample: (
          <span
            className="tk-box"
            style={{ background: "var(--gs-surface-sunken)", boxShadow: "var(--gs-inset)" }}
          />
        ),
      },
      {
        tokens: ["--gs-shadow-pop"],
        sample: <span className="tk-box tk-box--pop" />,
      },
      {
        tokens: ["--gs-focus-ring"],
        sample: (
          <Gel gradient="--gs-gradient-neutral" className="tk-gel--focus" />
        ),
      },
      {
        tokens: ["--gs-border"],
        sample: <span className="tk-box tk-box--outline" style={{ border: "var(--gs-border)" }} />,
      },
      {
        tokens: ["--gs-border-light"],
        sample: (
          <span className="tk-box tk-box--outline" style={{ border: "var(--gs-border-light)" }} />
        ),
      },
    ],
  },
  {
    title: "Radii & sizing",
    note: "Corner radii for buttons, grouped cells and pills; the fixed heights of controls and bars.",
    cards: [
      radius("--gs-radius-sm"),
      radius("--gs-radius-md"),
      radius("--gs-radius-lg"),
      radius("--gs-radius-pill", true),
      sizeBar("--gs-control-height", "Control", "--gs-gradient-neutral", { neutral: true }),
      sizeBar("--gs-bar-height", "Nav bar", "--gs-gradient-bar"),
      sizeBar("--gs-tabbar-height", "Tab bar", "--gs-gradient-dark"),
      sizeBar("--gs-statusbar-height", "Status", "--gs-statusbar-gradient", {
        extraTokens: ["--gs-statusbar-gradient"],
      }),
      {
        tokens: [1, 2, 3, 4, 5].map((n) => `--gs-space-${n}`),
        wide: true,
        sample: (
          <div className="tk-spaces">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ width: `var(--gs-space-${n})`, height: `var(--gs-space-${n})` }} />
            ))}
          </div>
        ),
      },
    ],
  },
  {
    title: "Type",
    note: "One family, five sizes — from tab-bar labels to nav-bar titles.",
    grid: "wide",
    cards: [
      {
        tokens: ["--gs-font", "--gs-line-height"],
        sample: <span className="tk-type tk-type--specimen">Aa</span>,
      },
      fontSize("--gs-font-size-xs"),
      fontSize("--gs-font-size-sm"),
      fontSize("--gs-font-size-md"),
      fontSize("--gs-font-size-lg"),
      fontSize("--gs-font-size-xl"),
    ],
  },
  {
    title: "Icon gradients",
    note: "lucide strokes are painted through an SVG gradient with the same 50 % split; <Icon> reads these four stops.",
    cards: [
      {
        tokens: ["--gs-icon-inactive-top", "--gs-icon-inactive-bottom"],
        sample: (
          <Gel gradient="--gs-gradient-dark" className="tk-gel--icon">
            <Icon icon={Star} variant="gloss" size={32} label="Inactive icon" />
          </Gel>
        ),
      },
      {
        tokens: ["--gs-icon-active-top", "--gs-icon-active-bottom"],
        sample: (
          <Gel gradient="--gs-gradient-dark" className="tk-gel--icon">
            <Icon icon={Star} variant="active" size={32} label="Active icon" />
          </Gel>
        ),
      },
    ],
  },
];

const ALL_TOKENS = Array.from(
  new Set(GROUPS.flatMap((g) => g.cards.flatMap((c) => c.tokens))),
);

const MAX_VALUE_CHARS = 60;

function truncate(value: string): string {
  return value.length > MAX_VALUE_CHARS ? `${value.slice(0, MAX_VALUE_CHARS - 1)}…` : value;
}

/* ------------------------------------------------------------------------ */
/* component                                                                 */
/* ------------------------------------------------------------------------ */

const USAGE = `import "@3gs/ui/styles.css";

/* dark (default) */
<div className="gs-root">…</div>

/* the classic iOS 3 light look */
<div className="gs-root" data-theme="light">…</div>

/* retint anything: override a token on the root */
.gs-root {
  --gs-gradient-blue: linear-gradient(#ffb36b, #d9541f);
}`;

export function TokensSection({ theme }: TokensSectionProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  // Read the resolved value of every token off the canvas itself, so the
  // labels always describe exactly what the swatches are showing.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const computed = getComputedStyle(canvas);
    const next: Record<string, string> = {};
    for (const name of ALL_TOKENS) {
      next[name] = computed.getPropertyValue(name).trim().replace(/\s+/g, " ");
    }
    setValues(next);
  }, [theme]);

  return (
    <section className="demo tokens" id="tokens">
      <div className="demo__text">
        <h2>Tokens</h2>
        <p>
          Every colour, gel, rim, radius and size in the library is a CSS custom
          property prefixed <code>--gs-</code>, declared once on{" "}
          <code>:root</code>. Components never hard-code a value; they compose
          tokens — a button is <code>--gs-gloss</code> over a gradient, inside{" "}
          <code>--gs-border</code>, lifted by <code>--gs-emboss</code>.
        </p>
        <p>
          Theming is just re-declaring tokens. Wrap your UI in{" "}
          <code>.gs-root</code> for the dark default, add{" "}
          <code>data-theme="light"</code> for the original blue-gray iOS 3
          chrome, or override any <code>--gs-*</code> on the root to retint a
          single control or the whole system.
        </p>
        <pre className="demo__usage">
          <code>{USAGE}</code>
        </pre>
      </div>

      <div className="tokens__gallery">
        <p className="tokens__hint">
          Rendered live from the {theme} theme — flip the switch in the sidebar
          and every swatch and value below re-resolves.
        </p>
        <div ref={canvasRef} className="gs-root tokens__canvas" data-theme={theme}>
          {GROUPS.map((group) => (
            <div className="tokens__group" key={group.title}>
              <h3 className="tokens__group-title">{group.title}</h3>
              <p className="tokens__group-note">{group.note}</p>
              <div className={`tokens__grid tokens__grid--${group.grid ?? "default"}`}>
                {group.cards.map((card) => (
                  <div
                    className={`tokens__card${card.wide ? " tokens__card--wide" : ""}`}
                    key={card.tokens.join()}
                  >
                    <div className="tokens__stage">{card.sample}</div>
                    <dl className="tokens__meta">
                      {card.tokens.map((name) => (
                        <div className="tokens__token" key={name}>
                          <dt>
                            <code>{name}</code>
                          </dt>
                          <dd title={values[name]}>{truncate(values[name] ?? "")}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
