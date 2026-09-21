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
