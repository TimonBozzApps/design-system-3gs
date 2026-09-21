import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import "./Popover.css";

export type PopoverPlacement = "top" | "bottom" | "left" | "right";

export interface PopoverProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  /**
   * The element the arrow points at — pass `ref.current`. Re-measured on
   * open, on window resize and on any scroll.
   */
  anchor: HTMLElement | null;
  /** Called on Escape and on an outside click / tap (when `dismissOnOutside`). */
  onClose?: () => void;
  /** Preferred side. Default `"bottom"`; flips to the opposite side when there is no room. */
  placement?: PopoverPlacement;
  /**
   * Panel width (the box inside the 8 px rim). Default `240` — iPad popovers
   * were 320, a phone screen wants narrower.
   */
  width?: number | string;
  /**
   * Default `false` → portal to `document.body`, `position: fixed`, viewport
   * coordinates. `true` → render in place with `position: absolute`,
   * coordinates relative to the nearest positioned ancestor's padding box
   * (e.g. a phone screen in a showcase) and clamped within it.
   */
  contained?: boolean;
  /** Default `true` — a click outside the panel closes it. */
  dismissOnOutside?: boolean;
  /** `aria-label` for the `role="dialog"` panel when there is no heading inside. */
  label?: string;
  children: ReactNode;
}

/* ---- geometry (keep in sync with Popover.css) ------------------------- */
/** Anchor edge → arrow tip. Overridable via `--gs-popover-gap`. */
const GAP_DEFAULT = 8;
/** The translucent rim painted outside the panel box (box-shadow rings). */
const RIM = 8;
/** Arrow height beyond the rim: half the diagonal of the 17 px rotated square. */
const ARROW = 12;
/** Minimum distance between the visible bubble (incl. rim) and the container edges. */
const EDGE = 8;
/** …hence between the panel box and the container edges. */
const INSET = EDGE + RIM;
/** The arrow centre stays this far from the panel's corners (clear of the rim's 16 px radius). */
const ARROW_MIN = 20;

const OPPOSITE: Record<PopoverPlacement, PopoverPlacement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Position {
  /** The side of the anchor the panel ended up on. */
  side: PopoverPlacement;
  top: number;
  left: number;
  /** Arrow centre along the panel's anchor-facing edge; `null` = no anchor, no arrow. */
  arrowOffset: number | null;
  maxWidth: number;
  maxHeight: number;
}

function viewportBox(): Box {
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function samePosition(a: Position, b: Position): boolean {
  return (
    a.side === b.side &&
    a.top === b.top &&
    a.left === b.left &&
    a.arrowOffset === b.arrowOffset &&
    a.maxWidth === b.maxWidth &&
    a.maxHeight === b.maxHeight
  );
}

/**
 * The iOS 3.2 popover (`UIPopoverController`): a dark navy-black bubble with
 * a thick translucent rim and a triangular arrow pointing at its anchor, used
 * for menus and dropdowns. Positioned on the preferred side of the anchor
 * (flipping when there is no room), centred on it and clamped inside the
 * container; the arrow keeps pointing at the anchor after clamping. Renders
 * nothing while `open` is false. The ref points at the panel.
 */
export const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  {
    open,
    anchor,
    onClose,
    placement = "bottom",
    width = 240,
    contained = false,
    dismissOnOutside = true,
    label,
    className,
    style,
    children,
    ...rest
  },
  ref,
) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const [position, setPosition] = useState<Position | null>(null);

  // Keep the latest onClose reachable from the document listener without
  // re-subscribing on every render (callers usually pass an inline arrow).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /* ---- positioning ---------------------------------------------------- */
  const measure = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Container: the offset parent's padding box (contained) or the viewport.
    let box: Box = viewportBox();
    if (contained) {
      const parent = panel.offsetParent;
      if (parent) {
        const r = parent.getBoundingClientRect();
        box = { top: r.top, left: r.left, width: r.width, height: r.height };
      }
    }

    const gapValue = parseFloat(getComputedStyle(panel).getPropertyValue("--gs-popover-gap"));
    const gap = Number.isFinite(gapValue) ? gapValue : GAP_DEFAULT;
    const offset = gap + RIM + ARROW;

    // offsetWidth/Height ignore the entrance transform, unlike getBoundingClientRect.
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;

    let next: Position;

    if (!anchor) {
      // Nothing to point at: sit in the middle of the container, arrowless.
      const maxWidth = Math.max(0, box.width - 2 * INSET);
      const maxHeight = Math.max(0, box.height - 2 * INSET);
      const w = Math.min(panelW, maxWidth);
      const h = Math.min(panelH, maxHeight);
      next = {
        side: placement,
        top: Math.round((box.height - h) / 2),
        left: Math.round((box.width - w) / 2),
        arrowOffset: null,
        maxWidth,
        maxHeight,
      };
    } else {
      const a = anchor.getBoundingClientRect();
      const anchorTop = a.top - box.top;
      const anchorLeft = a.left - box.left;
      const anchorBottom = anchorTop + a.height;
      const anchorRight = anchorLeft + a.width;
      const centreX = anchorLeft + a.width / 2;
      const centreY = anchorTop + a.height / 2;

      // Room between the anchor and the container edge on each side.
      const room: Record<PopoverPlacement, number> = {
        top: anchorTop,
        bottom: box.height - anchorBottom,
        left: anchorLeft,
        right: box.width - anchorRight,
      };

      let side = placement;
      const vertical = side === "top" || side === "bottom";
      const needed = offset + (vertical ? panelH : panelW) + INSET;
      if (room[side] < needed && room[OPPOSITE[side]] > room[side]) side = OPPOSITE[side];

      // Along the placement axis the panel may only use the room on its side;
      // across it, the whole container minus the edge margins.
      const maxWidth = Math.max(0, vertical ? box.width - 2 * INSET : room[side] - offset - INSET);
      const maxHeight = Math.max(0, vertical ? room[side] - offset - INSET : box.height - 2 * INSET);
      const w = Math.min(panelW, maxWidth);
      const h = Math.min(panelH, maxHeight);

      let top: number;
      let left: number;
      let arrowOffset: number;
      if (vertical) {
        top = side === "top" ? anchorTop - offset - h : anchorBottom + offset;
        left = clamp(centreX - w / 2, INSET, box.width - INSET - w);
        arrowOffset = clamp(centreX - left, ARROW_MIN, w - ARROW_MIN);
      } else {
        left = side === "left" ? anchorLeft - offset - w : anchorRight + offset;
        top = clamp(centreY - h / 2, INSET, box.height - INSET - h);
        arrowOffset = clamp(centreY - top, ARROW_MIN, h - ARROW_MIN);
      }

      next = {
        side,
        top: Math.round(top),
        left: Math.round(left),
        arrowOffset: Math.round(arrowOffset),
        maxWidth,
        maxHeight,
      };
    }

    setPosition((prev) => (prev && samePosition(prev, next) ? prev : next));
  }, [anchor, placement, contained]);

  // Measure before paint on open, then follow the anchor on resize / scroll
  // and re-measure when the panel itself changes size (content, max-height).
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const panel = panelRef.current;
    const observer =
      panel && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    if (panel) observer?.observe(panel);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      observer?.disconnect();
    };
  }, [open, measure]);

  /* ---- focus ---------------------------------------------------------- */
  // Focus the panel once it is positioned (a `visibility: hidden` element
  // cannot take focus); restore the previous focus on close.
  const ready = position !== null;
  useEffect(() => {
    if (!open || !ready) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous && previous.isConnected && typeof previous.focus === "function") {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, ready]);

  /* ---- keyboard ------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (dismissOnOutside && e.target === e.currentTarget) onClose?.();
  };

  const side = position?.side ?? placement;
  // The arrow only disappears when there is no anchor to point at.
  const showArrow = position === null || position.arrowOffset !== null;
  const panelStyle = {
    ...style,
    width,
    top: position?.top,
    left: position?.left,
    maxWidth: position?.maxWidth,
    maxHeight: position?.maxHeight,
    "--gs-popover-arrow-offset":
      position && position.arrowOffset !== null ? `${position.arrowOffset}px` : undefined,
  } as CSSProperties;

  const node = (
    <div
      className={cn(
        "gs-popover-backdrop",
        contained && "gs-popover-backdrop--contained",
        !dismissOnOutside && "gs-popover-backdrop--passthrough",
      )}
      onClick={handleBackdropClick}
    >
      <div
        ref={setPanelRef}
        className={cn("gs-popover", `gs-popover--${side}`, ready && "gs-popover--ready", className)}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        tabIndex={-1}
        style={panelStyle}
        {...rest}
      >
        {showArrow && <div className="gs-popover__arrow" aria-hidden="true" />}
        <div className="gs-popover__content">{children}</div>
      </div>
    </div>
  );

  if (contained) return node;
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
});
