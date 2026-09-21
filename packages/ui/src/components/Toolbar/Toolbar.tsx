import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { useGsStrings } from "../../lib/i18n";
import { Icon } from "../Icon";
import { Badge } from "../Badge";
import "./Toolbar.css";

/* ==========================================================================
   Toolbar
   ========================================================================== */

export type ToolbarTint =
  /** black glass — `UIBarStyleBlack` (default) */
  | "black"
  /** the classic iOS 3 blue-gray bar */
  | "blue";

export type ToolbarPosition =
  /** pinned under the content: 1 px black top edge + light rim (default) */
  | "bottom"
  /** pinned above the content: 1 px black bottom edge, like a nav bar */
  | "top";

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** `black` glass (default) or the classic blue-gray bar. */
  tint?: ToolbarTint;
  /** Which edge of the screen the bar sits on — decides where the 1 px black outline goes. */
  position?: ToolbarPosition;
  /** `aria-label` for the toolbar. Default `strings.toolbar` ("Toolbar"). */
  label?: string;
  /** `<ToolbarButton>`s, `<ToolbarSpacer>`s, a `<ToolbarTitle>`, or `<BarButton>`s when an action needs a label. */
  children: ReactNode;
}

/**
 * The 44 px black-glass bottom bar of Safari / Mail (`UIToolbar`,
 * `UIBarStyleBlack`): a flex row of plain glossy icon buttons, flexible
 * spacers and an optional centred status text. Gel `<BarButton>`s drop
 * straight in when an action needs a label ("Edit", "Done").
 */
export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { tint = "black", position = "bottom", label, className, children, ...rest },
  ref,
) {
  const strings = useGsStrings();
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label ?? strings.toolbar}
      className={cn("gs-toolbar", `gs-toolbar--${tint}`, `gs-toolbar--${position}`, className)}
      {...rest}
    >
      {children}
    </div>
  );
});

/* ==========================================================================
   ToolbarSpacer — the "flexible space" item
   ========================================================================== */

/** Takes up all free width; put one on each side of an item to centre it. */
export function ToolbarSpacer() {
  return <span aria-hidden className="gs-toolbar__spacer" />;
}

/* ==========================================================================
   ToolbarButton — a plain glossy icon (no gel chrome)
   ========================================================================== */

export interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Any `lucide-react` icon — gray glass when idle, blue glass when `active`. */
  icon: LucideIcon;
  /** Accessible name for the icon-only button; also shown as the native `title` tooltip. */
  label: string;
  /** Blue glass — the current page, a bookmarked item… Pass `aria-pressed` yourself for real toggles. */
  active?: boolean;
  /** Red gel badge on the icon's top-right corner (`3`, `"New"`; numbers > 99 render `99+`). */
  badge?: number | string;
}

/**
 * The 44 × 44 tappable icon in a toolbar. There is no button chrome: the
 * icon itself is the glass. Pressing darkens it and sinks it by 1 px.
 */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  function ToolbarButton(
    { icon, label, active = false, badge, type = "button", disabled, className, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        disabled={disabled}
        className={cn(
          "gs-toolbar-button",
          active && "gs-toolbar-button--active",
          disabled && "gs-toolbar-button--disabled",
          className,
        )}
        {...rest}
      >
        <span className="gs-toolbar-button__icon">
          <Icon icon={icon} size={24} variant={active ? "active" : "gloss"} />
          <Badge value={badge} className="gs-toolbar-button__badge" />
        </span>
      </button>
    );
  },
);

/* ==========================================================================
   ToolbarTitle — the centred gray status text ("Updated 9/21/26 9:41 AM")
   ========================================================================== */

export interface ToolbarTitleProps extends HTMLAttributes<HTMLDivElement> {
  /** Primary line, e.g. `"5 Unread"`. */
  children: ReactNode;
  /** Small second line, e.g. `"Updated 9/21/26 9:41 AM"`. */
  subtitle?: ReactNode;
}

/**
 * Bold 12 px gray text centred between the toolbar's items (flank it with
 * `<ToolbarSpacer>`s). With a `subtitle` it becomes the Mail two-liner: the
 * main line turns white, the subtitle stays small and gray. Never interactive.
 */
export const ToolbarTitle = forwardRef<HTMLDivElement, ToolbarTitleProps>(function ToolbarTitle(
  { children, subtitle, className, ...rest },
  ref,
) {
  const hasSubtitle = subtitle !== undefined && subtitle !== null && subtitle !== false;

  return (
    <div
      ref={ref}
      className={cn("gs-toolbar__title", hasSubtitle && "gs-toolbar__title--stacked", className)}
      {...rest}
    >
      <span className="gs-toolbar__title-main">{children}</span>
      {hasSubtitle && <span className="gs-toolbar__title-sub">{subtitle}</span>}
    </div>
  );
});
