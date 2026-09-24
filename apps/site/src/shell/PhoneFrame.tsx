import { useEffect, useRef, useState, type ReactNode } from "react";
import { HUD, StatusBar, type StatusBarProps } from "@3gs/ui";
import "./PhoneFrame.css";

export interface PhoneFrameProps {
  children: ReactNode;
  /** Props for the library StatusBar at the top of the screen. */
  statusBar?: StatusBarProps;
  /** Theme applied to the screen's `.gs-root`. */
  theme?: "dark" | "light";
  /** Writing direction of the screen. */
  dir?: "ltr" | "rtl";
  /**
   * Sample screens: a tap that changes nothing gets a short "this is a sample"
   * HUD instead of silence. Visitors rage-click dead bar buttons otherwise.
   */
  hints?: boolean;
}

/**
 * A stylised iPhone 3GS bezel with a 320×480 screen. The screen root carries
 * `.gs-root` so components render on the system's black background.
 */
export function PhoneFrame({ children, statusBar, theme = "dark", dir = "ltr", hints = false }: PhoneFrameProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(false);
  const hintRef = useRef(false);
  hintRef.current = hint;

  // A control that does nothing looks broken. Watch the screen for 150 ms after
  // a tap: if nothing at all changed, the control was decorative — say so.
  useEffect(() => {
    const root = contentRef.current;
    if (!hints || !root || typeof MutationObserver === "undefined") return;

    const onClick = (event: MouseEvent) => {
      if (hintRef.current) return;
      const target = event.target as HTMLElement | null;
      const control = target?.closest?.("button, a, [role='listitem'], [role='switch'], input");
      if (!control || !root.contains(control)) return;

      let changed = false;
      const observer = new MutationObserver(() => {
        changed = true;
      });
      observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
      window.setTimeout(() => {
        observer.disconnect();
        if (!changed) setHint(true);
      }, 150);
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [hints]);

  return (
    <div className="phone">
      <div className="phone__speaker" />
      <div className="phone__screen gs-root" data-theme={theme} dir={dir}>
        <StatusBar {...statusBar} />
        <div className="phone__content" ref={contentRef}>
          {children}
          {hints && (
            <HUD
              contained
              open={hint}
              kind="text"
              title="Sample screen. Paste your own URL at the top."
              duration={1600}
              onClose={() => setHint(false)}
            />
          )}
        </div>
      </div>
      <div className="phone__home">
        <span className="phone__home-square" />
      </div>
    </div>
  );
}
