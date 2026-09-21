import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import "./Badge.css";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Number or short text. Numbers above `max` render as `max+`. */
  value?: number | string;
  max?: number;
  /** Red gel (default) or the quieter gray used inside list cells. */
  tone?: "red" | "gray";
}

/**
 * The classic red gel badge (unread counts on tab-bar icons, app icons).
 * Renders nothing when `value` is `0`, `""` or undefined.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { value, max = 99, tone = "red", className, ...rest },
  ref,
) {
  if (value === undefined || value === "" || value === 0) return null;
  const text = typeof value === "number" && value > max ? `${max}+` : String(value);

  return (
    <span ref={ref} className={cn("gs-badge", `gs-badge--${tone}`, className)} {...rest}>
      {text}
    </span>
  );
});
