import type { ReactNode } from "react";
import "./Screen.css";

export interface ScreenProps {
  /** Pinned to the top of the screen (a `<NavigationBar>`). */
  top?: ReactNode;
  /** Pinned to the bottom (a `<TabBar>`). */
  bottom?: ReactNode;
  /** Scrollable body. Defaults to the dark pinstripe grouped-table background. */
  children?: ReactNode;
  /** `pinstripe` (grouped lists) or `black` (plain). */
  background?: "pinstripe" | "black";
  /** Removes the body's default padding — for plain lists that bleed edge to edge. */
  flush?: boolean;
}

/** Vertical layout for one phone screen: top bar / scrolling body / bottom bar. */
export function Screen({ top, bottom, children, background = "pinstripe", flush }: ScreenProps) {
  return (
    <div className="screen">
      {top && <div className="screen__top">{top}</div>}
      <div className={`screen__body screen__body--${background}${flush ? " screen__body--flush" : ""}`}>
        {children}
      </div>
      {bottom && <div className="screen__bottom">{bottom}</div>}
    </div>
  );
}
