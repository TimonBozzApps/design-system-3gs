# 3GS Design System — plan

Goal: React design system in the iPhone 3GS / iOS 3 aesthetic, dark-mode glossy/glassy skeuomorphic.
Library `@3gs/ui` (packages/ui) + showcase site (apps/site). Icons via lucide-react with a gloss treatment.

## Foundation (main agent)
- [x] pnpm monorepo scaffold (root, packages/ui, apps/site), TS, Vite lib mode + dts
- [x] tokens.css (colors, gloss gradients, shadows, radii, type) + base.css
- [x] `cn` helper, `Icon` (glossy gradient-stroke lucide wrapper), `Badge` (used by TabBar)
- [x] Component contract doc for subagents (`packages/ui/CONTRIBUTING.md`)

## Components (one subagent each, parallel)
- [x] Button — default/primary/destructive/back variants, sizes, disabled, pressed gel look
- [x] Switch — the ON/OFF blue-white slider, controlled/uncontrolled, keyboard a11y
- [x] TextField — inset field + SearchField variant, clear button, label/helper
- [x] NavigationBar — black glass bar, title, left/right slots, BackButton
- [x] TabBar — black glass bar, gradient icons, active state, red badge
- [x] List — GroupedList/ListItem: icon, title, subtitle, detail, chevron, switch accessory
- [x] Alert — glossy blue-black modal dialog, title/message/actions, backdrop

## Showcase (after components)
- [x] apps/site: phone-frame mock (status bar, 320×480 screen), one section per component
- [x] Wire demos, build, screenshot-verify via Playwright

## Verify
- [x] `pnpm -r typecheck` + `pnpm -r build` green
- [x] Visual check of every component in the browser

## Review (2026-09-20)
- 7 components + Icon/Badge foundation shipped; `pnpm -r typecheck` and `pnpm build` green.
  Lib: dist/index.js 21.8 kB, ui.css 27 kB, full .d.ts. Site: apps/site/dist.
- Visual + functional verification in Playwright: every section screenshotted; switch toggle,
  controlled echo, tab click + arrow-key roving focus, text-field clear, alert open/close, list
  rows as <button> all confirmed.
- Fixed during integration:
  - base.css control reset had (0,1,1) specificity and overrode component font sizes → `:where()`.
  - NavigationBar title was absolute at 20 %/80 % and overlapped wide buttons → 3-column grid
    `minmax(max-content,1fr) minmax(0,max-content) minmax(max-content,1fr)`.
  - Site prop table overflowed on long names; dark code scrollbars; favicon.
- Added a composed App Store "Categories" hero screen (nav bar + list + tab bar + alert).
- Next batch candidates: SegmentedControl, Slider, ActionSheet, Picker, Toolbar, Checkbox/Radio
  rows, ProgressBar, PageControl, Keyboard.

## Batch 2 (2026-09-20) — one subagent each, parallel
- [ ] SegmentedControl — gel pill of segments, selected = sunken blue, keyboard roving
- [ ] Slider — blue fill track + silver knob, optional min/max icons, keyboard + pointer
- [ ] ActionSheet — bottom sheet, stacked gel buttons (destructive red, cancel dark), slide-up
- [ ] Picker — the wheel: scroll-snap columns, curved shading, selection bar
- [ ] Progress — ProgressBar (blue gel fill) + ActivityIndicator (12-spoke spinner)
- [ ] Integrate: typecheck, build, browser verification, README table
- Batch 2 review: typecheck + build green (lib 39 kB JS / 42 kB CSS). Browser-verified every screen;
  functional: segmented select, slider value, sheet open/focus/cancel, picker scroll+key+click sync
  with controlled value, progress simulation. Fixed: duplicate `size` prop key in ProgressDemo meta.

## Batch 3 (2026-09-21)
- [ ] StatusBar → promoted from site shell into the lib (main agent)
- [ ] Toolbar — bottom black bar, plain glossy icon buttons, spacer, centered title
- [ ] PageControl — the dots, clickable + keyboard
- [ ] Popover — dark bubble with arrow, anchored positioning, contained or portal
- [ ] HUD — translucent black square: spinner / progress / check / text toast, auto-dismiss
- [ ] Keyboard — dark alert-style keyboard, letters/numbers/symbols, shift, key popup, value binding
- [ ] Integrate: typecheck, build, browser verification, README
- Batch 3 review: typecheck + build green (lib 63 kB JS / 58 kB CSS, 30 exports). Browser-verified all
  six: status-bar states, toolbar (Mail/Safari), page-control ↔ pager sync, popover bottom/top +
  outside dismiss, HUD 4 kinds (captured in one Playwright script — auto-dismiss is shorter than the
  MCP screenshot round trip), keyboard typing/shift/popup/layers/delete-repeat/Send.
  Site: prop tables are now one shared grid (`display: contents` rows) so columns align.

## Batch 4 (2026-09-21)
- [x] git init + initial commit
- [ ] Light theme tokens (`tokens/theme-light.css`, semantic tokens) — main agent
- [ ] Light theme: core components adopt semantic tokens (Button, Switch, TextField, NavigationBar, TabBar, List, Alert, Badge, Icon) — agent A
- [ ] Light theme: extended components (SegmentedControl, Slider, ActionSheet, Picker, Progress, StatusBar, Toolbar, PageControl, Popover, HUD, Keyboard) — agent B
- [ ] DatePicker — date / time / dateTime presets on Picker
- [ ] ModalSheet — full-screen modal that slides up with its own nav bar
- [ ] Tokens docs section on the site
- [ ] Site theme toggle (sidebar switch → data-theme on every phone screen) — main agent
- [ ] Integrate, verify both themes, commit
- Batch 4 review: light theme verified on all 20 screens (grid captures), dark spot-checked unchanged;
  DatePicker time mode + ModalSheet focus/Escape + tokens gallery (64 cards) verified. Lib 71 kB JS /
  72 kB CSS, 32 exports. Repo initialised; 3 commits.

## Batch 5 (2026-09-21) — "do all that"
- [x] Publish setup: package metadata (MIT, repo, keywords, files, publishConfig), package README, LICENSE,
      changesets (config + initial minor changeset), `pnpm release` / `pack:check`, CI + Release workflows
- [ ] Props docs generated from TS types (scripts/extract-props.mjs → generated/props.json → PropsTable)
- [ ] RTL pass (logical properties, mirrored back button / chevrons / switch / slider; RTL demo; sidebar toggle done)
- [ ] i18n: GsProvider + GsStrings, all built-in strings overridable; Localization demo
- [ ] Figma export: DTCG token JSON (dark/light) + SVG gel sticker sheets, `pnpm design:export`
- [ ] Stepper, SearchBar (scopes), NotificationBanner
- [ ] Integrate: typecheck, build, browser verification (both themes + RTL), tarball smoke test, changeset version → CHANGELOG, commit
- Batch 5 review: 23 components / 39 exports; props.json 57 types · 313 props; tarball smoke test
  (ESM+CJS+CSS+SSR+GsProvider) green; light+RTL verified visually; `changeset version` → 0.1.0 +
  CHANGELOG. Open: portaled overlays inherit document dir (documented); Figma import drops filters
  (documented in design/README.md).

## Batch 6 (2026-09-21) — "3GS-ify a website" preview
- [x] Contract `api/_lib/spec.ts` (ScreenSpec), Vite dev middleware for /api/preview, placeholder section
- [x] Server: safe fetcher (SSRF guard, redirects, limits), extractor, heuristic mapper, LRU cache, Vercel function with rate limit — agent
- [x] Client: SpecScreen renderer, section UI (input, chips, HUD/Alert states), PNG export, Copy JSX, ?url= deep link, analytics — agent
- [x] Integrate: typecheck, local end-to-end, deploy, verify /api/preview on Vercel, README
- Batch 6 review: prod /api/preview → vercel.com 0.7 s, posthog.com 1.0 s (OG image), github.com 0.6 s;
  SSRF/invalid cases 400; in-function cache hit on repeat. Both agents were cut off by the session
  limit mid-verification; I finished: truncating 4 MB read cap (posthog.com was too_large), mega-menu
  link labels (first text chunk), title from <title> head, ?site= deep link (Vite reserves ?url).
- [x] Navigable phone: tabs replace the root page, rows push screens with Back, pages render
      `sections` (heading + lead copy); subpage hero image deduped against the site's; "Open original ↗"

## Batch 7 (2026-09-22) — more content + shareable page
- [x] Contract: `SpecBlock` union (text/list/stat/qa/quote/image/code/link), `SpecSection.blocks`, `ScreenSpec.intro`; /p/ rewrite in vercel.json
- [x] Server: rich extraction (paragraphs, bullets, prices/stats, FAQ, quotes, in-page images, code), 10 sections × 8 blocks, drop the redundant Highlights group — agent
- [x] Client: render every block kind as iOS grouped-table cells — agent
- [x] Share page `/p/<site>`: phone only, meta injection via api/share.ts, og image proxy api/image.ts, dev parity — agent
- [x] Integrate: Share button in the preview UI, typecheck, build, deploy, verify unfurl
- Batch 7 review: content blocks 26 → 143 across 8 test pages (posthog/pricing 6→19, stripe 1→42,
  wikipedia 6→27, tailwind 6→26); every page now has copy to read. Share page /p/<site> with injected
  og:title/description/image + /api/image proxy; phone scales up on large screens. Smoke: positives ok
  (0.2–2.2 s), negatives rejected (the 4 MB page is truncated, not rejected — expectation updated).
- [x] Feed/index pages (HN, changelogs, blog indexes): structural-signature item detection → a feed
      group with title + meta rows; feed titles wrap to 2 lines; status-bar carrier drops when too long
