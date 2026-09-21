import type { CSSProperties } from "react";
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
import type { ScreenSpec, SpecAction, SpecRow } from "../../../../api/_lib/spec";
import { Screen } from "../shell/Screen";
import { iconFor } from "./icons";

/* ==========================================================================
   Normalisation — the rendering rules, shared with the JSX generator so what
   the developer copies is what the phone shows. Tolerates a partial or
   slightly off-contract spec (a newer server, hand-written JSON): nothing
   here throws.
   ========================================================================== */

export const MAX_TABS = 5;
export const MAX_ACTIONS = 3;
export const MAX_SCOPES = 3;

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

export interface NormalizedTab {
  /** Unique per bar — labels can repeat, values can't. */
  value: string;
  label: string;
  icon: string;
  badge?: number | string;
}

export interface NormalizedAction {
  label: string;
  variant: SpecAction["variant"];
  href?: string;
}

export interface NormalizedSpec {
  title: string;
  iconDataUri?: string;
  imageDataUri?: string;
  search?: { placeholder: string; scopes: string[] };
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
  const seen = new Set<string>();
  const tabs: NormalizedTab[] = [];
  for (const tab of list<ScreenSpec["tabs"][number]>(spec.tabs)) {
    const label = str(tab?.label);
    if (!label) continue;
    let value = label;
    for (let i = 2; seen.has(value); i++) value = `${label} ${i}`;
    seen.add(value);
    tabs.push({ value, label, icon: str(tab.icon) ?? "globe", badge: tab.badge });
    if (tabs.length === MAX_TABS) break;
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
    title: str(spec.title) ?? str(spec.siteName) ?? str(spec.host) ?? "Untitled",
    iconDataUri: dataUri(spec.iconDataUri),
    imageDataUri: dataUri(spec.imageDataUri),
    search,
    groups,
    actions,
    tabs,
  };
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
  spec: ScreenSpec;
}

/**
 * A `ScreenSpec` rendered with the library inside the phone's `<Screen>`:
 * nav bar (+ search bar) on top, hero card + grouped lists + gel buttons in
 * the pinstripe body, tab bar pinned to the bottom. Stateless apart from the
 * library's own uncontrolled widgets.
 */
export function SpecScreen({ spec }: SpecScreenProps) {
  const s = normalizeSpec(spec);

  return (
    <Screen
      top={
        <>
          <NavigationBar
            title={s.title}
            left={s.iconDataUri ? <img src={s.iconDataUri} alt="" style={navIconStyle} /> : undefined}
            right={<BarButton variant="done">Done</BarButton>}
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
        s.tabs.length > 0 ? (
          <TabBar defaultValue={s.tabs[0].value} label={`${s.title} tabs`}>
            {s.tabs.map((tab) => (
              <TabBarItem key={tab.value} value={tab.value} icon={iconFor(tab.icon)} label={tab.label} badge={tab.badge} />
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

      {s.groups.map((group, gi) => (
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
              accessory={row.accessory}
              href={row.href}
              {...(row.href ? NEW_TAB : undefined)}
            />
          ))}
        </List>
      ))}

      {s.actions.length > 0 && (
        <div className="spec-actions">
          {s.actions.map(({ label, variant, href }, i) => (
            <Button key={i} block variant={variant} onClick={href ? () => openInNewTab(href) : undefined}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </Screen>
  );
}
