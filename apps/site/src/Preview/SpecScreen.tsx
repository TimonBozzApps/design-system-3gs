import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Check, Link as LinkGlyph } from "lucide-react";
import {
  BarButton,
  Button,
  Icon,
  List,
  ListItem,
  NavigationBar,
  SearchBar,
  TabBar,
  TabBarItem,
} from "@3gs/ui";
import type { ScreenSpec, SpecAction, SpecBlock, SpecRow, SpecSection, SpecTab } from "../../../../api/_lib/spec";
import { Screen } from "../shell/Screen";
import { iconFor } from "./icons";
import "./Blocks.css";

/* ==========================================================================
   Normalisation — the rendering rules, shared with the JSX generator so what
   the developer copies is what the phone shows. Tolerates a partial or
   slightly off-contract spec (a newer server, hand-written JSON): nothing
   here throws.
   ========================================================================== */

export const MAX_TABS = 5;
export const MAX_ACTIONS = 3;
export const MAX_SCOPES = 3;
/** The Back button shows the previous title, cut to this many characters. */
export const MAX_BACK_LABEL = 10;
/** A section can only fill so much of a 320 px screen before it stops being a screen. */
export const MAX_BLOCKS = 24;
/** Bullets in one `list` block. */
export const MAX_LIST_ITEMS = 16;

/** Tile colours the library ships; `green` from the contract is painted via CSS (see PreviewSection.css). */
export type LibraryTint = "gray" | "blue" | "red";
export type RowAccessory = "chevron" | "detail" | "none";

export interface NormalizedRow {
  title: string;
  subtitle?: string;
  detail?: string;
  href?: string;
  /** Contract icon name; unknown names fall back to a globe when rendered. */
  icon: string;
  imageDataUri?: string;
  tint: LibraryTint;
  green: boolean;
  accessory: RowAccessory;
}

export interface NormalizedGroup {
  header?: string;
  footer?: string;
  rows: NormalizedRow[];
}

/**
 * A `SpecBlock` that survived normalisation: same shape, but every field is
 * known-good (non-empty strings, a real `data:image/` URI, an http(s) href),
 * so rendering is a straight switch with no guards.
 */
export type NormalizedBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "stat"; value: string; label?: string; note?: string }
  | { kind: "qa"; question: string; answer?: string }
  | { kind: "quote"; text: string; source?: string }
  | { kind: "image"; dataUri: string; alt?: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string; external: boolean };

export interface NormalizedSection {
  heading: string;
  /** The lead paragraph, kept for consumers that only want one line. */
  text?: string;
  /** Everything under the heading, lead paragraph first — what the phone draws. */
  blocks: NormalizedBlock[];
  href?: string;
}

export interface NormalizedTab {
  /** Unique per bar — labels can repeat, values can't. */
  value: string;
  label: string;
  icon: string;
  badge?: number | string;
  /** The page the tab opens; the first tab defaults to the site's front page. */
  href?: string;
}

export interface NormalizedAction {
  label: string;
  variant: SpecAction["variant"];
  href?: string;
}

export interface NormalizedSpec {
  url: string;
  title: string;
  iconDataUri?: string;
  imageDataUri?: string;
  search?: { placeholder: string; scopes: string[] };
  /** Copy before the first heading; rendered as one headerless group. */
  intro: NormalizedBlock[];
  sections: NormalizedSection[];
  groups: NormalizedGroup[];
  actions: NormalizedAction[];
  tabs: NormalizedTab[];
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

const httpUrl = (v: unknown): string | undefined => {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};

const dataUri = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("data:image/") ? s : undefined;
};

const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Code keeps its indentation; only blank lines top and bottom go. */
const codeText = (v: unknown): string | undefined => {
  const s = typeof v === "string" ? v.replace(/^[\r\n]+|\s+$/g, "") : "";
  return s === "" ? undefined : s;
};

/** Collapsed and case-folded — "is this the same paragraph twice?". */
const copyKey = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();

/** The lead text repeated as the first block (a server may send both). */
function sameCopy(a: string, b: string): boolean {
  const x = copyKey(a);
  const y = copyKey(b);
  return x === y || (Math.min(x.length, y.length) > 40 && (x.startsWith(y) || y.startsWith(x)));
}

/**
 * One content block, tolerant of a partial or future server: anything that
 * can't be drawn (empty text, a remote image URL, a `mailto:` link, a kind
 * this client doesn't know) drops out instead of throwing.
 */
export function normalizeBlock(block: SpecBlock | undefined): NormalizedBlock | null {
  if (!block || typeof block !== "object") return null;
  switch (block.kind) {
    case "text": {
      const text = str(block.text);
      return text ? { kind: "text", text } : null;
    }
    case "list": {
      const items = list<string>(block.items)
        .map((item) => str(item))
        .filter((item): item is string => item !== undefined)
        .slice(0, MAX_LIST_ITEMS);
      return items.length > 0 ? { kind: "list", items } : null;
    }
    case "stat": {
      const value = str(block.value);
      return value ? { kind: "stat", value, label: str(block.label), note: str(block.note) } : null;
    }
    case "qa": {
      const question = str(block.question);
      return question ? { kind: "qa", question, answer: str(block.answer) } : null;
    }
    case "quote": {
      const text = str(block.text);
      return text ? { kind: "quote", text, source: str(block.source) } : null;
    }
    case "image": {
      const uri = dataUri(block.dataUri);
      return uri ? { kind: "image", dataUri: uri, alt: str(block.alt) } : null;
    }
    case "code": {
      const text = codeText(block.text);
      return text ? { kind: "code", text } : null;
    }
    case "link": {
      const text = str(block.text);
      const href = httpUrl(block.href);
      return text && href ? { kind: "link", text, href, external: block.external === true } : null;
    }
    default:
      return null;
  }
}

function normalizeBlocks(value: unknown): NormalizedBlock[] {
  return list<SpecBlock>(value)
    .map(normalizeBlock)
    .filter((b): b is NormalizedBlock => b !== null)
    .slice(0, MAX_BLOCKS);
}

function normalizeRow(row: SpecRow | undefined): NormalizedRow | null {
  if (!row || typeof row !== "object") return null;
  const title = str(row.title);
  if (!title) return null;
  const href = httpUrl(row.href);
  const tile = row.tile;
  const accessory: RowAccessory =
    row.accessory === "chevron" || row.accessory === "detail" || row.accessory === "none"
      ? row.accessory
      : href
        ? "chevron"
        : "none";
  return {
    title,
    subtitle: str(row.subtitle),
    detail: str(row.detail),
    href,
    icon: str(row.icon) ?? "globe",
    imageDataUri: dataUri(row.imageDataUri),
    tint: tile === "blue" || tile === "red" ? tile : "gray",
    green: tile === "green",
    accessory,
  };
}

export function normalizeSpec(spec: ScreenSpec): NormalizedSpec {
  const url = httpUrl(spec.url) ?? (str(spec.host) ? `https://${str(spec.host)}/` : "");

  const seen = new Set<string>();
  const tabs: NormalizedTab[] = [];
  for (const tab of list<SpecTab>(spec.tabs)) {
    const label = str(tab?.label);
    if (!label) continue;
    let value = label;
    for (let i = 2; seen.has(value); i++) value = `${label} ${i}`;
    seen.add(value);
    // The server's first tab is always "Home" without an href: it means the front page.
    const href = httpUrl(tab.href) ?? (tabs.length === 0 && url ? url : undefined);
    tabs.push({ value, label, icon: str(tab.icon) ?? "globe", badge: tab.badge, href });
    if (tabs.length === MAX_TABS) break;
  }

  const sections: NormalizedSection[] = [];
  for (const section of list<SpecSection>(spec.sections)) {
    const heading = str(section?.heading);
    if (!heading) continue;
    const text = str(section.text);
    const blocks = normalizeBlocks(section.blocks);
    // `text` is the lead paragraph; it leads the group unless the blocks already carry it.
    if (text && !blocks.some((b) => b.kind === "text" && sameCopy(b.text, text))) {
      blocks.unshift({ kind: "text", text });
    }
    sections.push({ heading, text, blocks, href: httpUrl(section.href) });
  }

  const groups: NormalizedGroup[] = [];
  for (const group of list<ScreenSpec["groups"][number]>(spec.groups)) {
    const rows = list<SpecRow>(group?.rows).map(normalizeRow).filter((r): r is NormalizedRow => r !== null);
    if (rows.length === 0) continue;
    groups.push({ header: str(group.header), footer: str(group.footer), rows });
  }

  const actions: NormalizedAction[] = [];
  for (const action of list<SpecAction>(spec.actions)) {
    const label = str(action?.label);
    if (!label) continue;
    const variant = action.variant === "primary" || action.variant === "destructive" ? action.variant : "default";
    actions.push({ label, variant, href: httpUrl(action.href) });
    if (actions.length === MAX_ACTIONS) break;
  }

  const placeholder = str(spec.search?.placeholder);
  const search = placeholder
    ? {
        placeholder,
        scopes: list<string>(spec.search?.scopes)
          .map((s) => str(s))
          .filter((s): s is string => s !== undefined)
          .slice(0, MAX_SCOPES),
      }
    : undefined;

  return {
    url,
    title: str(spec.title) ?? str(spec.siteName) ?? str(spec.host) ?? "Untitled",
    iconDataUri: dataUri(spec.iconDataUri),
    imageDataUri: dataUri(spec.imageDataUri),
    search,
    intro: normalizeBlocks(spec.intro),
    sections,
    groups,
    actions,
    tabs,
  };
}

/**
 * The server's first group is the page's own hero row (one row linking to the
 * page itself, headed by the site name); content sections render right after
 * it, before the link groups.
 */
export function heroGroupCount(s: NormalizedSpec): number {
  const first = s.groups[0];
  if (!first || first.rows.length !== 1) return 0;
  const href = first.rows[0].href;
  return !href || urlKey(href) === urlKey(s.url) ? 1 : 0;
}

/* ==========================================================================
   URL rules — what a link does inside the phone
   ========================================================================== */

/** Host without `www.`, or "" when the URL can't be parsed. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The registrable part of a host (`docs.stripe.com` → `stripe.com`,
 * `bbc.co.uk` → `bbc.co.uk`): a naive eTLD+1 that knows the common two-label
 * public suffixes — enough to tell "same site" from "elsewhere".
 */
export function siteKey(url: string): string {
  const parts = hostOf(url).split(".").filter(Boolean);
  if (parts.length < 2) return parts.join(".");
  const [sld, tld] = parts.slice(-2);
  const keep = parts.length > 2 && tld.length === 2 && /^(co|com|org|net|gov|edu|ac|or|ne)$/.test(sld) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

/** The URL without hash, `www.` and trailing slash — "is this the page I'm on". */
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.hostname = u.hostname.replace(/^www\./, "");
    return u.href.replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

export type LinkKind =
  /** the page currently shown — a dead end, rendered as a plain row */
  | "self"
  /** same site — pushed onto the phone's navigation stack */
  | "internal"
  /** somewhere else — opens in a new browser tab */
  | "external";

export function linkKind(href: string, siteUrl: string, pageUrl: string): LinkKind {
  if (urlKey(href) === urlKey(pageUrl)) return "self";
  const site = siteKey(siteUrl);
  return site !== "" && siteKey(href) === site ? "internal" : "external";
}

/** "PostHog pricing" → "PostHog p…" — the Back button's label. */
export function backLabel(title: string): string {
  return title.length > MAX_BACK_LABEL ? `${title.slice(0, MAX_BACK_LABEL - 1).trimEnd()}…` : title;
}

/* ==========================================================================
   Rendering
   ========================================================================== */

const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" };

const rowImageStyle: CSSProperties = {
  width: 29,
  height: 29,
  borderRadius: 6,
  objectFit: "cover",
  display: "block",
  border: "1px solid rgba(0, 0, 0, 0.9)",
  boxSizing: "border-box",
};

const navIconStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 5,
  objectFit: "cover",
  display: "block",
  marginInlineStart: 8,
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.9), 0 1px 0 rgba(255, 255, 255, 0.15)",
};

function openInNewTab(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

export interface SpecScreenProps {
  /** The screen to draw: the top of the navigation stack. */
  spec: ScreenSpec;
  /** The site's front page — links on the same registrable host navigate inside the phone. */
  siteUrl: string;
  /** Tabs of the site's front page: the same bar on every screen of the stack. */
  tabs: NormalizedTab[];
  /** Selected tab value. */
  tab?: string;
  /** A tab was tapped; `again` when it was already selected (iOS pops that tab to its root). */
  onTab: (value: string, again: boolean) => void;
  /** Title of the screen underneath — present when this one was pushed. */
  previousTitle?: string;
  onBack: () => void;
  /** An internal link (row, section heading, gel button) was tapped. */
  onNavigate: (href: string) => void;
}

/**
 * A `ScreenSpec` rendered with the library inside the phone's `<Screen>`:
 * nav bar (+ search bar) on top, hero card + content sections + grouped
 * lists + gel buttons in the pinstripe body, the site's tab bar pinned to
 * the bottom. Links on the same site are navigation (chevron, pushed by the
 * owner); links elsewhere are detail rows that open a new browser tab.
 */
export function SpecScreen({ spec, siteUrl, tabs, tab, onTab, previousTitle, onBack, onNavigate }: SpecScreenProps) {
  const s = normalizeSpec(spec);
  const heroGroups = heroGroupCount(s);
  const empty =
    s.sections.length === 0 && s.intro.length === 0 && s.groups.length <= heroGroups && s.actions.length === 0;

  /** Row props for a link: how it looks and what tapping it does. */
  const link = (href: string | undefined, fallback: RowAccessory) => {
    if (!href) return { accessory: fallback };
    switch (linkKind(href, siteUrl, s.url)) {
      case "self":
        return { accessory: "none" as const };
      case "internal":
        return { accessory: "chevron" as const, onClick: () => onNavigate(href) };
      case "external":
        return { accessory: "detail" as const, href, ...NEW_TAB };
    }
  };

  const open = (href: string) => {
    if (linkKind(href, siteUrl, s.url) === "internal") onNavigate(href);
    else openInNewTab(href);
  };

  /**
   * One content block as a grouped-table cell. Everything is a `<ListItem>`
   * so the separators, the gloss and the pressed gel come from the library;
   * the per-kind look is CSS on the `spec-block--*` class (Blocks.css).
   */
  const blockCell = (block: NormalizedBlock, key: string): ReactNode => {
    switch (block.kind) {
      case "text":
        return <ListItem key={key} className="spec-block spec-block--text" title={block.text} />;
      case "list":
        return (
          <Fragment key={key}>
            {block.items.map((item, i) => (
              <ListItem
                key={i}
                className="spec-block spec-block--bullet"
                icon={<Icon icon={Check} variant="flat" size={16} strokeWidth={3} />}
                title={item}
              />
            ))}
          </Fragment>
        );
      case "stat":
        return (
          <ListItem
            key={key}
            className="spec-block spec-block--stat"
            icon={block.value}
            title={block.label ?? ""}
            subtitle={block.note}
          />
        );
      case "qa":
        return (
          <ListItem key={key} className="spec-block spec-block--qa" title={block.question} subtitle={block.answer} />
        );
      case "quote":
        return (
          <ListItem
            key={key}
            className="spec-block spec-block--quote"
            title={block.text}
            subtitle={block.source ? `— ${block.source}` : undefined}
          />
        );
      case "image":
        return (
          <ListItem
            key={key}
            className="spec-block spec-block--image"
            title={<img className="spec-block__img" src={block.dataUri} alt={block.alt ?? ""} />}
          />
        );
      case "code":
        return <ListItem key={key} className="spec-block spec-block--code" title={<code>{block.text}</code>} />;
      case "link":
        return (
          <ListItem
            key={key}
            className="spec-block spec-block--link"
            icon={<Icon icon={LinkGlyph} variant="flat" size={16} />}
            title={block.text}
            {...link(block.href, block.external ? "detail" : "chevron")}
          />
        );
    }
  };

  /**
   * Sections in page order: one grouped list per section, headed by its
   * heading — exactly how an iOS 3 grouped table reads. Headings the server
   * sent no content for stay plain cells, and consecutive ones share a group
   * instead of each becoming an empty box.
   */
  const renderSections = (): ReactNode[] => {
    const out: ReactNode[] = [];
    let bare: NormalizedSection[] = [];

    const flushBare = () => {
      if (bare.length === 0) return;
      const run = bare;
      bare = [];
      out.push(
        <List key={`bare-${out.length}`} className="spec-sections">
          {run.map((section, i) => (
            <ListItem
              key={i}
              className="spec-section"
              title={section.heading}
              subtitle={section.text}
              {...link(section.href, "none")}
            />
          ))}
        </List>,
      );
    };

    s.sections.forEach((section, i) => {
      if (section.blocks.length === 0) {
        bare.push(section);
        return;
      }
      flushBare();
      // "Read more" only when the heading's link isn't this page and no link block already offers it.
      const linked = section.href;
      const more =
        linked &&
        linkKind(linked, siteUrl, s.url) !== "self" &&
        !section.blocks.some((b) => b.kind === "link" && urlKey(b.href) === urlKey(linked))
          ? linked
          : undefined;
      out.push(
        <List key={`section-${i}`} className="spec-blocks" header={section.heading}>
          {section.blocks.map((block, bi) => blockCell(block, String(bi)))}
          {more && (
            <ListItem
              key="more"
              className="spec-block spec-block--link"
              icon={<Icon icon={LinkGlyph} variant="flat" size={16} />}
              title="Read more"
              {...link(more, "chevron")}
            />
          )}
        </List>,
      );
    });

    flushBare();
    return out;
  };

  const renderGroup = (group: NormalizedGroup, gi: number) => (
    <List key={gi} header={group.header} footer={group.footer}>
      {group.rows.map((row, ri) => (
        <ListItem
          key={ri}
          className={row.green ? "spec-row--green" : undefined}
          icon={
            row.imageDataUri ? (
              <img src={row.imageDataUri} alt="" style={rowImageStyle} />
            ) : (
              <Icon icon={iconFor(row.icon)} variant="flat" size={18} />
            )
          }
          iconTile={!row.imageDataUri}
          iconTint={row.tint}
          title={row.title}
          subtitle={row.subtitle}
          detail={row.detail}
          {...link(row.href, row.accessory)}
        />
      ))}
    </List>
  );

  return (
    <Screen
      top={
        <>
          <NavigationBar
            title={s.title}
            left={
              previousTitle !== undefined ? (
                <BarButton variant="back" onClick={onBack}>
                  {backLabel(previousTitle)}
                </BarButton>
              ) : s.iconDataUri ? (
                <img src={s.iconDataUri} alt="" style={navIconStyle} />
              ) : undefined
            }
            right={previousTitle === undefined ? <BarButton variant="done">Done</BarButton> : undefined}
          />
          {s.search && (
            <SearchBar
              placeholder={s.search.placeholder}
              scopes={s.search.scopes.length > 0 ? s.search.scopes.map((v) => ({ value: v, label: v })) : undefined}
            />
          )}
        </>
      }
      bottom={
        tabs.length > 0 ? (
          <TabBar value={tab ?? tabs[0].value} label={`${s.title} tabs`}>
            {tabs.map((t) => (
              <TabBarItem
                key={t.value}
                value={t.value}
                icon={iconFor(t.icon)}
                label={t.label}
                badge={t.badge}
                onClick={() => onTab(t.value, t.value === tab)}
              />
            ))}
          </TabBar>
        ) : undefined
      }
    >
      {s.imageDataUri && (
        <div className="spec-hero">
          <img className="spec-hero__img" src={s.imageDataUri} alt="" />
        </div>
      )}

      {s.groups.slice(0, heroGroups).map(renderGroup)}

      {s.intro.length > 0 && (
        <List className="spec-blocks spec-intro">{s.intro.map((block, i) => blockCell(block, String(i)))}</List>
      )}

      {renderSections()}

      {empty && <p className="spec-empty">Nothing else on this page.</p>}

      {s.groups.slice(heroGroups).map((group, i) => renderGroup(group, heroGroups + i))}

      {s.actions.length > 0 && (
        <div className="spec-actions">
          {s.actions.map(({ label, variant, href }, i) => (
            <Button key={i} block variant={variant} onClick={href ? () => open(href) : undefined}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </Screen>
  );
}
