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
  /**
   * `"feed"`: the page's repeated item list (news stories, blog posts,
   * changelog entries) rather than navigation. Renders like any other group —
   * clients may style it differently, and tooling uses it to tell the two apart.
   */
  kind?: "feed";
}

export interface SpecTab {
  label: string;
  icon: IconName;
  badge?: number | string;
  /** Internal page this tab opens (absolute URL); the client fetches its preview on select. */
  href?: string;
}

/** One piece of page content inside a section. */
export type SpecBlock =
  /** A paragraph of copy. */
  | { kind: "text"; text: string }
  /** A bullet / checklist ("Unlimited projects", "SSO"). */
  | { kind: "list"; items: string[] }
  /** A number that stands alone: price, metric, stat. `label` is what it measures. */
  | { kind: "stat"; value: string; label?: string; note?: string }
  /** A question/answer pair (FAQ, definition list). */
  | { kind: "qa"; question: string; answer: string }
  /** A pull quote / testimonial. */
  | { kind: "quote"; text: string; source?: string }
  /** An in-page image (data: URI, already size-capped). */
  | { kind: "image"; dataUri: string; alt?: string }
  /** A code / command snippet. */
  | { kind: "code"; text: string }
  /** A link that belongs to this section's copy. */
  | { kind: "link"; text: string; href: string; external: boolean };

/** A chunk of the page: its heading plus the content that follows it. */
export interface SpecSection {
  heading: string;
  /** Lead text (the first paragraph) — kept for compatibility and quick rendering. */
  text?: string;
  /** Everything else under this heading, in page order. */
  blocks: SpecBlock[];
  /** Internal link when the heading itself linked somewhere. */
  href?: string;
}

/** A scope button under the search field; `href` makes it navigate. */
export interface SpecScope {
  label: string;
  href?: string;
}

export interface SpecSearch {
  placeholder: string;
  scopes?: SpecScope[];
  /** Absolute URL the query is sent to (GET forms only; POST forms are not submitted). */
  action?: string;
  method?: "get" | "post";
  /** Query parameter name, e.g. "q". */
  param?: string;
  /** Hidden fields the form carries (kept so the built URL matches the real one). */
  hidden?: Array<{ name: string; value: string }>;
}

/** One control of a form on the page. */
export type SpecField =
  | {
      kind: "text";
      name: string;
      label: string;
      inputType: "text" | "email" | "password" | "search" | "tel" | "url" | "number" | "date";
      placeholder?: string;
      value?: string;
      required?: boolean;
    }
  | { kind: "textarea"; name: string; label: string; placeholder?: string; value?: string; required?: boolean }
  | { kind: "toggle"; name: string; label: string; value?: boolean }
  /** A select or a radio group: `segmented` for ≤ 3 short options, `picker` otherwise. */
  | {
      kind: "choice";
      name: string;
      label: string;
      options: Array<{ label: string; value: string }>;
      value?: string;
      style: "segmented" | "picker";
    };

export interface SpecForm {
  /** Heading the form sits under, e.g. "Contact us". */
  title?: string;
  /** Absolute action URL; GET forms can be submitted (we preview the result page). */
  action?: string;
  method: "get" | "post";
  fields: SpecField[];
  submitLabel?: string;
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
  /** Content blocks in page order (headline + lead copy) — rendered as text cells. */
  sections: SpecSection[];
  /** Grouped table sections, in order. */
  groups: SpecGroup[];
  /** Gel buttons (max 3). */
  actions: SpecAction[];
  /** Present when the site has a search form. */
  search?: SpecSearch;
  /** Interactive forms found on the page (contact, sign-up, settings, filters). */
  forms?: SpecForm[];
  /** Content that appears before the first heading (intro copy). */
  intro?: SpecBlock[];
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
