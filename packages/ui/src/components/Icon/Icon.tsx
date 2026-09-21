import { forwardRef, type SVGAttributes } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "../../lib/cn";
import "./Icon.css";

export type IconVariant =
  /** gray glass — inactive tab icons, list glyphs */
  | "gloss"
  /** blue glass — the active/tinted state */
  | "active"
  /** plain currentColor stroke, no gel treatment */
  | "flat";

export interface IconProps extends Omit<LucideProps, "ref"> {
  /** Any `lucide-react` icon component, e.g. `Star`, `Search`, `Settings`. */
  icon: LucideIcon;
  variant?: IconVariant;
  /** Adds the etched drop-shadow that sits icons into a bar. Default: true for gel variants. */
  embossed?: boolean;
  size?: number | string;
  /** Accessible label. Omit to mark the icon decorative (`aria-hidden`). */
  label?: string;
}

const GRADIENT_ID: Record<Exclude<IconVariant, "flat">, string> = {
  gloss: "gs-icon-grad-gloss",
  active: "gs-icon-grad-active",
};

/**
 * Glossy icon wrapper around lucide-react.
 *
 * The iOS 3 "gel" look: a vertical gradient with a hard split at 50% —
 * lighter on top, deeper below — applied through the icon's stroke.
 * The `<linearGradient>` is inlined inside every SVG so the component
 * works without a global defs sheet (identical ids are harmless).
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  {
    icon: LucideCmp,
    variant = "gloss",
    embossed,
    size = 24,
    label,
    className,
    strokeWidth = 2.25,
    ...rest
  },
  ref,
) {
  const isGel = variant !== "flat";
  const showEmboss = embossed ?? isGel;
  const gradId = isGel ? GRADIENT_ID[variant] : undefined;

  const a11y: SVGAttributes<SVGSVGElement> = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": true };

  return (
    <LucideCmp
      ref={ref}
      size={size}
      strokeWidth={strokeWidth}
      className={cn(
        "gs-icon",
        `gs-icon--${variant}`,
        showEmboss && "gs-icon--embossed",
        className,
      )}
      stroke={gradId ? `url(#${gradId})` : "currentColor"}
      {...a11y}
      {...rest}
    >
      {gradId && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="gs-icon__stop-top" />
            <stop offset="50%" className="gs-icon__stop-mid-top" />
            <stop offset="50.5%" className="gs-icon__stop-mid-bottom" />
            <stop offset="100%" className="gs-icon__stop-bottom" />
          </linearGradient>
        </defs>
      )}
    </LucideCmp>
  );
});
