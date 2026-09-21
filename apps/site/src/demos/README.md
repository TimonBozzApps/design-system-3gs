# Demo contract

One file per component: `apps/site/src/demos/<Name>Demo.tsx`. It must export:

```tsx
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";
import { Button, NavigationBar } from "@3gs/ui";

export const meta: DemoMeta = {
  title: "Button",
  description: "Gel push buttons in the three iOS 3 tints.",
  usage: `<Button variant="primary">Done</Button>`,
  props: [{ name: "variant", type: '"default" | "primary" | "destructive"' }],
};

export default function ButtonDemo() {
  return (
    <Screen top={<NavigationBar title="Buttons" />}>
      {/* every variant / state, in a scrollable 320×~400 body */}
    </Screen>
  );
}
```

- `Screen` gives you `top` / `bottom` slots (pinned) and a scrolling body on the
  dark pinstripe background (`background="black"` for plain lists, `flush` to
  drop body padding).
- The demo is rendered inside `<PhoneFrame>` (320×480, `.gs-root`). Only
  components from `@3gs/ui` plus plain elements — no site-specific styling
  beyond small inline layout helpers (`<div style={{display:"grid",gap:8}}>`).
  Compose with the stable components (NavigationBar for the title, List rows
  as containers, Button as a trigger) so each screen looks like a real app
  screen — but never import a component that is being built in the same batch.
- Show **every** variant and state (default / pressed-look / disabled / with icon…).
  Interactive state (toggles, open alert) uses local `useState`.
- Do **not** touch `demos/index.ts`; it already registers `<Name>Demo`.
