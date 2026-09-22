/**
 * `Extracted` → `ScreenSpec`: the heuristic mapper. A pure function with no
 * I/O, so an AI-backed mapper can replace it behind the same signature.
 * It must never throw: every input is optional and every list is clamped.
 */
import type { Extracted, ExtractedBlock, ExtractedLink } from "./extract.js";
import type { IconName, ScreenSpec, SpecAction, SpecBlock, SpecGroup, SpecRow, SpecSection, SpecTab } from "./spec.js";

export interface MapContext {
  /** Site icon as a data: URI, when it could be fetched. */
  iconDataUri?: string;
  /** og:image as a data: URI, when it could be fetched. */
  imageDataUri?: string;
  /** In-page image URL → data: URI, for the images the orchestrator could fetch. */
  inlineImages?: Map<string, string>;
  now?: Date;
}

const MAX_TITLE = 18;
const MAX_TAB_LABEL = 11;
const MAX_TABS = 5;
const MAX_BROWSE_ROWS = 6;
const MAX_FOOTER_ROWS = 4;
const MAX_SECTIONS = 10;
/** Content budget (sections + intro, in-page images included). */
const MAX_SPEC_BYTES = 500_000;
/** Whole-payload guard; the icon and the og:image alone can be ~470 KB each as data: URIs. */
const MAX_TOTAL_BYTES = 1_200_000;
const MAX_ACTIONS = 3;
const MAX_ACTION_LABEL = 22;
const MAX_ROW_TITLE = 64;
const MAX_SUBTITLE = 120;
const MAX_NOTES = 2;

/* ------------------------------------------------------------------ */
/* keyword → icon                                                      */
/* ------------------------------------------------------------------ */

/** Ordered: the first pattern that matches the label (then the URL path) wins. */
const ICON_RULES: [RegExp, IconName][] = [
  [/\b(get started|getting started|start (?:for )?free|quick ?start|launch|onboarding)\b/, "rocket"],
  [/\b(home|start|startseite|inicio|accueil)\b/, "home"],
  [/\b(pricing|prices?|plans?|preise|tarifs?)\b/, "tag"],
  [/\b(docs?|documentation|guides?|api|reference|manual|learn|tutorials?|handbook|wiki|knowledge ?base)\b/, "book"],
  [/\b(blog|news|newsroom|changelog|updates?|press|articles?|stories|journal|posts?|what'?s new|release notes)\b/, "newspaper"],
  [/\b(about|company|team|mission|story|who we are|über uns|impressum|manifesto)\b/, "info"],
  [/\b(contact|kontakt|reach us|get in touch|email)\b/, "mail"],
  [/\b(support|help|faqs?|help ?center|troubleshoot|questions?)\b/, "circle-help"],
  [/\b(log ?in|sign ?in|account|my account|dashboard|console)\b/, "log-in"],
  [/\b(sign ?up|register|join|create account)\b/, "users"],
  [/\b(download|install|get the app|apps?|desktop|mobile)\b/, "download"],
  [/\b(community|customers?|partners?|forum|discord|slack|members?|ambassadors?)\b/, "users"],
  [/\b(shop|store|buy|cart|checkout|merch|marketplace|products? catalog)\b/, "shopping-cart"],
  [/\b(billing|payments?|invoices?|credit ?card|pay)\b/, "credit-card"],
  [/\b(careers?|jobs?|hiring|work with us|we'?re hiring|enterprise|business|for teams)\b/, "briefcase"],
  [/\b(github|source|open source|repos?|repository)\b/, "github"],
  [/\b(videos?|watch|youtube|tv|stream|webinar|talks?)\b/, "video"],
  [/\b(events?|conference|meetups?|calendar|schedule|summit|workshops?)\b/, "calendar"],
  [/\b(security|privacy|trust|compliance|legal|terms|cookies?|gdpr|safety)\b/, "shield"],
  [/\b(gallery|photos?|images?|showcase|portfolio|design|gallery|wallpapers?)\b/, "image"],
  [/\b(music|podcasts?|audio|listen|radio)\b/, "music"],
  [/\b(maps?|locations?|stores?|where|find us|directions)\b/, "map"],
  [/\b(phone|call us|hotline)\b/, "phone"],
  [/\b(search|find|explore|discover)\b/, "search"],
  [/\b(settings?|preferences|config|options)\b/, "settings"],
  [/\b(code|developers?|dev|sdks?|engineering|integrations?|plugins?|extensions?|cli|packages?)\b/, "code"],
  [/\b(projects?|files?|resources?|library|archive|collections?|templates?)\b/, "folder"],
  [/\b(messages?|chat|discussions?|comments?|feedback|reviews?|ask)\b/, "message-square"],
  [/\b(love|favou?rites?|wishlist|sponsors?|thanks|donate)\b/, "heart"],
  [/\b(gifts?|rewards?|referrals?|bonus|perks)\b/, "gift"],
  [/\b(releases?|versions?|packages?|bundles?|shipping)\b/, "package"],
  [/\b(history|timeline|status|recent|latest|activity)\b/, "clock"],
  [/\b(awards?|leaderboard|winners?|champions?|rankings?|best of)\b/, "trophy"],
  [/\b(camera|photography|shoot)\b/, "camera"],
  [/\b(play|games?|demo|playground|sandbox|arcade)\b/, "play"],
  [/\b(featured|popular|top|trending|highlights?|picks)\b/, "star"],
  [/\b(fast|performance|speed|power|energy|ai|automation)\b/, "zap"],
  [/\b(features?|products?|platform|solutions?|services?|tools?|overview|catalog)\b/, "layout-grid"],
  [/\b(pdf|reports?|whitepapers?|papers?|research|case stud(?:y|ies)|guides?)\b/, "file-text"],
  [/\b(links?|more|other|misc)\b/, "link"],
];

function keywordText(label: string): string {
  return label.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, " ").trim();
}

function pathKeyword(href: string): string {
  try {
    const segs = new URL(href).pathname.split("/").filter(Boolean);
    return keywordText(decodeURIComponent(segs.slice(0, 2).join(" ")).replace(/[-_.]/g, " "));
  } catch {
    return "";
  }
}

/** Icon for a link; `undefined` when no keyword matches (so callers can apply their own default). */
export function iconForLink(link: Pick<ExtractedLink, "text" | "href">): IconName | undefined {
  const label = keywordText(link.text);
  for (const [re, icon] of ICON_RULES) if (re.test(label)) return icon;
  const path = pathKeyword(link.href);
  if (path) for (const [re, icon] of ICON_RULES) if (re.test(path)) return icon;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* text helpers                                                        */
/* ------------------------------------------------------------------ */

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function tidyLabel(text: string): string {
  const t = text.trim();
  // Nav labels shouted in caps in the markup read better in Title Case on a 2009 tab bar.
  if (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
    return t.toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
  }
  return t;
}

function stripWww(host: string): string {
  return host.replace(/^www\./, "");
}

function firstWords(text: string, max: number): string {
  const words = text.split(/\s+/);
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || truncate(text, max);
}

/** Cut a page title at the usual separators: "Stripe | Financial infrastructure" → "Stripe". */
function titleHead(text: string): string {
  return text.split(/\s+[|–—·•:-]\s+/)[0].trim() || text;
}

/* ------------------------------------------------------------------ */
/* mapper                                                              */
/* ------------------------------------------------------------------ */

export function mapToSpec(extracted: Extracted, ctx: MapContext = {}): ScreenSpec {
  const x: Extracted = {
    ...extracted,
    navLinks: extracted.navLinks ?? [],
    headings: extracted.headings ?? [],
    ctas: extracted.ctas ?? [],
    footerLinks: extracted.footerLinks ?? [],
    iconCandidates: extracted.iconCandidates ?? [],
    sections: extracted.sections ?? [],
    intro: extracted.intro ?? [],
    inlineImages: extracted.inlineImages ?? [],
    sectionsFound: extracted.sectionsFound ?? (extracted.sections ?? []).length,
  };
  const host = stripWww(x.host || safeHost(x.url));
  const pageTitle = x.title ? titleHead(x.title) : undefined;

  const siteName = truncate(x.siteName || pageTitle || host, 40);
  const title = pickTitle(x.siteName, host, pageTitle);
  const description = x.description ? truncate(x.description, MAX_SUBTITLE) : undefined;
  const notes: string[] = [];

  const { tabs, usedHrefs, padded } = buildTabs(x.navLinks);

  const sections = buildSections(x, { title: x.ogTitle || x.title, description }, ctx);
  const intro = toSpecBlocks(x.intro, ctx.inlineImages);
  const sectionHrefs = new Set(sections.map((s) => s.href).filter((h): h is string => Boolean(h)));
  const groups = buildGroups(x, { siteName, description, usedHrefs, sectionHrefs, ctx });
  const actions = buildActions(x.ctas, host, x.url);
  const search = x.search ? buildSearch(x.search.placeholder, siteName, x.navLinks) : undefined;

  if (x.clientRendered) notes.push("Client-rendered page — showing metadata only.");
  if (x.sectionsFound > sections.length && sections.length >= 3) {
    notes.push(`Long page — showing the first ${sections.length} sections.`);
  }
  if (padded) notes.push("No navigation found; tabs are generic.");

  const spec: ScreenSpec = {
    url: x.url,
    host: x.host || host,
    title,
    siteName,
    description,
    iconDataUri: ctx.iconDataUri,
    imageDataUri: ctx.imageDataUri,
    themeColor: x.themeColor,
    tabs,
    sections,
    groups,
    actions,
    search,
    notes: notes.slice(0, MAX_NOTES),
    generator: "heuristic",
    generatedAt: (ctx.now ?? new Date()).toISOString(),
  };
  if (intro.length) spec.intro = intro;
  enforceSize(spec);
  return spec;
}

/**
 * Extracted blocks → spec blocks: identical apart from images, which only
 * survive when the orchestrator managed to inline them.
 */
function toSpecBlocks(blocks: ExtractedBlock[], images?: Map<string, string>): SpecBlock[] {
  const out: SpecBlock[] = [];
  for (const b of blocks) {
    if (b.kind !== "image") {
      out.push(b);
      continue;
    }
    const dataUri = images?.get(b.src);
    if (!dataUri) continue;
    out.push(b.alt ? { kind: "image", dataUri, alt: b.alt } : { kind: "image", dataUri });
  }
  return out;
}

/**
 * Keep the payload sendable: drop trailing in-page images first, then trailing
 * sections. Only the content counts — the icon and the og:image are the screen's
 * identity and are already capped at 350 KB each by the fetcher.
 */
function enforceSize(spec: ScreenSpec): void {
  const content = () => JSON.stringify(spec.sections).length + JSON.stringify(spec.intro ?? []).length;
  const total = () => JSON.stringify(spec).length;
  const overBudget = () => content() > MAX_SPEC_BYTES || total() > MAX_TOTAL_BYTES;
  if (!overBudget()) return;
  const lists = [...spec.sections.map((s) => s.blocks), spec.intro ?? []].reverse();
  for (const blocks of lists) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].kind !== "image") continue;
      blocks.splice(i, 1);
      if (!overBudget()) return;
    }
  }
  while (spec.sections.length > 1 && content() > MAX_SPEC_BYTES) spec.sections.pop();
}

/** Content sections: skip a heading that merely repeats the hero title / description. */
function buildSections(x: Extracted, hero: { title?: string; description?: string }, ctx: MapContext): SpecSection[] {
  const norm = (t?: string) => (t ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const heroTitle = norm(hero.title ? titleHead(hero.title) : undefined);
  const heroDesc = norm(hero.description);
  const out: SpecSection[] = [];
  for (const s of x.sections) {
    const h = norm(s.heading);
    if (!h) continue;
    // The hero heading is already the screen's title row — keep its blocks, drop the duplicate heading.
    const blocks = toSpecBlocks(s.blocks ?? [], ctx.inlineImages);
    if (h === heroTitle || (heroDesc && h === heroDesc)) {
      if (!blocks.length) continue;
    }
    if (!blocks.length && !s.href) continue;
    const section: SpecSection = { heading: truncate(s.heading, 60), blocks };
    const lead = blocks.find((b) => b.kind === "text");
    if (lead && lead.kind === "text" && norm(lead.text) !== heroDesc) section.text = lead.text;
    if (s.href) section.href = s.href;
    out.push(section);
    if (out.length >= MAX_SECTIONS) break;
  }
  return out;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "site";
  }
}

/** ≤ 18 chars: og:site_name → the page title's head ("Stripe | …" → "Stripe") → host → first words. */
function pickTitle(siteName: string | undefined, host: string, pageTitle: string | undefined): string {
  if (siteName && siteName.length <= MAX_TITLE) return siteName;
  const head = pageTitle ? titleHead(pageTitle) : "";
  if (head && head.length <= MAX_TITLE && !/^(home|welcome|homepage|start|index)$/i.test(head)) return head;
  if (host.length <= MAX_TITLE) return host;
  if (siteName) return firstWords(siteName, MAX_TITLE);
  if (pageTitle) return firstWords(pageTitle, MAX_TITLE);
  return truncate(host, MAX_TITLE);
}

/* tabs --------------------------------------------------------------- */

function buildTabs(navLinks: ExtractedLink[]): { tabs: SpecTab[]; usedHrefs: Set<string>; padded: boolean } {
  const usedHrefs = new Set<string>();
  const tabs: SpecTab[] = [{ label: "Home", icon: "home" }];
  const usedIcons = new Set<IconName>(["home"]);
  const usedLabels = new Set<string>(["home"]);

  type Candidate = { link: ExtractedLink; icon: IconName; matched: boolean; order: number };
  const candidates: Candidate[] = navLinks
    .filter((l) => !l.isHome)
    .map((link, order) => {
      const icon = iconForLink(link);
      return { link, icon: icon ?? (link.external ? "globe" : "layout-grid"), matched: Boolean(icon), order };
    })
    .filter((c) => c.icon !== "home");

  // Keyword-matched, internal links make the most app-like tabs; keep document order within a class.
  const ranked = [...candidates].sort(
    (a, b) => Number(b.matched) - Number(a.matched) || Number(a.link.external) - Number(b.link.external) || a.order - b.order,
  );

  const pick = (allowDuplicateIcon: boolean) => {
    for (const c of ranked) {
      if (tabs.length >= MAX_TABS) break;
      if (usedHrefs.has(c.link.href)) continue;
      const label = truncate(tidyLabel(c.link.text), MAX_TAB_LABEL);
      if (usedLabels.has(label.toLowerCase())) continue;
      if (!allowDuplicateIcon && usedIcons.has(c.icon)) continue;
      tabs.push({ label, icon: c.icon, href: c.link.external ? undefined : c.link.href });
      usedHrefs.add(c.link.href);
      usedIcons.add(c.icon);
      usedLabels.add(label.toLowerCase());
    }
  };
  pick(false);
  if (tabs.length < 3) pick(true);

  const padded = tabs.length < 3; // fewer than 2 nav-derived tabs
  if (padded) {
    if (!usedIcons.has("search")) tabs.push({ label: "Search", icon: "search" });
    if (tabs.length < MAX_TABS) tabs.push({ label: "More", icon: "layout-grid" });
  }

  // A news-like section goes last and gets the classic red "New" badge.
  const newsIndex = tabs.findIndex((t) => t.icon === "newspaper");
  if (newsIndex !== -1) {
    const [news] = tabs.splice(newsIndex, 1);
    tabs.push({ ...news, badge: "New" });
  }
  return { tabs: tabs.slice(0, MAX_TABS), usedHrefs, padded };
}

/* groups ------------------------------------------------------------- */

interface GroupInputs {
  siteName: string;
  description?: string;
  usedHrefs: Set<string>;
  /** Links a content section already points at — no need to repeat them in Browse. */
  sectionHrefs: Set<string>;
  ctx: MapContext;
}

function buildGroups(x: Extracted, g: GroupInputs): SpecGroup[] {
  const groups: SpecGroup[] = [];

  // 1. Hero
  const heroTitle = x.ogTitle || x.title || g.siteName;
  const hero: SpecRow = {
    title: truncate(heroTitle, MAX_ROW_TITLE),
    subtitle: g.description,
    href: x.url,
    tile: "blue",
    accessory: "chevron",
  };
  if (g.ctx.imageDataUri) hero.imageDataUri = g.ctx.imageDataUri;
  else if (g.ctx.iconDataUri) hero.imageDataUri = g.ctx.iconDataUri;
  else hero.icon = "globe";
  groups.push({ header: g.siteName, rows: [hero] });

  // 2. Browse — nav links that did not become tabs
  const browseRows: SpecRow[] = [];
  const seen = new Set<string>();
  for (const link of x.navLinks) {
    if (link.isHome || g.usedHrefs.has(link.href) || g.sectionHrefs.has(link.href)) continue;
    const key = link.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row: SpecRow = {
      title: truncate(tidyLabel(link.text), MAX_ROW_TITLE),
      href: link.href,
      icon: iconForLink(link) ?? (link.external ? "globe" : "layout-grid"),
      tile: link.external ? "blue" : "gray",
      accessory: "chevron",
    };
    if (link.external) row.subtitle = stripWww(safeHost(link.href));
    browseRows.push(row);
    if (browseRows.length >= MAX_BROWSE_ROWS) break;
  }
  if (browseRows.length) groups.push({ header: "Browse", rows: browseRows });

  // 3. Links — footer
  const footerRows: SpecRow[] = [];
  for (const link of x.footerLinks) {
    if (g.usedHrefs.has(link.href) || seen.has(link.text.toLowerCase())) continue;
    seen.add(link.text.toLowerCase());
    footerRows.push({
      title: truncate(tidyLabel(link.text), MAX_ROW_TITLE),
      href: link.href,
      icon: iconForLink(link) ?? "link",
      tile: "gray",
      accessory: "chevron",
    });
    if (footerRows.length >= MAX_FOOTER_ROWS) break;
  }
  if (footerRows.length) groups.push({ header: "Links", rows: footerRows });

  return groups;
}

/* actions ------------------------------------------------------------ */

const DESTRUCTIVE_RE = /\b(delete|cancel|unsubscribe|remove|log ?out|sign ?out|deactivate|close account)\b/i;

function buildActions(ctas: ExtractedLink[], host: string, url: string): SpecAction[] {
  const actions: SpecAction[] = [];
  const seen = new Set<string>();
  for (const cta of ctas) {
    const label = truncate(tidyLabel(cta.text), MAX_ACTION_LABEL);
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const variant: SpecAction["variant"] = DESTRUCTIVE_RE.test(cta.text) ? "destructive" : actions.length === 0 ? "primary" : "default";
    const action: SpecAction = { label, variant };
    if (cta.href) action.href = cta.href;
    actions.push(action);
    if (actions.length >= MAX_ACTIONS) break;
  }
  if (!actions.length) actions.push({ label: truncate(`Open ${host}`, MAX_ACTION_LABEL), variant: "primary", href: url });
  return actions;
}

/* search ------------------------------------------------------------- */

function buildSearch(placeholder: string | undefined, siteName: string, navLinks: ExtractedLink[]): ScreenSpec["search"] {
  const scopes = navLinks
    .filter((l) => !l.isHome)
    .map((l) => tidyLabel(l.text))
    .filter((t) => t.length <= 10)
    .filter((t, i, arr) => arr.findIndex((o) => o.toLowerCase() === t.toLowerCase()) === i)
    .slice(0, 3);
  const search: NonNullable<ScreenSpec["search"]> = {
    placeholder: placeholder && placeholder.length <= 40 ? placeholder : truncate(`Search ${siteName}`, 32),
  };
  if (scopes.length >= 2) search.scopes = scopes;
  return search;
}
