/**
 * The contract between the preview generator (server) and the renderer (client).
 * The server turns an arbitrary website into this "2009 iPhone app" spec; the
 * client renders it with @3gs/ui. Keeping the mapping server-side means an
 * AI-designed mapper can later replace the heuristic one without UI changes.
 */

/** Icons the client knows how to render (lucide names, kebab-case). */
export const ICON_NAMES = [
  "home", "tag", "book", "newspaper", "info", "mail", "log-in", "layout-grid", "star",
  "search", "settings", "download", "users", "message-square", "calendar", "image", "play",
  "shopping-cart", "circle-help", "globe", "code", "briefcase", "heart", "file-text",
  "rocket", "shield", "credit-card", "github", "map", "phone", "video", "music", "camera",
  "package", "zap", "trophy", "gift", "clock", "folder", "link",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export type TileTint = "gray" | "blue" | "red" | "green";

export interface SpecRow {
  title: string;
  subtitle?: string;
  detail?: string;
  href?: string;
  icon?: IconName;
  /** data: URI when the server could fetch it (favicons / small images); overrides `icon` */
  imageDataUri?: string;
  tile?: TileTint;
  accessory?: "chevron" | "detail" | "none";
}

export interface SpecGroup {
  header?: string;
  rows: SpecRow[];
  footer?: string;
}

export interface SpecTab {
  label: string;
  icon: IconName;
  badge?: number | string;
}

export interface SpecAction {
  label: string;
  variant: "default" | "primary" | "destructive";
  href?: string;
}

export interface ScreenSpec {
  /** Where it came from. */
  url: string;
  host: string;
  /** Nav-bar title (short) and full site name. */
  title: string;
  siteName: string;
  description?: string;
  /** Favicon / touch icon as a data: URI (so the PNG export isn't tainted). */
  iconDataUri?: string;
  /** OG / hero image as a data: URI, capped in size. */
  imageDataUri?: string;
  /** The site's `theme-color`, if declared. */
  themeColor?: string;
  /** 2–5 tabs. */
  tabs: SpecTab[];
  /** Grouped table sections, in order. */
  groups: SpecGroup[];
  /** Gel buttons (max 3). */
  actions: SpecAction[];
  /** Present when the site has a search form. */
  search?: { placeholder: string; scopes?: string[] };
  /** Caveats for the UI ("client-rendered page, metadata only", …). */
  notes: string[];
  /** Which mapper produced it. */
  generator: "heuristic" | "ai";
  generatedAt: string;
}

export type PreviewErrorCode =
  | "invalid_url"
  | "blocked"
  | "fetch_failed"
  | "timeout"
  | "too_large"
  | "not_html"
  | "rate_limited";

export type PreviewResult =
  | { ok: true; spec: ScreenSpec; cached: boolean; ms: number }
  | { ok: false; code: PreviewErrorCode; error: string };
