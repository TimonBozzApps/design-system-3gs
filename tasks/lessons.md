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
