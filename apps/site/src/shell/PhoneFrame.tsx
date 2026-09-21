import type { ReactNode } from "react";
import { StatusBar, type StatusBarProps } from "@3gs/ui";
import "./PhoneFrame.css";

export interface PhoneFrameProps {
  children: ReactNode;
  /** Props for the library StatusBar at the top of the screen. */
  statusBar?: StatusBarProps;
  /** Theme applied to the screen's `.gs-root`. */
  theme?: "dark" | "light";
}

/**
 * A stylised iPhone 3GS bezel with a 320×480 screen. The screen root carries
 * `.gs-root` so components render on the system's black background.
 */
export function PhoneFrame({ children, statusBar, theme = "dark" }: PhoneFrameProps) {
  return (
    <div className="phone">
      <div className="phone__speaker" />
      <div className="phone__screen gs-root" data-theme={theme}>
        <StatusBar {...statusBar} />
        <div className="phone__content">{children}</div>
      </div>
      <div className="phone__home">
        <span className="phone__home-square" />
      </div>
    </div>
  );
}
