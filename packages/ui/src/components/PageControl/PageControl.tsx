import {
  forwardRef,
  useCallback,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn } from "../../lib/cn";
import { useGsStrings } from "../../lib/i18n";
import "./PageControl.css";

export type PageControlSize =
  /** 6 px dots — the home-screen pager (default) */
  | "sm"
  /** 8 px dots — photo pagers, larger canvases */
  | "md";

export interface PageControlProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Number of pages. With `hideForSinglePage` (default) nothing renders when this is `<= 1`. */
  count: number;
  /** Controlled current page, 0-based. Clamped to `[0, count - 1]`. */
  value?: number;
  /** Uncontrolled initial page, 0-based. Default `0`. */
  defaultValue?: number;
  onChange?: (page: number) => void;
  /** `aria-label` for the tablist. Default `strings.pages` ("Pages"). */
  label?: string;
  /** Render nothing for 0 or 1 pages (`UIPageControl.hidesForSinglePage`). Default `true`. */
  hideForSinglePage?: boolean;
  /** Dot size: `sm` = 6 px (default), `md` = 8 px. */
  size?: PageControlSize;
}

/** Keep a page index inside `[0, count - 1]` (and an integer). */
function clampPage(page: number, count: number): number {
  if (!Number.isFinite(page) || count <= 0) return 0;
  return Math.min(Math.max(Math.trunc(page), 0), count - 1);
}

/**
 * The row of tiny dots under the home screen (`UIPageControl`): the current
 * page is a solid white dot with a faint gloss, the others translucent white
 * sunk into the surface with a dark rim.
 *
 * Interaction matches the original: tapping the strip's right half goes one
 * page forward, the left half one back (no wrap); each dot is also a button
 * that jumps straight to its page. Keyboard: Left/Right (and Home/End) move
 * focus *and* select — roving tabindex, so the strip is a single Tab stop.
 */
export const PageControl = forwardRef<HTMLDivElement, PageControlProps>(function PageControl(
  {
    count,
    value,
    defaultValue = 0,
    onChange,
    label,
    hideForSinglePage = true,
    size = "sm",
    className,
    onClick,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const strings = useGsStrings();
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = clampPage(isControlled ? value : internal, count);

  const select = useCallback(
    (next: number) => {
      const page = clampPage(next, count);
      if (page === current) return;
      if (!isControlled) setInternal(page);
      onChange?.(page);
    },
    [count, current, isControlled, onChange],
  );

  // Taps on the strip itself (not on a dot) step one page: right half forward, left half back.
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest(".gs-pagecontrol__page")) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const forward = event.clientX >= left + width / 2;
    select(current + (forward ? 1 : -1));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || count <= 0) return;

    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (current + 1) % count;
        break;
      case "ArrowLeft":
        next = (current - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const pages = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    pages[next]?.focus();
    select(next);
  };

  if (hideForSinglePage && count <= 1) return null;

  const pages = Array.from({ length: Math.max(0, Math.trunc(count)) }, (_, index) => index);

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label ?? strings.pages}
      aria-orientation="horizontal"
      className={cn("gs-pagecontrol", `gs-pagecontrol--${size}`, className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {pages.map((index) => {
        const selected = index === current;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={strings.pageOf(index + 1, pages.length)}
            tabIndex={selected ? 0 : -1}
            className={cn("gs-pagecontrol__page", selected && "gs-pagecontrol__page--current")}
            onClick={() => select(index)}
          >
            <span className="gs-pagecontrol__dot" />
          </button>
        );
      })}
    </div>
  );
});
