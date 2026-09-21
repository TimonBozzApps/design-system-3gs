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
import "./ActionSheet.css";

export interface ActionSheetAction {
  label: string;
  onClick?: () => void;
  /** light silver glass with dark text (default) or red gel. */
  variant?: "default" | "destructive";
  /**
   * `true` keeps the sheet open after the click (the caller decides when to
   * close). Default: the action fires `onClick`, then `onClose`.
   */
  keepOpen?: boolean;
  disabled?: boolean;
}

export interface ActionSheetProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  /** Small gray centered text at the top of the sheet. */
  title?: ReactNode;
  /** Stacked in order, top to bottom. */
  actions: ActionSheetAction[];
  /** Label of the dark Cancel button at the bottom. Default `"Cancel"`; `null` hides it. */
  cancelLabel?: string | null;
  /** Called after any action, on Cancel, on Escape, and on backdrop click when `dismissOnBackdrop`. */
  onClose?: () => void;
  /** Default `true` — tapping the dimmed area behind the sheet dismisses it. */
  dismissOnBackdrop?: boolean;
  /**
   * Default `false` → portal to `document.body` with a `position: fixed` backdrop.
   * `true` → render in place with `position: absolute; inset: 0`, filling the
   * nearest positioned ancestor (e.g. a phone screen in a showcase).
   */
  contained?: boolean;
}

const ACTION_SELECTOR = "button.gs-actionsheet__action:not(:disabled)";

/**
 * The iOS 3 action sheet (`UIActionSheet`): a translucent black-glass sheet
 * that slides up from the bottom, a small gray title and a stack of full-width
 * 46 px gel buttons — light silver glass for normal actions, red gel for the
 * destructive one and a dark "Cancel" at the bottom. Renders nothing while
 * `open` is false. The ref points at the sheet panel.
 */
export const ActionSheet = forwardRef<HTMLDivElement, ActionSheetProps>(function ActionSheet(
  {
    open,
    title,
    actions,
    cancelLabel = "Cancel",
    onClose,
    dismissOnBackdrop = true,
    contained = false,
    className,
    ...rest
  },
  ref,
) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const hasTitle = title !== undefined && title !== null && title !== false;

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

  // Focus the first enabled action (else Cancel) on open; restore focus on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>(ACTION_SELECTOR)?.focus();
    return () => {
      if (previous && previous.isConnected && typeof previous.focus === "function") {
        previous.focus();
      }
    };
  }, [open]);

  // Escape closes; Tab / Shift+Tab cycle within the buttons (incl. Cancel).
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

  const node = (
    <div
      className={cn("gs-actionsheet-backdrop", contained && "gs-actionsheet-backdrop--contained")}
      onClick={handleBackdropClick}
    >
      <div
        ref={setPanelRef}
        className={cn("gs-actionsheet", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? titleId : undefined}
        aria-label={hasTitle ? undefined : "Actions"}
        {...rest}
      >
        {hasTitle && (
          <div id={titleId} className="gs-actionsheet__title">
            {title}
          </div>
        )}
        <div className="gs-actionsheet__actions">
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "gs-actionsheet__action",
                `gs-actionsheet__action--${action.variant ?? "default"}`,
              )}
              disabled={action.disabled}
              onClick={() => {
                action.onClick?.();
                if (!action.keepOpen) onClose?.();
              }}
            >
              {action.label}
            </button>
          ))}
          {cancelLabel !== null && (
            <button
              type="button"
              className="gs-actionsheet__action gs-actionsheet__action--cancel"
              onClick={() => onClose?.()}
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (contained) return node;
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
});
