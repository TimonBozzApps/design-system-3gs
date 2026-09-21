import { forwardRef, type ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import "./Button.css";

export type ButtonVariant =
  /** dark gel — the everyday button */
  | "default"
  /** blue gel — the "Done" / confirm button */
  | "primary"
  /** red gel — "Delete Contact", "Sign Out" style */
  | "destructive";

export type ButtonSize =
  /** 30 px tall, 13 px text — nav-bar / toolbar size */
  | "sm"
  /** 44 px tall, 17 px text — the standard touch target (default) */
  | "md"
  /** 50 px tall, 18 px text — prominent CTA */
  | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width — the grouped-table "Delete Contact" / "Sign Out" style. */
  block?: boolean;
  /** Any `lucide-react` icon, rendered flat in white next to the label. */
  icon?: LucideIcon;
  /** Which side of the label the icon sits on. Default: `leading`. */
  iconPosition?: "leading" | "trailing";
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 18, lg: 20 };

/**
 * The iOS 3 gel push button: a vertical gradient with a hard highlight split
 * at 50 %, a 1 px black outline with a light inner rim, and bold white text
 * with a dark text-shadow. Pressing removes the gloss and sinks the gel.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "md",
    block = false,
    icon,
    iconPosition = "leading",
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  const iconEl = icon ? (
    <Icon icon={icon} variant="flat" size={ICON_SIZE[size]} className="gs-button__icon" />
  ) : null;
  const hasLabel = children !== undefined && children !== null && children !== false;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "gs-button",
        `gs-button--${variant}`,
        `gs-button--${size}`,
        block && "gs-button--block",
        className,
      )}
      {...rest}
    >
      {iconPosition === "leading" && iconEl}
      {hasLabel && <span className="gs-button__label">{children}</span>}
      {iconPosition === "trailing" && iconEl}
    </button>
  );
});
