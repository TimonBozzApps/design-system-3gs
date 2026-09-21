import { forwardRef, useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import { ActivityIndicator, ProgressBar } from "../Progress";
import "./HUD.css";

export type HUDKind =
  /** 37 px white spinner — "Loading…" (default) */
  | "loading"
  /** a gel progress bar driven by `progress` */
  | "progress"
  /** big white check — "Saved" */
  | "success"
  /** big white X — "Failed" */
  | "error"
  /** label only: a compact pill-ish toast — "Copied" */
  | "text"
  /** your own graphic in the `icon` slot — the volume bell */
  | "custom";

export interface HUDProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  /** What the square shows. Default `loading`. */
  kind?: HUDKind;
  /** Bold 16 px white label under the graphic ("Loading…", "Saved"). */
  title?: ReactNode;
  /** Optional 13 px secondary line. */
  message?: ReactNode;
  /** `0..100` for `kind="progress"`. Omit for an indeterminate bar. */
  progress?: number;
  /** The graphic for `kind="custom"`, e.g. `<Icon icon={Volume2} variant="flat" size={48} />`. */
  icon?: ReactNode;
  /**
   * Auto-dismiss: calls `onClose` after this many ms. The timer restarts when
   * `open`, `title` or `kind` change, so a toast that swaps its text stays up
   * for the full duration again. Typical toast use: 1500.
   */
  duration?: number;
  onClose?: () => void;
  /** Default `center`; `top` / `bottom` sit 60 px from that edge. */
  position?: "center" | "top" | "bottom";
  /**
   * Default `false`: pointer events pass through the transparent backdrop —
   * the HUD is a non-modal overlay. `true`: the backdrop absorbs clicks (still
   * no dimming, HUDs never dimmed) and the box reports `aria-busy`.
   */
  blocking?: boolean;
  /**
   * Default `false` → portal to `document.body` with a `position: fixed` backdrop.
   * `true` → render in place with `position: absolute; inset: 0`, filling the
   * nearest positioned ancestor (e.g. a phone screen in a showcase).
   */
  contained?: boolean;
}

function isPresent(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false && node !== "";
}

/**
 * The iOS 3 progress HUD: a ~140 px rounded translucent black square with a
 * big spinner, a check mark, a progress bar or a custom glyph and a short
 * white label — this era's toast ("Loading…", "Saved", the ringer bell).
 * Non-modal by default, optionally auto-dismissing. Renders nothing while
 * `open` is false. The ref points at the box.
 */
export const HUD = forwardRef<HTMLDivElement, HUDProps>(function HUD(
  {
    open,
    kind = "loading",
    title,
    message,
    progress,
    icon,
    duration,
    onClose,
    position = "center",
    blocking = false,
    contained = false,
    className,
    ...rest
  },
  ref,
) {
  // Keep the latest onClose reachable from the timer without restarting it
  // on every render (callers usually pass an inline arrow).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Auto-dismiss. `title` and `kind` are deliberate deps: new content = new toast.
  useEffect(() => {
    if (!open || duration === undefined) return;
    const id = window.setTimeout(() => onCloseRef.current?.(), duration);
    return () => window.clearTimeout(id);
  }, [open, duration, title, kind]);

  if (!open) return null;

  const hasTitle = isPresent(title);
  const hasMessage = isPresent(message);
  const busy = kind === "loading" || kind === "progress" || blocking;

  let graphic: ReactNode = null;
  switch (kind) {
    case "loading":
      // With a title the label is the announcement; hide the spinner's own
      // "Loading" status so it is not read twice.
      graphic = <ActivityIndicator size={37} tone="white" aria-hidden={hasTitle || undefined} />;
      break;
    case "progress":
      graphic = (
        <div className="gs-hud__progress">
          <ProgressBar
            value={progress}
            size="md"
            tint="gray"
            label={typeof title === "string" ? title : "Progress"}
          />
        </div>
      );
      break;
    case "success":
      graphic = <Icon icon={Check} variant="flat" size={56} strokeWidth={3} />;
      break;
    case "error":
      graphic = <Icon icon={X} variant="flat" size={56} strokeWidth={3} />;
      break;
    case "custom":
      graphic = isPresent(icon) ? icon : null;
      break;
    case "text":
      break;
  }

  const node = (
    <div
      className={cn(
        "gs-hud-backdrop",
        `gs-hud-backdrop--${position}`,
        contained && "gs-hud-backdrop--contained",
        blocking && "gs-hud-backdrop--blocking",
      )}
    >
      <div
        ref={ref}
        className={cn("gs-hud", `gs-hud--${kind}`, className)}
        role={kind === "error" ? "alert" : "status"}
        aria-live={kind === "error" ? "assertive" : "polite"}
        aria-busy={busy || undefined}
        {...rest}
      >
        {graphic !== null && <div className="gs-hud__graphic">{graphic}</div>}
        {hasTitle && <div className="gs-hud__title">{title}</div>}
        {hasMessage && <div className="gs-hud__message">{message}</div>}
      </div>
    </div>
  );

  if (contained) return node;
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
});
