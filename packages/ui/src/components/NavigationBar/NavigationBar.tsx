import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import "./NavigationBar.css";

/* ==========================================================================
   NavigationBar
   ========================================================================== */

export type NavigationBarTint =
  /** black glass — `UIBarStyleBlack` (default) */
  | "black"
  /** the classic iOS 3 blue-gray bar */
  | "blue";

export interface NavigationBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Bold 20 px white title, centred over the full bar width; ellipsised when too long. */
  title?: ReactNode;
  /** Left slot — usually a `<BarButton variant="back">`. */
  left?: ReactNode;
  /** Right slot — usually a `<BarButton variant="done">` or a default bar button. */
  right?: ReactNode;
  /** `black` glass (default) or the classic blue-gray bar. */
  tint?: NavigationBarTint;
}

/**
 * The 44 px top bar: a vertical gradient with the hard highlight split at 50 %,
 * a 1 px light rim on top and a 1 px black bottom edge. The title is centred
 * over the whole width so it stays put regardless of how wide the buttons are.
 */
export const NavigationBar = forwardRef<HTMLDivElement, NavigationBarProps>(
  function NavigationBar({ title, left, right, tint = "black", className, ...rest }, ref) {
    const hasTitle = title !== undefined && title !== null && title !== false;

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn("gs-navbar", `gs-navbar--${tint}`, className)}
        {...rest}
      >
        <div className="gs-navbar__left">{left}</div>
        {hasTitle && <div className="gs-navbar__title">{title}</div>}
        <div className="gs-navbar__right">{right}</div>
      </div>
    );
  },
);

/* ==========================================================================
   BarButton
   ========================================================================== */

export type BarButtonVariant =
  /** dark gel — the everyday bar button */
  | "default"
  /** the left-pointing arrow shape */
  | "back"
  /** blue gel — the primary action ("Done", "Save") */
  | "done";

export interface BarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BarButtonVariant;
  /** Any `lucide-react` icon, rendered flat in white before the label. */
  icon?: LucideIcon;
}

/**
 * The small 30 px gel button that lives in navigation bars and toolbars.
 * `variant="back"` draws the pointed pill: two clipped layers (black
 * silhouette + inset gel) stand in for the border that `clip-path` would cut off.
 */
export const BarButton = forwardRef<HTMLButtonElement, BarButtonProps>(function BarButton(
  { variant = "default", icon, type = "button", className, children, ...rest },
  ref,
) {
  const hasLabel = children !== undefined && children !== null && children !== false;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "gs-barbutton",
        `gs-barbutton--${variant}`,
        !hasLabel && "gs-barbutton--icon-only",
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} variant="flat" size={16} className="gs-barbutton__icon" />}
      {hasLabel && <span className="gs-barbutton__label">{children}</span>}
    </button>
  );
});
