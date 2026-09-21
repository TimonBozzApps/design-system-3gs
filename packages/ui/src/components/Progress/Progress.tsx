import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { useGsStrings } from "../../lib/i18n";
import "./Progress.css";

/* ==========================================================================
   ProgressBar — the App Store / iPod download bar
   ========================================================================== */

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** `0..max`. Omit for an indeterminate bar (a gel segment sliding back and forth). */
  value?: number;
  /** Default 100. */
  max?: number;
  /** Track height: `sm` 9 px (default) or `md` 12 px. */
  size?: "sm" | "md";
  /** Show the percentage ("42 %") to the right of the track. */
  showValue?: boolean;
  /** Accessible name (`aria-label`). */
  label?: string;
  /** Fill gel: `blue` (App Store, default) or the silver iPod scrubber. */
  tint?: "blue" | "gray";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * A thin sunken pill track (inset shadow, black outline) holding a blue gel
 * fill with its own hard 50 % highlight — the App Store download bar.
 * Without `value` it is indeterminate: a 35 % segment slides left and right.
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, max = 100, size = "sm", showValue = false, label, tint = "blue", className, ...rest },
  ref,
) {
  const indeterminate = value === undefined || Number.isNaN(value);
  const now = indeterminate ? undefined : clamp(value, 0, max);
  const pct = now === undefined || max <= 0 ? 0 : (now / max) * 100;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-busy={indeterminate || undefined}
      className={cn(
        "gs-progress",
        `gs-progress--${size}`,
        `gs-progress--${tint}`,
        indeterminate && "gs-progress--indeterminate",
        className,
      )}
      {...rest}
    >
      <span className="gs-progress__track">
        <span
          className="gs-progress__fill"
          // A started download always shows a sliver of gel, even at 1 %.
          style={indeterminate ? undefined : { width: `${pct}%`, minWidth: pct > 0 ? 6 : 0 }}
        />
      </span>
      {showValue && (
        <span className="gs-progress__value">{indeterminate ? "" : `${Math.round(pct)} %`}</span>
      )}
    </div>
  );
});

/* ==========================================================================
   ActivityIndicator — UIActivityIndicatorView
   ========================================================================== */

export interface ActivityIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  /** Diameter in px. 20 (default) is the "white" / "gray" style, 37 the "whiteLarge" style. */
  size?: number;
  /** Spoke colour: `white` (default, for dark surfaces) or `gray`. */
  tone?: "white" | "gray";
  /** Accessible name, announced via `role="status"`. Default `strings.loading` ("Loading"). */
  label?: string;
  /** `false` renders nothing — `hidesWhenStopped`. Default `true`. */
  animating?: boolean;
}

/** 12 spokes, the head (i = 0) opaque and each spoke behind it (counter-clockwise) a step fainter. */
const SPOKES = Array.from({ length: 12 }, (_, i) => ({
  angle: i * 30,
  opacity: 1 - ((12 - i) % 12) * 0.065,
}));

/**
 * The 12-spoke spinner. The fading spokes are static; the whole wheel turns
 * 360° in 12 discrete 30° steps per second, exactly like the frame-stepped
 * original — a smooth rotation would give it away.
 */
export const ActivityIndicator = forwardRef<HTMLSpanElement, ActivityIndicatorProps>(
  function ActivityIndicator(
    { size = 20, tone = "white", label, animating = true, className, ...rest },
    ref,
  ) {
    const strings = useGsStrings();
    if (!animating) return null;

    return (
      <span
        ref={ref}
        role="status"
        aria-label={label ?? strings.loading}
        className={cn("gs-spinner", `gs-spinner--${tone}`, className)}
        {...rest}
      >
        <svg
          className="gs-spinner__svg"
          viewBox="0 0 40 40"
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          {SPOKES.map(({ angle, opacity }) => (
            <rect
              key={angle}
              className="gs-spinner__spoke"
              x={18}
              y={3}
              width={4}
              height={10}
              rx={2}
              transform={`rotate(${angle} 20 20)`}
              opacity={opacity}
            />
          ))}
        </svg>
      </span>
    );
  },
);
