import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import { BarButton, NavigationBar, type NavigationBarTint } from "../NavigationBar";
import "./ModalSheet.css";

export interface ModalSheetProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  /** Called on Escape and by the default Cancel / Done bar buttons. */
  onClose?: () => void;
  /** NavigationBar title. A string also becomes the dialog's accessible name. */
  title?: ReactNode;
  /** NavigationBar left slot. Default: a "Cancel" bar button that calls `onClose`; `null` hides it. */
  left?: ReactNode;
  /** NavigationBar right slot. Default: a blue "Done" bar button that calls `onClose`; `null` hides it. */
  right?: ReactNode;
  /** Forwarded to the NavigationBar: `black` glass (default) or the blue-gray bar. */
  tint?: NavigationBarTint;
  /** Body background: the grouped-table pinstripe (default), plain black or the flat cell surface. */
  background?: "pinstripe" | "black" | "surface";
  /** `className` goes to the sheet panel; this one to the scrolling body. */
  bodyClassName?: string;
  /**
   * Default `false` → portal to `document.body` with a `position: fixed` backdrop.
   * `true` → render in place with `position: absolute; inset: 0`, filling the
   * nearest positioned ancestor (e.g. a phone screen in a showcase).
   */
  contained?: boolean;
  /** `aria-label` for the dialog when `title` isn't a plain string. */
  label?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Tabbable elements under `root`: not disabled, not `tabindex=-1`, not `display: none`. */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !(el as HTMLButtonElement).disabled &&
      el.getClientRects().length > 0,
  );
}

/**
 * The iOS 3 modally presented screen (`UIModalTransitionStyleCoverVertical`):
 * a full-size panel that slides up from the bottom over the current screen,
 * with its own navigation bar (Cancel / title / Done) and a scrolling body —
 * Compose, Add Event, Settings forms. Renders nothing while `open` is false.
 * The ref points at the sheet panel.
 */
export const ModalSheet = forwardRef<HTMLDivElement, ModalSheetProps>(function ModalSheet(
  {
    open,
    onClose,
    title,
    left,
    right,
    tint = "black",
    background = "pinstripe",
    bodyClassName,
    contained = false,
    label,
    className,
    children,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const isStringTitle = typeof title === "string";

  const panelRef = useRef<HTMLDivElement | null>(null);
  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // Keep the latest onClose reachable from the document listener without
  // re-subscribing on every render (callers usually pass an inline arrow).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus the first tabbable in the body (else the right bar button, else the
  // first tabbable anywhere, else the panel) on open; restore focus on close.
  // `preventScroll`: the panel is still translated off-screen by the entrance
  // animation, so a scrolling focus would yank the overflow-hidden ancestors.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) {
      const body = panel.querySelector<HTMLElement>(".gs-modalsheet__body");
      const rightSlot = panel.querySelector<HTMLElement>(".gs-navbar__right");
      const target =
        (body && tabbables(body)[0]) ??
        (rightSlot && tabbables(rightSlot)[0]) ??
        tabbables(panel)[0] ??
        panel;
      target.focus({ preventScroll: true });
    }
    return () => {
      if (previous && previous.isConnected && typeof previous.focus === "function") {
        previous.focus();
      }
    };
  }, [open]);

  // Escape closes; Tab / Shift+Tab wrap at the edges so focus stays in the sheet.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = tabbables(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active !== null && panel.contains(active);
      if (e.shiftKey) {
        if (!inside || active === first || active === panel) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const leftNode =
    left === undefined ? <BarButton onClick={() => onClose?.()}>Cancel</BarButton> : left;
  const rightNode =
    right === undefined ? (
      <BarButton variant="done" onClick={() => onClose?.()}>
        Done
      </BarButton>
    ) : (
      right
    );

  const node = (
    <div className={cn("gs-modalsheet-backdrop", contained && "gs-modalsheet-backdrop--contained")}>
      <div
        ref={setPanelRef}
        className={cn("gs-modalsheet", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={isStringTitle ? titleId : undefined}
        aria-label={isStringTitle ? undefined : label}
        tabIndex={-1}
        {...rest}
      >
        <NavigationBar
          className="gs-modalsheet__bar"
          tint={tint}
          title={isStringTitle ? <span id={titleId}>{title}</span> : title}
          aria-label={isStringTitle ? title : undefined}
          left={leftNode}
          right={rightNode}
        />
        <div
          className={cn(
            "gs-modalsheet__body",
            `gs-modalsheet__body--${background}`,
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );

  if (contained) return node;
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
});
