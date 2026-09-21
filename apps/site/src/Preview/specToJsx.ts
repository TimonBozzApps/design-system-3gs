import type { ScreenSpec } from "../../../../api/_lib/spec";
import { iconExportName, isKnownIcon } from "./icons";
import { heroGroupCount, normalizeSpec, type NormalizedGroup, type NormalizedRow } from "./SpecScreen";

/* ---- JSX string helpers ------------------------------------------------ */

const DATA_URI = '"data:…"';

/** `name="value"`, switching to `name={"…"}` when the value can't live in a JSX string literal. */
function attr(name: string, value: string | undefined): string | null {
  if (value === undefined) return null;
  return /["\\\n&]/.test(value) ? `${name}={${JSON.stringify(value)}}` : `${name}="${value}"`;
}

/** JSX child text; braces and angle brackets need the expression form. */
function text(value: string): string {
  return /[{}<>&]/.test(value) ? `{${JSON.stringify(value)}}` : value;
}

const LINE_WIDTH = 96;

/**
 * An element with its props on one line when that fits, one per line
 * otherwise. `children` are pre-indented lines; a lone short text child stays
 * inline (`<Button block>Get a Demo</Button>`).
 */
function element(tag: string, props: Array<string | null>, children?: string[], indent = ""): string {
  const ps = props.filter((p): p is string => p !== null);
  const inlineOpen = `${indent}<${tag}${ps.length ? ` ${ps.join(" ")}` : ""}`;
  const fits = inlineOpen.length + 2 <= LINE_WIDTH && !ps.some((p) => p.includes("\n"));
  const open = fits || ps.length === 0 ? inlineOpen : `${indent}<${tag}\n${ps.map((p) => `${indent}  ${p}`).join("\n")}\n${indent}`;
  const selfClose = fits || ps.length === 0 ? " />" : "/>";

  if (!children || children.length === 0) return `${open}${selfClose}`;
  const inlineChild = children.length === 1 ? children[0].trim() : null;
  if (inlineChild && !inlineChild.startsWith("<") && fits && `${open}>${inlineChild}</${tag}>`.length <= LINE_WIDTH) {
    return `${open}>${inlineChild}</${tag}>`;
  }
  return `${open}>\n${children.join("\n")}\n${indent}</${tag}>`;
}

/** `vercel.com` → `VercelScreen`, `news.ycombinator.com` → `NewsYcombinatorScreen`. */
export function componentName(host: string): string {
  const parts = host
    .replace(/^www\./, "")
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
  const labels = parts.length > 1 ? parts.slice(0, -1) : parts;
  const pascal = labels.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
  const safe = /^[a-z]/i.test(pascal) ? pascal : `Site${pascal}`;
  return `${safe || "Site"}Screen`;
}

/* ---- generator --------------------------------------------------------- */

function rowIconProps(row: NormalizedRow, usedIcons: Set<string>): Array<string | null> {
  if (row.imageDataUri) {
    return [`icon={<img src=${DATA_URI} alt="" width={29} height={29} style={{ borderRadius: 6, objectFit: "cover" }} />}`];
  }
  const name = isKnownIcon(row.icon) ? row.icon : "globe";
  usedIcons.add(iconExportName(name));
  // `green` isn't a library tint yet — the phone paints it with a CSS override, the paste-able code uses gray.
  return ["iconTile", `iconTint="${row.tint}"`, `icon={<Icon icon={${iconExportName(name)}} variant="flat" size={18} />}`];
}

/**
 * Turn a spec into the @3gs/ui JSX a developer can paste: the same elements,
 * in the same order and with the same props, as `<SpecScreen>` renders.
 * Data URIs are abbreviated to `"data:…"`.
 */
export function specToJsx(spec: ScreenSpec): string {
  const s = normalizeSpec(spec);
  const components = new Set<string>(["NavigationBar", "BarButton"]);
  const icons = new Set<string>();
  const body: string[] = [];
  const I = "      "; // indent inside the fragment

  body.push(
    element(
      "NavigationBar",
      [
        attr("title", s.title),
        s.iconDataUri ? `left={<img src=${DATA_URI} alt="" width={24} height={24} style={{ borderRadius: 5 }} />}` : null,
        'right={<BarButton variant="done">Done</BarButton>}',
      ],
      undefined,
      I,
    ),
  );

  if (s.search) {
    components.add("SearchBar");
    const scopes =
      s.search.scopes.length > 0
        ? `scopes={[${s.search.scopes.map((v) => `{ value: ${JSON.stringify(v)}, label: ${JSON.stringify(v)} }`).join(", ")}]}`
        : null;
    body.push(element("SearchBar", [attr("placeholder", s.search.placeholder), scopes], undefined, I));
  }

  if (s.imageDataUri) {
    body.push(
      `${I}<img src=${DATA_URI} alt="" width={300} height={150} style={{ display: "block", borderRadius: 8, objectFit: "cover", border: "1px solid #000" }} />`,
    );
  }

  const group = (g: NormalizedGroup) => {
    components.add("List").add("ListItem");
    const rows = g.rows.map((row) => {
      if (!row.imageDataUri) components.add("Icon");
      return element(
        "ListItem",
        [
          ...rowIconProps(row, icons),
          attr("title", row.title),
          attr("subtitle", row.subtitle),
          attr("detail", row.detail),
          row.accessory !== "none" ? attr("accessory", row.accessory) : null,
          attr("href", row.href),
        ],
        undefined,
        `${I}  `,
      );
    });
    body.push(element("List", [attr("header", g.header), attr("footer", g.footer)], rows, I));
  };

  // Same order as the phone: the page's hero row, its content sections, then the link groups.
  const heroGroups = heroGroupCount(s);
  s.groups.slice(0, heroGroups).forEach(group);

  if (s.sections.length > 0) {
    components.add("List").add("ListItem");
    const cells = s.sections.map((section) =>
      element(
        "ListItem",
        [
          attr("title", section.heading),
          attr("subtitle", section.text),
          section.href ? 'accessory="chevron"' : null,
          attr("href", section.href),
        ],
        undefined,
        `${I}  `,
      ),
    );
    body.push(element("List", [], cells, I));
  }

  s.groups.slice(heroGroups).forEach(group);

  for (const action of s.actions) {
    components.add("Button");
    body.push(
      element(
        "Button",
        [
          "block",
          action.variant !== "default" ? `variant="${action.variant}"` : null,
          action.href ? `onClick={() => window.open(${JSON.stringify(action.href)}, "_blank")}` : null,
        ],
        [`${I}  ${text(action.label)}`],
        I,
      ),
    );
  }

  const tabHrefs = s.tabs.filter((tab) => tab.href !== undefined);
  if (s.tabs.length > 0) {
    components.add("TabBar").add("TabBarItem");
    const items = s.tabs.map((tab) => {
      const name = isKnownIcon(tab.icon) ? tab.icon : "globe";
      icons.add(iconExportName(name));
      const badge = tab.badge === undefined ? null : typeof tab.badge === "number" ? `badge={${tab.badge}}` : attr("badge", tab.badge);
      return `${I}  <TabBarItem ${[attr("value", tab.value), `icon={${iconExportName(name)}}`, attr("label", tab.label), badge]
        .filter(Boolean)
        .join(" ")} />`;
    });
    body.push(
      element(
        "TabBar",
        [attr("defaultValue", s.tabs[0].value), tabHrefs.length > 0 ? "onChange={(tab) => TAB_HREFS[tab] && window.open(TAB_HREFS[tab], \"_blank\")}" : null],
        items,
        I,
      ),
    );
  }

  // Where each tab leads on the real site; the phone loads these in place.
  const tabTable =
    tabHrefs.length > 0
      ? `\n// Where each tab leads on the real site.\nconst TAB_HREFS: Record<string, string | undefined> = {\n${tabHrefs
          .map((tab) => `  ${JSON.stringify(tab.value)}: ${JSON.stringify(tab.href)},`)
          .join("\n")}\n};\n`
      : "";

  const imports = [
    `import { ${[...components].sort().join(", ")} } from "@3gs/ui";`,
    icons.size > 0 ? `import { ${[...icons].sort().join(", ")} } from "lucide-react";` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${imports}
${tabTable}
// ${spec.host || "site"} as a 2009 iPhone app — generated by 3GS UI.
// Layout: nav bar (+ search) pinned on top, hero row, content sections, link
// groups and buttons in a scrolling pinstripe body, tab bar pinned to the bottom.
export function ${componentName(spec.host || "")}() {
  return (
    <>
${body.join("\n\n")}
    </>
  );
}
`;
}
