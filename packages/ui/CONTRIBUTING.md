# @3gs/ui — component contract

Read this before adding a component. It is the shared agreement that lets
components be built in parallel and still feel like one system.

## The aesthetic (iPhone 3GS, iOS 3, dark mode)

Skeuomorphic "gel" glass. Every surface is a vertical gradient with a **hard
highlight split at 50 %** (lighter top half, deeper bottom half). Edges are a
1 px near-black outline with a 1 px light inner rim on top. White text on dark
gel always carries `text-shadow: var(--gs-text-shadow-dark)`. Nothing is flat.
Reference: the black glass tab bar / nav bar (`UIBarStyleBlack`), the blue
"Done" button, the ON/OFF switch, grouped table cells on a pinstripe background.

Tokens live in `src/tokens/tokens.css` (prefix `--gs-`). Use them; do not
hard-code colours. Gradients you will reach for most:
`--gs-gradient-bar` (bars), `--gs-gradient-dark` (default gel),
`--gs-gradient-blue` (primary / on), `--gs-gradient-red` (destructive),
each with a `-pressed` twin, and `--gs-gloss` — a transparent white-highlight
overlay to layer on top of anything (`background: var(--gs-gloss), <base>`).

## Files

```
src/components/<Name>/
  <Name>.tsx     component(s) — named exports only, `forwardRef`, typed props
  <Name>.css     styles — plain CSS, imported by the .tsx (`import "./<Name>.css"`)
  index.ts       `export { X } from "./<Name>"; export type { XProps } from "./<Name>";`
```
`src/index.ts` already re-exports `./components/<Name>` — do not edit it.

## Rules

- **Class names**: BEM with the `gs-` prefix: `.gs-button`, `.gs-button--primary`,
  `.gs-button__label`. States as modifiers: `--pressed`, `--disabled`, `--active`.
- **Props**: extend the native element's props (`ButtonHTMLAttributes<…>` etc.),
  accept `className` and merge it with `cn()` from `src/lib/cn.ts`. Forward refs.
- **Controlled + uncontrolled** where it makes sense (`checked` / `defaultChecked`
  + `onChange`).
- **Accessibility**: native elements first (`<button>`, `<input>`), correct roles
  and `aria-*` otherwise, keyboard operable, visible focus (`:focus-visible` →
  `box-shadow: var(--gs-focus-ring)`).
- **Pressed state**: use `:active` (and a `--pressed` class if needed) with the
  `-pressed` gradient + `inset 0 2px 4px rgba(0,0,0,.6)`. iOS 3 had no hover —
  keep hover effects nil or extremely subtle.
- **Icons**: use `<Icon icon={Star} variant="gloss|active|flat" />` from
  `src/components/Icon` with any `lucide-react` icon. Don't add other icon libs.
- **Badges**: `<Badge value={3} />` from `src/components/Badge`.
- **No new dependencies.** React + lucide-react only.
- **Sizing**: touch targets 44 px tall (`--gs-control-height`). Font sizes and
  radii from tokens. Components are `display: flex/inline-flex`, never rely on
  global resets beyond `src/styles/base.css`.
- **Themes**: read *semantic* tokens (`--gs-gradient-neutral`, `--gs-gradient-barbutton`,
  `--gs-text-on-bar`, `--gs-text-emboss`, …) so `data-theme="light"` works; never remap a raw
  gel token. Parts that are always dark (tab bar, HUD) pin their own values.
- **RTL**: logical properties only (`padding-inline-start`, `inset-inline-end`,
  `text-align: start`, `border-inline-*`). Anything that must mirror geometrically
  (clip-paths, `translateX`, background anchors, chevrons) gets an
  `:is([dir="rtl"] .gs-x, .gs-x:dir(rtl))` override in the same file.
- **Strings**: no hard-coded UI text or aria-labels — read `useGsStrings()` from
  `src/lib/i18n.tsx` as the default and let an explicit prop override it. Add new
  keys to `GsStrings` + `defaultStrings`.
- **Docs**: JSDoc every prop (one line, `@default` where it isn't obvious) — the
  showcase's prop tables are generated from the types (`pnpm props`).
- **Demo**: also write `apps/site/src/demos/<Name>Demo.tsx` (see
  `apps/site/src/demos/README.md`) and set `meta.propTypes` to your interfaces.
- Typecheck with `pnpm --filter @3gs/ui typecheck` (other components may still
  be missing while work is parallel — only your files must be error-free).
