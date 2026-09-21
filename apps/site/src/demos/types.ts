import type { ComponentType } from "react";

export interface DemoMeta {
  /** Section heading, e.g. "Button". */
  title: string;
  /** One or two sentences: what it is and the iOS 3 detail it reproduces. */
  description: string;
  /** Minimal JSX usage snippet shown next to the phone. */
  usage: string;
  /**
   * Exported prop interfaces to document, e.g. `["ListProps", "ListItemProps"]`.
   * Their tables are generated from the library's TypeScript types
   * (`pnpm --filter site props` → `generated/props.json`).
   */
  propTypes?: string[];
  /**
   * Hand-written hints. With `propTypes` set, a hint whose `name` matches a
   * generated row (`"variant"`, `"header / footer"`, `"TabBarItem.badge"`) is
   * appended to that row's description; without `propTypes` they render as
   * the compact list.
   */
  props?: Array<{ name: string; type: string; note?: string }>;
}

export interface DemoModule {
  meta: DemoMeta;
  default: ComponentType;
}
