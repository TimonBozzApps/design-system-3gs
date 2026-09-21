import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { useGsStrings } from "../../lib/i18n";
import { Icon } from "../Icon";
import "./SegmentedControl.css";

/* ---- context ------------------------------------------------------------ */

interface SegmentedControlContextValue {
  /** Value of the selected segment. */
  selected: string | undefined;
  /** Value of the segment that carries `tabIndex=0` (roving tabindex). */
  focusable: string | undefined;
  select: (value: string) => void;
}

const SegmentedControlContext = createContext<SegmentedControlContextValue | null>(null);

interface SegmentEntry {
  value: string;
  disabled: boolean;
}

/** Ordered `value`s (and disabled flags) of the direct `<Segment>` children. */
function collectSegments(children: ReactNode): SegmentEntry[] {
  const entries: SegmentEntry[] = [];
  Children.forEach(children, (child) => {
    if (
      isValidElement<{ value?: unknown; disabled?: unknown }>(child) &&
      typeof child.props.value === "string"
    ) {
      entries.push({ value: child.props.value, disabled: child.props.disabled === true });
    }
  });
  return entries;
}

/* ---- SegmentedControl --------------------------------------------------- */

export type SegmentedControlSize =
  /** 30 px tall, 13 px text — fits inside a NavigationBar */
  | "sm"
  /** 44 px tall, 15 px text — the standard touch target (default) */
  | "md";

export type SegmentedControlTint =
  /** dark gel (default) */
  | "dark"
  /** the blue-gray gel used inside a `tint="blue"` NavigationBar */
  | "blue";

export interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Controlled selected segment. */
  value?: string;
  /** Uncontrolled initial segment. Defaults to the first one — a segmented control always has a selection. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: SegmentedControlSize;
  tint?: SegmentedControlTint;
  /** `aria-label` for the group. Default `strings.segments` ("Segments"). */
  label?: string;
  /** Stretch to the container width. Default: intrinsic — every segment as wide as the widest. */
  block?: boolean;
  /** `<Segment>`s. */
  children: ReactNode;
}

/**
 * The iOS 3 segmented control (`UISegmentedControlStyleBar`): one rounded gel
 * bar cut into equal segments by 1 px black dividers. The selected segment is
 * pressed in — sunken, blue-black gel — while the others stay raised glass.
 *
 * Keyboard: Left/Right (and Home/End) move focus *and* select, skipping
 * disabled segments — roving tabindex, so the control is a single Tab stop.
 */
export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  function SegmentedControl(
    {
      value,
      defaultValue,
      onChange,
      size = "md",
      tint = "dark",
      label,
      block = false,
      className,
      children,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const strings = useGsStrings();
    const segments = collectSegments(children);
    const isControlled = value !== undefined;
    const [internal, setInternal] = useState<string | undefined>(
      () => defaultValue ?? segments[0]?.value,
    );
    const selected = isControlled ? value : internal;
    // the selected segment is the Tab stop; if it is unknown or disabled (and so
    // unfocusable), the first enabled segment keeps the control reachable
    const current = segments.find((segment) => segment.value === selected);
    const focusable =
      current && !current.disabled
        ? current.value
        : segments.find((segment) => !segment.disabled)?.value;

    const select = useCallback(
      (next: string) => {
        if (!isControlled) setInternal(next);
        onChange?.(next);
      },
      [isControlled, onChange],
    );

    const ctx = useMemo<SegmentedControlContextValue>(
      () => ({ selected, focusable, select }),
      [selected, focusable, select],
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      const radios = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
      ).filter((radio) => !radio.disabled);
      if (radios.length === 0) return;

      const index = radios.findIndex((radio) => radio.contains(event.target as Node));
      if (index === -1) return;
      let next: number;
      switch (event.key) {
        case "ArrowRight":
          next = (index + 1) % radios.length;
          break;
        case "ArrowLeft":
          next = (index - 1 + radios.length) % radios.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = radios.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const target = radios[next];
      target.focus();
      target.click(); // selection follows focus (the segment's click handler calls `select`)
    };

    return (
      <SegmentedControlContext.Provider value={ctx}>
        <div
          ref={ref}
          role="radiogroup"
          aria-label={label ?? strings.segments}
          className={cn(
            "gs-segmented",
            `gs-segmented--${size}`,
            `gs-segmented--${tint}`,
            block && "gs-segmented--block",
            className,
          )}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {children}
        </div>
      </SegmentedControlContext.Provider>
    );
  },
);

/* ---- Segment ------------------------------------------------------------ */

export interface SegmentProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Identifies the segment; what `SegmentedControl` reports through `onChange`. */
  value: string;
  /** Any `lucide-react` icon, rendered flat in white before the text — or alone. */
  icon?: LucideIcon;
  /**
   * Accessible name. Required for an icon-only segment (it becomes the
   * `aria-label`); without an icon or `children` it is the visible text.
   */
  label?: string;
  /** The visible text. */
  children?: ReactNode;
}

export const Segment = forwardRef<HTMLButtonElement, SegmentProps>(function Segment(
  { value, icon, label, disabled = false, className, children, onClick, ...rest },
  ref,
) {
  const ctx = useContext(SegmentedControlContext);
  if (!ctx) {
    throw new Error("<Segment> must be rendered inside a <SegmentedControl>.");
  }
  const selected = ctx.selected === value;
  // roving tabindex; if the control couldn't determine a focusable segment, every segment stays reachable
  const tabIndex = ctx.focusable === undefined || ctx.focusable === value ? 0 : -1;

  // visible text: `children`, or `label` when there is no icon to stand in for it
  const text = children ?? (icon ? undefined : label);
  const hasText = text !== undefined && text !== null && text !== false;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || selected) return;
    ctx.select(value);
  };

  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={hasText ? undefined : label}
      tabIndex={tabIndex}
      disabled={disabled}
      className={cn(
        "gs-segment",
        selected && "gs-segment--selected",
        disabled && "gs-segment--disabled",
        className,
      )}
      onClick={handleClick}
      {...rest}
    >
      {icon && <Icon icon={icon} variant="flat" size={16} className="gs-segment__icon" />}
      {hasText && <span className="gs-segment__label">{text}</span>}
    </button>
  );
});
