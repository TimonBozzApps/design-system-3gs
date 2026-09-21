import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import "./NotificationBanner.css";

export type NotificationBannerTint = "gray" | "blue" | "red" | "green";

export interface NotificationBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  /** Bold 14 px white line — the app or sender name. */
  title: ReactNode;
  /** 13 px line under the title; clamped to two lines with an ellipsis. */
  message?: ReactNode;
  /** Glyph for the 29 px app-icon tile, e.g. `<Icon icon={Mail} variant="flat" size={18} />`. */
  icon?: ReactNode;
  /** Tile gel colour. Default `gray`. */
  iconTint?: NotificationBannerTint;
  /** Small dark gel bar-button on the end side ("Reply"). */
  actionLabel?: string;
  /** Fires when the action button is tapped. */
  onAction?: () => void;
  /** Fires when the banner body (not the action) is tapped — e.g. open the app. */
  onClick?: () => void;
  /**
   * Auto-dismiss: calls `onClose` after this many ms. Default 4000; `0` keeps
   * the banner up until it is tapped, swiped or closed. The timer pauses while
   * the banner is hovered, pressed or keyboard-focused and restarts when
   * `open`, `duration` or `title` change (new content = new banner).
   */
  duration?: number;
  /**
   * Called after `duration`, after a swipe-up, after Escape, and after an
   * action / body tap (see `dismissOnAction`). The caller sets `open` false.
   */
  onClose?: () => void;
  /** Whether an action / body tap also calls `onClose`. Default `true`. */
  dismissOnAction?: boolean;
  /**
   * Default `false` → portal to `document.body` with `position: fixed; top: 0`.
   * `true` → render in place with `position: absolute; top: 0; inset-inline: 0`
   * at the top of the nearest positioned ancestor (e.g. a phone screen in a showcase).
   */
  contained?: boolean;
  /** `aria-label` of the status region. Default "Notification". */
  label?: string;
}

function isPresent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== "";
}

/**
 * Keyboard focus (`:focus-visible`) holds the auto-dismiss; the focus a mouse
 * press leaves behind does not, or a banner that was merely pressed would
 * never go away on its own once the pointer moved on.
 */
function isKeyboardFocus(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** How far (as a fraction of the banner's height) a swipe must travel to dismiss. */
const SWIPE_DISMISS_FRACTION = 0.4;
/** Pointer travel (px) before a press becomes a drag and the tap is cancelled. */
const DRAG_SLOP = 4;
/** Fallback for the swipe-out transition when `transitionend` never fires. */
const LEAVE_FALLBACK_MS = 160;

interface DragState {
  pointerId: number;
  startY: number;
  height: number;
  moved: boolean;
}

/**
 * The push-notification banner: a 60 px translucent black glass strip that
 * drops over the status / nav bar with a glossy app-icon tile, a bold title,
 * a short message, an optional action bar-button and a three-dot grip.
 * Non-modal and auto-dismissing; tapping the body runs `onClick`, a swipe up
 * slides it away. Renders nothing while `open` is false. The ref points at
 * the banner.
 */
export const NotificationBanner = forwardRef<HTMLDivElement, NotificationBannerProps>(
  function NotificationBanner(
    {
      open,
      title,
      message,
      icon,
      iconTint = "gray",
      actionLabel,
      onAction,
      onClick,
      duration = 4000,
      onClose,
      dismissOnAction = true,
      contained = false,
      label = "Notification",
      className,
      style,
      onKeyDown,
      onPointerDown,
      onPointerEnter,
      onPointerLeave,
      onFocus,
      onBlur,
      onTransitionEnd,
      ...rest
    },
    ref,
  ) {
    // Keep the latest callbacks reachable from timers and window listeners
    // without restarting them on every render (callers pass inline arrows).
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    // ---- auto-dismiss timer, pausable while hovered / focused / pressed ----
    const timerRef = useRef<number | null>(null);
    const deadlineRef = useRef(0);
    const remainingRef = useRef(0);
    const armedRef = useRef(false);
    const holdRef = useRef({ hover: false, focus: false, press: false });

    const clearTimer = useCallback(() => {
      if (timerRef.current === null) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }, []);

    // Run / pause the countdown to match the current hold state.
    const syncTimer = useCallback(() => {
      if (!armedRef.current) return;
      const hold = holdRef.current;
      const held = hold.hover || hold.focus || hold.press;
      if (held) {
        if (timerRef.current === null) return;
        remainingRef.current = Math.max(0, deadlineRef.current - Date.now());
        clearTimer();
      } else if (timerRef.current === null) {
        deadlineRef.current = Date.now() + remainingRef.current;
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          armedRef.current = false;
          onCloseRef.current?.();
        }, remainingRef.current);
      }
    }, [clearTimer]);

    // An explicit close (tap, Escape, swipe) cancels the pending auto-dismiss
    // so `onClose` cannot fire a second time.
    const close = useCallback(() => {
      armedRef.current = false;
      clearTimer();
      onCloseRef.current?.();
    }, [clearTimer]);

    // ---- swipe-up to dismiss ----
    const dragRef = useRef<DragState | null>(null);
    const detachRef = useRef<(() => void) | null>(null);
    const leaveTimerRef = useRef<number | null>(null);
    const [dragY, setDragY] = useState<number | null>(null);
    const [leaving, setLeaving] = useState(false);

    // Called once, on `transitionend` or the fallback timeout, whichever first.
    const finishLeave = useCallback(() => {
      if (leaveTimerRef.current === null) return;
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
      close();
    }, [close]);

    const slideOut = useCallback(() => {
      armedRef.current = false;
      clearTimer();
      setDragY(null);
      setLeaving(true);
      leaveTimerRef.current = window.setTimeout(finishLeave, LEAVE_FALLBACK_MS);
    }, [clearTimer, finishLeave]);

    // Fresh banner: forget holds and gestures left over from the last one
    // (a pointer that was still over the banner when it closed never "left").
    useEffect(() => {
      holdRef.current = { hover: false, focus: false, press: false };
      dragRef.current = null;
      setDragY(null);
      setLeaving(false);
      return () => {
        detachRef.current?.();
        if (leaveTimerRef.current !== null) {
          window.clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
      };
    }, [open]);

    // Auto-dismiss. `title` is a deliberate dep: new content = new banner.
    useEffect(() => {
      if (!open || duration <= 0) return;
      armedRef.current = true;
      remainingRef.current = duration;
      syncTimer();
      return () => {
        armedRef.current = false;
        clearTimer();
      };
    }, [open, duration, title, syncTimer, clearTimer]);

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented || !event.isPrimary || event.button !== 0 || leaving) return;
      detachRef.current?.();

      const drag: DragState = {
        pointerId: event.pointerId,
        startY: event.clientY,
        height: event.currentTarget.offsetHeight || 60,
        moved: false,
      };
      dragRef.current = drag;
      holdRef.current.press = true;
      syncTimer();

      // Window listeners rather than pointer capture: capture would retarget
      // the pointerup and swallow the action button's own click.
      const move = (e: PointerEvent) => {
        if (e.pointerId !== drag.pointerId) return;
        const dy = e.clientY - drag.startY;
        if (!drag.moved && Math.abs(dy) > DRAG_SLOP) drag.moved = true;
        if (drag.moved) setDragY(Math.max(-drag.height, Math.min(0, dy)));
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== drag.pointerId) return;
        detach();
        holdRef.current.press = false;
        const dy = e.type === "pointercancel" ? 0 : e.clientY - drag.startY;
        if (drag.moved && -dy > drag.height * SWIPE_DISMISS_FRACTION) {
          slideOut();
        } else {
          setDragY(null);
          syncTimer();
        }
        // The click that follows a drag must not count as a tap; the click
        // event is dispatched right after pointerup, so clear on the next tick.
        if (drag.moved) {
          window.setTimeout(() => {
            if (dragRef.current === drag) dragRef.current = null;
          }, 0);
        } else {
          dragRef.current = null;
        }
      };
      const detach = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (detachRef.current === detach) detachRef.current = null;
      };
      detachRef.current = detach;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };

    // Swallow the click that ends a drag before it reaches the body or the action.
    const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
      if (dragRef.current?.moved) {
        event.stopPropagation();
        event.preventDefault();
      }
    };

    const tapBody = () => {
      if (leaving) return;
      onClick?.();
      if (dismissOnAction) close();
    };

    const handleAction = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (leaving) return;
      onAction?.();
      if (dismissOnAction) close();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "Enter" && event.target === event.currentTarget) {
        event.preventDefault();
        tapBody();
      }
    };

    const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
      onPointerEnter?.(event);
      holdRef.current.hover = true;
      syncTimer();
    };

    const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);
      holdRef.current.hover = false;
      syncTimer();
    };

    const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
      onFocus?.(event);
      holdRef.current.focus = isKeyboardFocus(event.target);
      syncTimer();
    };

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
      onBlur?.(event);
      // focus moving between the banner and its action button is not a leave;
      // the new target's own focus event re-evaluates the hold
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      holdRef.current.focus = false;
      syncTimer();
    };

    const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
      onTransitionEnd?.(event);
      if (leaving && event.target === event.currentTarget && event.propertyName === "transform") {
        finishLeave();
      }
    };

    if (!open) return null;

    const hasMessage = isPresent(message);
    const hasAction = typeof actionLabel === "string" && actionLabel !== "";
    const dragging = dragY !== null;
    const bannerStyle: CSSProperties | undefined = dragging
      ? { ...style, transform: `translateY(${dragY}px)` }
      : style;

    const node = (
      <div
        ref={ref}
        className={cn(
          "gs-banner",
          contained && "gs-banner--contained",
          hasAction && "gs-banner--has-action",
          dragging && "gs-banner--dragging",
          leaving && "gs-banner--leaving",
          className,
        )}
        style={bannerStyle}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={label}
        tabIndex={0}
        onClick={tapBody}
        onClickCapture={handleClickCapture}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onTransitionEnd={handleTransitionEnd}
        {...rest}
      >
        <span className={cn("gs-banner__tile", `gs-banner__tile--${iconTint}`)} aria-hidden="true">
          {icon}
        </span>
        <div className="gs-banner__body">
          <div className="gs-banner__title">{title}</div>
          {hasMessage && <div className="gs-banner__message">{message}</div>}
        </div>
        {hasAction && (
          <button type="button" className="gs-banner__action" onClick={handleAction}>
            {actionLabel}
          </button>
        )}
        <span className="gs-banner__grip" aria-hidden="true" />
      </div>
    );

    if (contained) return node;
    if (typeof document === "undefined") return null;
    return createPortal(node, document.body);
  },
);
