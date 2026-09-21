# Lessons

- **Zero-specificity resets.** A library-level reset like `button[class^="gs-"] { font-size: inherit }`
  has specificity (0,1,1) and silently beats single-class component rules. Wrap resets in
  `:where()` so any component selector wins. (Caught by the TabBar subagent, 2026-09-20.)
- **Centering a title between unequal buttons:** absolute `left/right: 20%` collides with wide
  buttons. Use grid `minmax(max-content,1fr) minmax(0,max-content) minmax(max-content,1fr)` —
  true centering when it fits, iOS-style drift when it can't, never overlap.
- **Parallel subagents on one barrel:** pre-write `index.ts` / registry files with every export
  before dispatch, and forbid agents from touching shared files. Demos must import only their
  own component so nothing depends on a sibling that may not exist yet.
- **Never monkey-patch `setTimeout` in a Playwright-MCP page** — the MCP's injected utilities use it
  and every later call hangs; and a `#hash` navigation is same-document, so the patch survives
  `browser_navigate`. For short-lived UI (auto-dismissing toasts) capture with `browser_run_code`
  (click + screenshot in one script), never click-then-screenshot across two MCP calls.
- **Theming a skeuomorphic system:** don't remap a raw token (`--gs-gradient-dark`) to mean something
  else in a theme — parts that must stay dark (icon tiles, black tab bar) silently break. Add
  *semantic* tokens (`--gs-gradient-neutral`, `--gs-gradient-barbutton`, `--gs-text-on-bar`,
  `--gs-text-emboss`) with dark defaults and have components opt in explicitly; theme files then
  only redefine tokens. Split the adoption across agents by component ownership, with the token
  file written up front so nobody edits it concurrently.
- Demo inline styles are part of the theme surface too — grep demos for hard-coded `#fff` /
  `--gs-text-shadow-dark` after adding a theme.
- **Vercel `api/` functions in a pnpm monorepo, three gotchas in a row:** (1) the nearest
  package.json needs `"type": "module"` or the compiled ESM fails with "Cannot use import statement";
  (2) Vercel compiles TS per file, so relative imports need explicit `.js` extensions (TS `bundler`
  resolution and Vite both map `./x.js` → `x.ts`); (3) the Web `Request`/`Response` signature is NOT
  applied to a default export on the Node runtime — use `(req: IncomingMessage, res: ServerResponse)`.
  Test the deployed function with curl right after the first deploy; `vercel logs <url>` shows the stack.
- **Vite dev reserves the `?url` query key** (asset import suffix) — a page URL like `/?url=x` 403s in
  dev. Pick another param name for deep links.
- **Headless Chrome is a "bot" to posthog-js** (UA contains HeadlessChrome) — it drops events. Verify
  analytics with a normal UA (`--user-agent=…`) over CDP, and keep the page open long enough to flush.
