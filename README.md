# 3GS UI

A React design system that reproduces the **iPhone 3GS / iOS 3** look — glossy
"gel" skeuomorphism — recast in **dark mode**. Vertical gradients with the hard
50 % highlight, 1 px black outlines with an inner light rim, embossed type,
pinstripe grouped tables, the blue ON/OFF switch, the black glass tab bar.
Icons come from [lucide](https://lucide.dev) and are tinted through an SVG
gradient so they get the same glass treatment.

```
packages/ui     @3gs/ui — the component library (React 18/19, TypeScript, plain CSS tokens)
apps/site       the showcase site (Vite) — every component inside a 320×480 phone frame
```

## Components (v0.3)

| Component | What it is |
| --- | --- |
| `Button` | Gel push buttons — default / primary (blue) / destructive (red), 3 sizes, block |
| `Switch` | The 94×27 ON/OFF slider with the sliding blue/dark strip and silver knob |
| `TextField`, `SearchField` | Sunken inputs with inline labels, clear button, and the pill search bar |
| `NavigationBar`, `BarButton` | 44 px black glass top bar, centered title, pointed back button |
| `TabBar`, `TabBarItem` | 49 px bottom bar with gradient icons, selected state, red badges |
| `List`, `ListItem` | Grouped / plain table views: icon tiles, chevrons, detail text, headers, footers |
| `Alert` | The deep-blue modal alert with the top gloss and stacked / paired gel buttons |
| `SegmentedControl`, `Segment` | Gel bar cut into equal segments, selected one sunken blue |
| `Slider` | Native range input styled as the volume slider: blue fill, silver knob, end icons |
| `ActionSheet` | Bottom sheet that slides up: silver / red / dark-cancel gel buttons |
| `Picker` | The spinning wheel — scroll-snap drums, cylinder shading, glass selection bar |
| `ProgressBar`, `ActivityIndicator` | Blue gel progress bar and the 12-spoke stepped spinner |
| `StatusBar` | The 20 px strip: signal bars, 3G / EDGE / Wi-Fi, clock, Bluetooth, gel battery |
| `Toolbar`, `ToolbarButton`, `ToolbarSpacer`, `ToolbarTitle` | Bottom black bar with plain glossy icon buttons and centred status text |
| `PageControl` | The dots — tap a half to page, arrow keys, clickable dots |
| `Popover` | The iPad 3.2 dark bubble with an arrow; auto-flips and clamps, portal or contained |
| `HUD` | Translucent black square: spinner / progress / check / error / text toast, auto-dismiss |
| `Keyboard` | Dark alert-style QWERTY with letters / numbers / symbols, shift + caps, key popup, delete repeat, `value`/`onChange` binding |
| `Icon`, `Badge` | Foundation: glossy lucide wrapper and the red gel badge |

## Use

```bash
pnpm add @3gs/ui lucide-react
```

```tsx
import "@3gs/ui/styles.css";
import { NavigationBar, BarButton, List, ListItem, Icon } from "@3gs/ui";
import { Gamepad2 } from "lucide-react";

<div className="gs-root">
  <NavigationBar title="Categories" left={<BarButton variant="back">Featured</BarButton>} />
  <List>
    <ListItem iconTile icon={<Icon icon={Gamepad2} />} title="Games" accessory="chevron" onClick={…} />
  </List>
</div>
```

Wrap your app (or any subtree) in `.gs-root` to get the font, colours and
black background. Tokens are CSS custom properties prefixed `--gs-`
(`packages/ui/src/tokens/tokens.css`); override them on `.gs-root` to retint.

## Develop

```bash
pnpm install
pnpm dev          # showcase at http://localhost:5173, consumes the lib from source
pnpm build        # builds the lib (dist/index.js, index.cjs, ui.css, .d.ts) and the site
pnpm typecheck
```

Adding a component: read `packages/ui/CONTRIBUTING.md`.
