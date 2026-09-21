import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import "./Picker.css";

/* ---- constants ---------------------------------------------------------- */

/** Row height in px — must match `--gs-picker-row-height` in Picker.css. */
const ROW_HEIGHT = 44;
/** Quiet time after the last `scroll` event before a drum counts as settled. */
const SETTLE_MS = 100;
/** Scroll events inside this window after a programmatic scroll are ignored. */
const PROGRAMMATIC_MS = 150;

/* ---- types -------------------------------------------------------------- */

export interface PickerOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface PickerColumn {
  /** Identifies the column; the key under which its value is reported. */
  key: string;
  options: PickerOption[];
  /** `aria-label` for the drum. Defaults to `key`. */
  label?: string;
  /** CSS width of the column. Without it, columns share the width equally. */
  width?: number | string;
  /** Text alignment inside the drum. Default `center`. */
  align?: "left" | "center" | "right";
}

/** `{ [column.key]: option.value }` */
export type PickerValue = Record<string, string>;

export interface PickerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  columns: PickerColumn[];
  /** Controlled selection. */
  value?: PickerValue;
  /** Uncontrolled initial selection; missing keys default to the first (enabled) option. */
  defaultValue?: PickerValue;
  onChange?: (value: PickerValue, changed: { key: string; value: string }) => void;
  /** Visible rows per drum (44 px each). Default `5`. */
  rows?: 3 | 5 | 7;
  /** `aria-label` for the whole picker. */
  label?: string;
  disabled?: boolean;
}

/* ---- helpers ------------------------------------------------------------ */

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

function firstEnabled(options: PickerOption[]): number {
  const i = options.findIndex((o) => !o.disabled);
  return i === -1 ? 0 : i;
}

function lastEnabled(options: PickerOption[]): number {
  for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) return i;
  return options.length - 1;
}

/** Index of `value` in `options`; unknown or missing values fall back to the first enabled option. */
function resolveIndex(options: PickerOption[], value: string | undefined): number {
  if (options.length === 0) return -1;
  const i = value === undefined ? -1 : options.findIndex((o) => o.value === value);
  return i === -1 ? firstEnabled(options) : i;
}

/** The enabled index closest to `from`, preferring `dir` (+1 / -1) on ties. */
function nearestEnabled(options: PickerOption[], from: number, dir: 1 | -1): number {
  if (!options[from]?.disabled) return from;
  for (let d = 1; d < options.length; d++) {
    const ahead = options[from + d * dir];
    if (ahead && !ahead.disabled) return from + d * dir;
    const behind = options[from - d * dir];
    if (behind && !behind.disabled) return from - d * dir;
  }
  return from;
}

/**
 * `from` moved by `delta` rows onto an enabled option: keeps walking in the
 * direction of travel past disabled rows, then backs up towards `from`.
 */
function stepIndex(options: PickerOption[], from: number, delta: number): number {
  const last = options.length - 1;
  const dir = delta < 0 ? -1 : 1;
  const target = clamp(from + delta, 0, last);
  for (let i = target; i >= 0 && i <= last; i += dir) if (!options[i].disabled) return i;
  for (let i = target - dir; i !== from && i >= 0 && i <= last; i -= dir) {
    if (!options[i].disabled) return i;
  }
  return from;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ---- Drum (one column) -------------------------------------------------- */

interface PickerDrumProps {
  column: PickerColumn;
  selectedIndex: number;
  idPrefix: string;
  rows: number;
  disabled: boolean;
  onSelect: (key: string, index: number) => void;
}

/**
 * One scrolling drum. Scroll position and selection are kept in sync in both
 * directions without feeding back on each other:
 *
 * - selection → scroll: an effect scrolls to `selectedIndex * 44` whenever the
 *   selection changes (or a settle asks for a re-sync) — skipped when the drum
 *   already rests there. It clears any pending settle and opens a 150 ms
 *   window in which `scroll` events are ignored.
 * - scroll → selection: `scroll` events (outside that window, and not while a
 *   finger is on the drum) debounce a 100 ms settle; `scrollend` settles at
 *   once where supported. Settle rounds `scrollTop / 44`, redirects disabled
 *   rows to the nearest enabled one, and commits only if the index differs
 *   from the current selection.
 */
function PickerDrum({ column, selectedIndex, idPrefix, rows, disabled, onSelect }: PickerDrumProps) {
  const { key, options, label, width, align = "center" } = column;
  const drumRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const touching = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);
  const programmaticUntil = useRef(0);
  const [syncTick, forceSync] = useReducer((n: number) => n + 1, 0);

  // latest props for the timer / native-event callbacks
  const latest = useRef({ key, options, selectedIndex, onSelect });
  useLayoutEffect(() => {
    latest.current = { key, options, selectedIndex, onSelect };
  });

  /* selection → scroll position */
  useLayoutEffect(() => {
    const drum = drumRef.current;
    if (!drum || selectedIndex < 0) return;
    const top = selectedIndex * ROW_HEIGHT;
    if (Math.abs(drum.scrollTop - top) < 1) return;
    window.clearTimeout(settleTimer.current); // the drum is now driven programmatically
    programmaticUntil.current = performance.now() + PROGRAMMATIC_MS;
    const instant = !mounted.current || prefersReducedMotion();
    drum.scrollTo({ top, behavior: instant ? "auto" : "smooth" });
  }, [selectedIndex, rows, syncTick]);

  /* scroll position → selection */
  const settle = useCallback(() => {
    const drum = drumRef.current;
    const { key, options, selectedIndex, onSelect } = latest.current;
    if (!drum || options.length === 0) return;
    const raw = clamp(Math.round(drum.scrollTop / ROW_HEIGHT), 0, options.length - 1);
    const target = nearestEnabled(options, raw, raw >= selectedIndex ? 1 : -1);
    if (target !== selectedIndex) onSelect(key, target);
    // re-align unless the drum already rests exactly on the unchanged selection —
    // covers disabled rows, controlled parents that reject the change, and drift
    if (target !== selectedIndex || target !== raw || Math.abs(drum.scrollTop - target * ROW_HEIGHT) >= 1) {
      forceSync();
    }
  }, []);

  const scheduleSettle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, SETTLE_MS);
  }, [settle]);

  useEffect(() => {
    mounted.current = true;
    const drum = drumRef.current;
    const onScrollEnd = () => {
      if (touching.current) return;
      window.clearTimeout(settleTimer.current);
      settle();
    };
    drum?.addEventListener("scrollend", onScrollEnd);
    return () => {
      mounted.current = false;
      window.clearTimeout(settleTimer.current);
      drum?.removeEventListener("scrollend", onScrollEnd);
    };
  }, [settle]);

  const handleScroll = () => {
    if (touching.current || performance.now() < programmaticUntil.current) return;
    scheduleSettle();
  };

  const handleTouchStart = () => {
    touching.current = true;
    window.clearTimeout(settleTimer.current);
  };

  const handleTouchEnd = () => {
    touching.current = false;
    scheduleSettle();
  };

  const select = (index: number) => {
    window.clearTimeout(settleTimer.current);
    onSelect(key, index);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || options.length === 0) return;
    const page = rows - 1;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = stepIndex(options, selectedIndex, 1);
        break;
      case "ArrowUp":
        next = stepIndex(options, selectedIndex, -1);
        break;
      case "PageDown":
        next = stepIndex(options, selectedIndex, page);
        break;
      case "PageUp":
        next = stepIndex(options, selectedIndex, -page);
        break;
      case "Home":
        next = firstEnabled(options);
        break;
      case "End":
        next = lastEnabled(options);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next !== selectedIndex) select(next);
  };

  const basis = typeof width === "number" ? `${width}px` : width;
  const style: CSSProperties | undefined = basis === undefined ? undefined : { flex: `0 1 ${basis}` };

  return (
    <div className={cn("gs-picker__column", `gs-picker__column--${align}`)} style={style}>
      <div
        ref={drumRef}
        role="listbox"
        tabIndex={disabled ? -1 : 0}
        aria-label={label ?? key}
        aria-disabled={disabled || undefined}
        aria-activedescendant={selectedIndex >= 0 ? `${idPrefix}-o${selectedIndex}` : undefined}
        className="gs-picker__drum"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onKeyDown={handleKeyDown}
      >
        <div className="gs-picker__spacer" aria-hidden="true" />
        {options.map((option, i) => {
          const selected = i === selectedIndex;
          return (
            <div
              key={option.value}
              id={`${idPrefix}-o${i}`}
              role="option"
              aria-selected={selected}
              aria-disabled={option.disabled || undefined}
              className={cn(
                "gs-picker__row",
                selected && "gs-picker__row--selected",
                option.disabled && "gs-picker__row--disabled",
              )}
              onClick={() => {
                if (!disabled && !option.disabled && !selected) select(i);
              }}
            >
              {option.label}
            </div>
          );
        })}
        <div className="gs-picker__spacer" aria-hidden="true" />
      </div>
      <div className="gs-picker__shade-top" aria-hidden="true" />
      <div className="gs-picker__shade-bottom" aria-hidden="true" />
      <div className="gs-picker__selection" aria-hidden="true" />
    </div>
  );
}

/* ---- Picker ------------------------------------------------------------- */

/**
 * The iOS 3 spinning wheel (`UIPickerView`): one drum per column inside black
 * chrome, each showing `rows` 44 px rows shaded into darkness toward the top
 * and bottom edges to fake a cylinder, with a translucent blue-glass bar over
 * the middle row. Flick a drum and it snaps to a row; click a row to select it.
 *
 * Keyboard (on a focused drum): Up/Down one row, PageUp/PageDown a screenful,
 * Home/End first/last — disabled rows are skipped.
 */
export const Picker = forwardRef<HTMLDivElement, PickerProps>(function Picker(
  { columns, value, defaultValue, onChange, rows = 5, label, disabled = false, className, ...rest },
  ref,
) {
  const id = useId();
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<PickerValue>(() => defaultValue ?? {});
  const current = isControlled ? value : internal;

  // effective selection per column — what the drums show and what `onChange` reports
  const indices = columns.map((column) => resolveIndex(column.options, current[column.key]));
  const resolved: PickerValue = {};
  columns.forEach((column, i) => {
    const option = column.options[indices[i]];
    if (option) resolved[column.key] = option.value;
  });

  const select = (key: string, index: number) => {
    const option = columns.find((column) => column.key === key)?.options[index];
    if (!option || option.disabled || resolved[key] === option.value) return;
    const next = { ...resolved, [key]: option.value };
    if (!isControlled) setInternal(next);
    onChange?.(next, { key, value: option.value });
  };

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        "gs-picker",
        `gs-picker--rows-${rows}`,
        disabled && "gs-picker--disabled",
        className,
      )}
      {...rest}
    >
      <div className="gs-picker__frame">
        {columns.map((column, i) => (
          <Fragment key={column.key}>
            {i > 0 && <div className="gs-picker__divider" aria-hidden="true" />}
            <PickerDrum
              column={column}
              selectedIndex={indices[i]}
              idPrefix={`${id}-c${i}`}
              rows={rows}
              disabled={disabled}
              onSelect={select}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
});
