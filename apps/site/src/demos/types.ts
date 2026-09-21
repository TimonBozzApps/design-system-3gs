import type { ComponentType } from "react";

export interface DemoMeta {
  /** Section heading, e.g. "Button". */
  title: string;
  /** One or two sentences: what it is and the iOS 3 detail it reproduces. */
  description: string;
  /** Minimal JSX usage snippet shown next to the phone. */
  usage: string;
  /** Prop names worth calling out, shown as a compact list. */
  props?: Array<{ name: string; type: string; note?: string }>;
}

export interface DemoModule {
  meta: DemoMeta;
  default: ComponentType;
}
