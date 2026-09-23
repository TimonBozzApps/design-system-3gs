import type { ScreenSpec } from "../../../../api/_lib/spec";
import type { NormalizedField, NormalizedForm, NormalizedSearch } from "./forms";
import { iconExportName, isKnownIcon } from "./icons";
import {
  heroGroupCount,
  normalizeSpec,
  urlKey,
  type NormalizedBlock,
  type NormalizedGroup,
  type NormalizedRow,
  type NormalizedSection,
} from "./SpecScreen";

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

/** The class that gives a block cell its look; the CSS is the demo's Blocks.css. */
const blockClass = (kind: string) => `className="spec-block spec-block--${kind}"`;

/**
 * The cells of one section, in page order — the same `<ListItem>` structures
 * `<SpecScreen>` renders, so what is copied is what the phone shows.
 */
function blockCells(
  blocks: NormalizedBlock[],
  indent: string,
  components: Set<string>,
  icons: Set<string>,
): string[] {
  const cells: string[] = [];
  const cell = (props: Array<string | null>) => cells.push(element("ListItem", props, undefined, indent));

  for (const block of blocks) {
    switch (block.kind) {
      case "text":
        cell([blockClass("text"), attr("title", block.text)]);
        break;
      case "list":
        components.add("Icon");
        icons.add("Check");
        for (const item of block.items) {
          cell([
            blockClass("bullet"),
            'icon={<Icon icon={Check} variant="flat" size={16} strokeWidth={3} />}',
            attr("title", item),
          ]);
        }
        break;
      case "stat":
        cell([blockClass("stat"), attr("icon", block.value), attr("title", block.label ?? ""), attr("subtitle", block.note)]);
        break;
      case "qa":
        cell([blockClass("qa"), attr("title", block.question), attr("subtitle", block.answer)]);
        break;
      case "quote":
        cell([blockClass("quote"), attr("title", block.text), attr("subtitle", block.source ? `— ${block.source}` : undefined)]);
        break;
      case "image":
        cell([
          blockClass("image"),
          `title={<img className="spec-block__img" src=${DATA_URI} alt=${JSON.stringify(block.alt ?? "")} />}`,
        ]);
        break;
      case "code":
        cell([blockClass("code"), `title={<code>{${JSON.stringify(block.text)}}</code>}`]);
        break;
      case "link":
        components.add("Icon");
        icons.add("Link");
        cell([
          blockClass("link"),
          'icon={<Icon icon={Link} variant="flat" size={16} />}',
          attr("title", block.text),
          `accessory="${block.external ? "detail" : "chevron"}"`,
          attr("href", block.href),
        ]);
        break;
    }
  }
  return cells;
}



/** The `searchUrl(q)` the generated `<SearchBar onSearch>` calls: the site's own search form as code. */
function searchUrlHelper(search: NormalizedSearch): string {
  const hidden = search.hidden
    .map((field) => `  url.searchParams.set(${JSON.stringify(field.name)}, ${JSON.stringify(field.value)});\n`)
    .join("");
  return `\n// The site's own search form: ${search.action}\nconst searchUrl = (q: string) => {\n  const url = new URL(${JSON.stringify(
    search.action,
  )});\n${hidden}  url.searchParams.set(${JSON.stringify(search.param)}, q);\n  return url.href;\n};\n`;
}

/** One form control as the component `<SpecForms>` renders — uncontrolled, so the snippet works as pasted. */
function fieldCell(field: NormalizedField, indent: string, components: Set<string>): string[] {
  const cls = (kind: string) => `className="spec-field spec-field--${kind}"`;
  switch (field.kind) {
    case "text":
      components.add("TextField");
      return [
        element(
          "ListItem",
          [
            cls("text"),
            `title={<TextField ${[
              attr("label", field.label),
              field.inputType === "text" ? null : `type="${field.inputType}"`,
              attr("placeholder", field.placeholder),
              field.value === "" ? null : attr("defaultValue", field.value),
            ]
              .filter(Boolean)
              .join(" ")} />}`,
          ],
          undefined,
          indent,
        ),
      ];
    case "textarea":
      return [
        element(
          "ListItem",
          [
            cls("textarea"),
            `title={
${indent}  <span className="spec-field__stack">
${indent}    <span className="spec-field__label">${text(field.label)}</span>
${indent}    <textarea className="spec-field__textarea" rows={3} ${[
              attr("aria-label", field.label),
              attr("placeholder", field.placeholder),
              field.value === "" ? null : attr("defaultValue", field.value),
            ]
              .filter(Boolean)
              .join(" ")} />
${indent}  </span>
${indent}}`,
          ],
          undefined,
          indent,
        ),
      ];
    case "toggle":
      components.add("Switch");
      return [
        element(
          "ListItem",
          [
            cls("toggle"),
            attr("title", field.label),
            `accessory={<Switch ${[attr("label", field.label), field.value ? "defaultChecked" : null]
              .filter(Boolean)
              .join(" ")} />}`,
          ],
          undefined,
          indent,
        ),
      ];
    case "choice": {
      const options = field.options;
      if (field.style === "segmented") {
        components.add("SegmentedControl").add("Segment");
        const segments = options
          .map((o) => `${indent}      <Segment value=${JSON.stringify(o.value)}>${text(o.label)}</Segment>`)
          .join("\n");
        return [
          element(
            "ListItem",
            [
              cls("segmented"),
              attr("title", field.label),
              `accessory={
${indent}    <SegmentedControl size="sm" ${[attr("label", field.label), attr("defaultValue", field.value)].join(" ")}>
${segments}
${indent}    </SegmentedControl>
${indent}  }`,
            ],
            undefined,
            indent,
          ),
        ];
      }
      components.add("Picker");
      const selected = options.find((o) => o.value === field.value);
      const columns = `[{ key: ${JSON.stringify(field.name)}, label: ${JSON.stringify(field.label)}, options: [${options
        .map((o) => `{ value: ${JSON.stringify(o.value)}, label: ${JSON.stringify(o.label)} }`)
        .join(", ")}] }]`;
      return [
        element(
          "ListItem",
          [
            cls("picker-row"),
            attr("title", field.label),
            attr("detail", selected?.label ?? field.value),
            'accessory="chevron"',
          ],
          undefined,
          indent,
        ),
        element(
          "ListItem",
          [
            cls("picker"),
            `title={<Picker rows={3} ${attr("label", field.label)} columns={${columns}} defaultValue={{ ${JSON.stringify(
              field.name,
            )}: ${JSON.stringify(field.value)} }} />}`,
          ],
          undefined,
          indent,
        ),
      ];
    }
  }
}

/** A form as a grouped list: its controls, then the gel submit button. */
function formList(form: NormalizedForm, indent: string, components: Set<string>): string {
  components.add("List").add("ListItem").add("Button");
  const cells = form.fields.flatMap((field) => fieldCell(field, `${indent}  `, components));
  // A GET form really submits: the helper turns the visitor's values into the
  // URL the site would load. The literal below is what the page came with —
  // swap it for your own state.
  const submitted = form.fields
    .filter((field) => field.kind !== "toggle" || field.value)
    .map((field) => `${JSON.stringify(field.name)}: ${JSON.stringify(field.kind === "toggle" ? "on" : field.value)}`)
    .join(", ");
  const onClick = form.submittable
    ? ` onClick={() => window.open(formUrl(${JSON.stringify(form.action)}, { ${submitted} }), "_blank")}`
    : "";
  cells.push(
    element(
      "ListItem",
      [
        'className="spec-field spec-field--submit"',
        `title={<Button block variant="primary"${onClick}>${text(form.submitLabel)}</Button>}`,
      ],
      undefined,
      `${indent}  `,
    ),
  );
  return element("List", ['className="spec-form"', attr("header", form.title)], cells, indent);
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

  const scopeHrefs = s.search ? s.search.scopes.filter((scope) => scope.href !== undefined) : [];
  if (s.search) {
    components.add("SearchBar");
    const { scopes, submittable } = s.search;
    body.push(
      element(
        "SearchBar",
        [
          attr("placeholder", s.search.placeholder),
          scopes.length > 0
            ? `scopes={[${scopes
                .map((scope) => `{ value: ${JSON.stringify(scope.value)}, label: ${JSON.stringify(scope.label)} }`)
                .join(", ")}]}`
            : null,
          scopeHrefs.length > 0
            ? 'onScopeChange={(scope) => SCOPE_HREFS[scope] && window.open(SCOPE_HREFS[scope], "_blank")}'
            : null,
          submittable ? 'onSearch={(q) => window.open(searchUrl(q), "_blank")}' : null,
        ],
        undefined,
        I,
      ),
    );
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

  if (s.intro.length > 0) {
    components.add("List").add("ListItem");
    body.push(element("List", [], blockCells(s.intro, `${I}  `, components, icons), I));
  }

  // One grouped list per section, headed by its heading; headings the server
  // sent no content for stay plain cells and share a single group.
  let bare: NormalizedSection[] = [];
  const flushBare = () => {
    if (bare.length === 0) return;
    components.add("List").add("ListItem");
    const cells = bare.map((section) =>
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
    bare = [];
    body.push(element("List", [], cells, I));
  };

  for (const section of s.sections) {
    if (section.blocks.length === 0) {
      bare.push(section);
      continue;
    }
    flushBare();
    components.add("List").add("ListItem");
    const cells = blockCells(section.blocks, `${I}  `, components, icons);
    const linked = section.href;
    if (
      linked &&
      urlKey(linked) !== urlKey(s.url) &&
      !section.blocks.some((b) => b.kind === "link" && urlKey(b.href) === urlKey(linked))
    ) {
      components.add("Icon");
      icons.add("Link");
      cells.push(
        element(
          "ListItem",
          [
            blockClass("link"),
            'icon={<Icon icon={Link} variant="flat" size={16} />}',
            'title="Read more"',
            'accessory="chevron"',
            attr("href", linked),
          ],
          undefined,
          `${I}  `,
        ),
      );
    }
    body.push(element("List", [attr("header", section.heading)], cells, I));
  }
  flushBare();

  s.forms.forEach((form) => body.push(formList(form, I, components)));

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

  // Where each scope button leads — the same table, for the search bar.
  const scopeTable =
    scopeHrefs.length > 0
      ? `\n// Where each search scope leads on the real site.\nconst SCOPE_HREFS: Record<string, string | undefined> = {\n${scopeHrefs
          .map((scope) => `  ${JSON.stringify(scope.value)}: ${JSON.stringify(scope.href)},`)
          .join("\n")}\n};\n`
      : "";

  const searchHelper = s.search?.submittable ? searchUrlHelper(s.search) : "";

  // One helper for every GET form on the page: action + values → the URL.
  const formHelper = s.forms.some((form) => form.submittable)
    ? `\n// Turn a form's values into the URL the site would load.\nconst formUrl = (action: string, values: Record<string, string>) => {\n  const url = new URL(action);\n  for (const [name, value] of Object.entries(values)) url.searchParams.set(name, value);\n  return url.href;\n};\n`
    : "";

  const imports = [
    `import { ${[...components].sort().join(", ")} } from "@3gs/ui";`,
    icons.size > 0 ? `import { ${[...icons].sort().join(", ")} } from "lucide-react";` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${imports}
${tabTable}${scopeTable}${searchHelper}${formHelper}
// ${spec.host || "site"} as a 2009 iPhone app — generated by 3GS UI.
// Layout: nav bar (+ search) pinned on top, hero row, intro copy, one grouped
// list per section, link groups and buttons in a scrolling pinstripe body, tab
// bar pinned to the bottom. The \`spec-block--*\` and \`spec-field--*\` classes on
// the content and form cells carry their styles (see Blocks.css); drop them for
// plain library cells. Form controls are uncontrolled (\`defaultValue\`) — wire
// them to your own state to read what the visitor typed.
export function ${componentName(spec.host || "")}() {
  return (
    <>
${body.join("\n\n")}
    </>
  );
}
`;
}
