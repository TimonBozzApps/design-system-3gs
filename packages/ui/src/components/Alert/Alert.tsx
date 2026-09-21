import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";
import "./Alert.css";

export interface AlertAction {
  label: string;
  onClick?: () => void;
  /** dark navy gel (default), light glass (primary — the highlighted "OK") or red gel. */
  variant?: "default" | "primary" | "destructive";
  /**
   * `true` keeps the alert open after the click (the caller decides when to
   * close). Default: the action fires `onClick`, then `onClose`.
   */
  keepOpen?: boolean;
}

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  /** 1..n actions. Exactly two render side by side, any other count stacks. */
  actions: AlertAction[];
  /** Called after an action, on Escape, and on backdrop click when `dismissOnBackdrop`. */
  onClose?: () => void;
  /** Default `false` — iOS 3 alerts were strictly modal. */
  dismissOnBackdrop?: boolean;
  /**
   * Default `false` → portal to `document.body` with a `position: fixed` backdrop.
   * `true` → render in place with `position: absolute; inset: 0`, filling the
   * nearest positioned ancestor (e.g. a phone screen in a showcase).
   */
  contained?: boolean;
}

const ACTION_SELECTOR = "button.gs-alert__action:not(:disabled)";

/**
 * The iOS 3 modal alert (`UIAlertView`): a deep-blue glass dialog with a thick
 * translucent white border, an elliptical top gloss, bold centered white title
 * and 43 px gel buttons. Pops in with a slight overshoot. Renders nothing while
 * `open` is false. The ref points at the dialog panel.
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    open,
    title,
    message,
    actions,
    onClose,
    dismissOnBackdrop = false,
    contained = false,
    className,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const messageId = `${baseId}-message`;

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

  // Focus the primary (else first) action on open; restore focus on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLButtonElement>(".gs-alert__action--primary") ??
      panel?.querySelector<HTMLButtonElement>(ACTION_SELECTOR);
    target?.focus();
    return () => {
      if (previous && previous.isConnected && typeof previous.focus === "function") {
        previous.focus();
      }
    };
  }, [open]);

  // Escape closes; Tab / Shift+Tab cycle within the action buttons.
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
      const items = Array.from(panel.querySelectorAll<HTMLButtonElement>(ACTION_SELECTOR));
      if (items.length === 0) return;
      e.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const last = items.length - 1;
      const next = e.shiftKey
        ? index <= 0
          ? last
          : index - 1
        : index < 0 || index === last
          ? 0
          : index + 1;
      items[next].focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (dismissOnBackdrop && e.target === e.currentTarget) onClose?.();
  };

  const stacked = actions.length !== 2;

  const node = (
    <div
      className={cn("gs-alert-backdrop", contained && "gs-alert-backdrop--contained")}
      onClick={handleBackdropClick}
    >
      <div
        ref={setPanelRef}
        className={cn("gs-alert", className)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message !== undefined && message !== null ? messageId : undefined}
        {...rest}
      >
        <div id={titleId} className="gs-alert__title">
          {title}
        </div>
        {message !== undefined && message !== null && (
          <div id={messageId} className="gs-alert__message">
            {message}
          </div>
        )}
        <div className={cn("gs-alert__actions", stacked && "gs-alert__actions--stacked")}>
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              className={cn("gs-alert__action", `gs-alert__action--${action.variant ?? "default"}`)}
              onClick={() => {
                action.onClick?.();
                if (!action.keepOpen) onClose?.();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (contained) return node;
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
});
