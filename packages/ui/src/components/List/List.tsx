import {
  forwardRef,
  type HTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { Check, ChevronRight, CircleChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import "./List.css";

/* ==========================================================================
   List — the iOS 3 grouped table view
   ========================================================================== */

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  /** `grouped` (rounded, outlined container on the pinstripe) or `plain` (full-bleed rows). */
  variant?: "grouped" | "plain";
  /** Section header above the group — bold gray, etched. */
  header?: ReactNode;
  /** Small centered gray text under the group. */
  footer?: ReactNode;
  /** `<ListItem>`s. */
  children: ReactNode;
}

/**
 * The grouped table view: a rounded, black-outlined container of cells sitting
 * on the pinstripe background, with an optional section header and footer.
 * `variant="plain"` drops the container for edge-to-edge rows.
 */
export const List = forwardRef<HTMLDivElement, ListProps>(function List(
  { variant = "grouped", header, footer, className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn("gs-list", `gs-list--${variant}`, className)} {...rest}>
      {header !== undefined && header !== null && <div className="gs-list__header">{header}</div>}
      <div className="gs-list__group" role="list">
        {children}
      </div>
      {footer !== undefined && footer !== null && <div className="gs-list__footer">{footer}</div>}
    </div>
  );
});

/* ==========================================================================
   ListItem — one cell
   ========================================================================== */

export type ListItemAccessory =
  /** gray disclosure chevron — "tap to drill in" */
  | "chevron"
  /** blue check — the chosen option in a picker list */
  | "checkmark"
  /** blue circled chevron — the detail-disclosure button */
  | "detail"
  | "none";

export interface ListItemProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Anything, typically `<Icon icon={Star} />`; rendered inside a 29 × 29 slot. */
  icon?: ReactNode;
  /** Draw the icon slot as a glossy app-icon tile (29 × 29, radius 6, black outline). */
  iconTile?: boolean;
  /** Tile gel colour. Default `gray`. */
  iconTint?: "gray" | "blue" | "red";
  /** Bold white cell title. Ellipsises. */
  title: ReactNode;
  /** Secondary gray line under the title. Ellipsises. */
  subtitle?: ReactNode;
  /** Right-aligned blue value text, e.g. "On", "3 items". */
  detail?: ReactNode;
  /** A built-in accessory or any node (a `<Switch>`, a `<Badge>`, …). */
  accessory?: ListItemAccessory | ReactNode;
  /** Persistent blue highlight — the tapped-row state. */
  selected?: boolean;
  disabled?: boolean;
  /** Renders the row as an `<a>`. */
  href?: string;
  /** With `onClick` (and no `href`) the row renders as a `<button>`. */
  onClick?: MouseEventHandler<HTMLElement>;
}

function isBuiltInAccessory(value: unknown): value is ListItemAccessory {
  return value === "chevron" || value === "checkmark" || value === "detail" || value === "none";
}

function renderAccessory(accessory: ListItemProps["accessory"]): ReactNode {
  if (accessory === undefined || accessory === null || accessory === "none") return null;
  if (!isBuiltInAccessory(accessory)) return accessory;
  switch (accessory) {
    case "chevron":
      return (
        <Icon
          icon={ChevronRight}
          variant="flat"
          size={20}
          strokeWidth={3}
          className="gs-list-item__accessory-icon gs-list-item__accessory-icon--chevron"
        />
      );
    case "checkmark":
      return (
        <Icon
          icon={Check}
          variant="flat"
          size={20}
          strokeWidth={3}
          className="gs-list-item__accessory-icon gs-list-item__accessory-icon--checkmark"
        />
      );
    case "detail":
      return (
        <Icon
          icon={CircleChevronRight}
          variant="flat"
          size={22}
          strokeWidth={2.25}
          className="gs-list-item__accessory-icon gs-list-item__accessory-icon--detail"
        />
      );
    default:
      return null;
  }
}

/**
 * One table cell: optional 29 × 29 icon (or glossy app-icon tile), bold title
 * with subtitle, right-aligned detail text and an accessory. With `onClick` it
 * is a `<button>`, with `href` an `<a>`, otherwise a plain `listitem`.
 * Pressing (or `selected`) floods the cell with the blue gel and turns all
 * text white — exactly like tapping a row on the 3GS.
 */
export const ListItem = forwardRef<HTMLElement, ListItemProps>(function ListItem(
  {
    icon,
    iconTile = false,
    iconTint = "gray",
    title,
    subtitle,
    detail,
    accessory,
    selected = false,
    disabled = false,
    href,
    onClick,
    className,
    ...rest
  },
  ref,
) {
  const interactive = Boolean(href) || Boolean(onClick);
  const hasSubtitle = subtitle !== undefined && subtitle !== null && subtitle !== false;
  const hasDetail = detail !== undefined && detail !== null && detail !== false;
  const accessoryNode = renderAccessory(accessory);

  const classes = cn(
    "gs-list-item",
    interactive && "gs-list-item--interactive",
    selected && "gs-list-item--selected",
    disabled && "gs-list-item--disabled",
    className,
  );

  const content = (
    <>
      {icon !== undefined && icon !== null && (
        <span
          className={cn(
            "gs-list-item__icon",
            iconTile && "gs-list-item__icon--tile",
            iconTile && `gs-list-item__icon--${iconTint}`,
          )}
        >
          {icon}
        </span>
      )}
      <span className="gs-list-item__body">
        <span className="gs-list-item__title">{title}</span>
        {hasSubtitle && <span className="gs-list-item__subtitle">{subtitle}</span>}
      </span>
      {hasDetail && <span className="gs-list-item__detail">{detail}</span>}
      {accessoryNode && <span className="gs-list-item__accessory">{accessoryNode}</span>}
    </>
  );

  // Links and plain rows have no native `disabled`; swallow the click instead.
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  if (href) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        className={classes}
        href={disabled ? undefined : href}
        aria-disabled={disabled || undefined}
        aria-current={selected || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={handleClick}
        {...rest}
      >
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        className={classes}
        disabled={disabled}
        aria-current={selected || undefined}
        onClick={handleClick}
        {...rest}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      role="listitem"
      className={classes}
      aria-disabled={disabled || undefined}
      aria-current={selected || undefined}
      {...rest}
    >
      {content}
    </div>
  );
});
