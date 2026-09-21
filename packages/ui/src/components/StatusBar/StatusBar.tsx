import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import "./StatusBar.css";

export type StatusBarNetwork = "3G" | "E" | "wifi" | "none";

export interface StatusBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Clock text, e.g. "3:53 PM". */
  time?: string;
  /** Signal strength 0–5 bars. */
  signal?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Data indicator right of the signal bars. */
  network?: StatusBarNetwork;
  /** Carrier name instead of the signal bars' implicit "iPhone" — rendered after the network glyph. */
  carrier?: string;
  /** Battery level 0–100. */
  battery?: number;
  charging?: boolean;
  bluetooth?: boolean;
  /** Black glass (default) or the translucent gray used over photos. */
  tint?: "black" | "gray";
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The 20 px iOS 3 status bar: signal bars, network glyph, bold clock, Bluetooth
 * and battery. Purely presentational (`aria-hidden` by default — pass
 * `aria-hidden={false}` and a `role` if the values matter to assistive tech).
 */
export const StatusBar = forwardRef<HTMLDivElement, StatusBarProps>(function StatusBar(
  {
    time = "3:53 PM",
    signal = 5,
    network = "3G",
    carrier,
    battery = 100,
    charging = false,
    bluetooth = true,
    tint = "black",
    className,
    ...rest
  },
  ref,
) {
  const level = clamp(battery, 0, 100);
  const low = level <= 20 && !charging;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("gs-statusbar", `gs-statusbar--${tint}`, className)}
      {...rest}
    >
      <div className="gs-statusbar__left">
        <span className="gs-statusbar__signal" data-bars={signal}>
          <i /><i /><i /><i /><i />
        </span>
        {carrier && <span className="gs-statusbar__carrier">{carrier}</span>}
        {network === "wifi" ? (
          <svg className="gs-statusbar__wifi" width="15" height="11" viewBox="0 0 15 11" fill="currentColor">
            <path d="M7.5 9.2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Zm0-3.4c1.5 0 2.9.6 3.9 1.6l-1.3 1.3a3.7 3.7 0 0 0-5.2 0L3.6 7.4a5.5 5.5 0 0 1 3.9-1.6Zm0-3.4c2.5 0 4.7 1 6.3 2.6l-1.3 1.3A7.1 7.1 0 0 0 7.5 4.2c-2 0-3.7.8-5 2.1L1.2 5A8.9 8.9 0 0 1 7.5 2.4Z" />
          </svg>
        ) : network !== "none" ? (
          <span className="gs-statusbar__net">{network}</span>
        ) : null}
      </div>
      <div className="gs-statusbar__time">{time}</div>
      <div className="gs-statusbar__right">
        {bluetooth && (
          <svg className="gs-statusbar__bt" width="8" height="12" viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
            <path d="M1 3l6 6-3 2.5V0.5l3 2.5-6 6" />
          </svg>
        )}
        <span
          className={cn("gs-statusbar__battery", low && "gs-statusbar__battery--low", charging && "gs-statusbar__battery--charging")}
          style={{ ["--gs-battery" as string]: `${level}%` }}
        >
          <i />
          {charging && (
            <svg className="gs-statusbar__bolt" width="7" height="10" viewBox="0 0 7 10" fill="#fff" stroke="rgba(0,0,0,.6)" strokeWidth=".6">
              <path d="M4.2 0.5 0.8 5.6h2.3L2.6 9.5 6.2 4.2H3.9z" />
            </svg>
          )}
        </span>
      </div>
    </div>
  );
});
