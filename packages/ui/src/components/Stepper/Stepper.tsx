import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import "./Stepper.css";

export type StepperSize =
  /** 30 px tall — fits a 44 px list row (default) */
  | "sm"
  /** 44 px tall — the standard touch target */
  | "md";

export type StepperTint =
  /** the bar-button gel of the current theme (default) */
  | "dark"
  /** the blue-gray gel of a `tint="blue"` NavigationBar, in either theme */
  | "blue";

export interface StepperProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. Defaults to `min`. */
  defaultValue?: number;
  /** Fires with the new value on every step (click, hold, key). */
  onChange?: (value: number) => void;
  /** Default `0`. */
  min?: number;
  /** Default `100`. */
  max?: number;
  /** Default `1`. Values are rounded to the step's decimal precision. */
  step?: number;
  /** At the bounds the button disables (default); `true` wraps around instead. */
  wraps?: boolean;
  /** Hold a button to repeat: 500 ms delay, then every 100 ms, every 50 ms after 2 s. Default `true`. */
  autoRepeat?: boolean;
  /** Show the value in a sunken well on the inline-start side of the buttons. */
  showValue?: boolean;
  /** Formats the shown value, e.g. `(v) => v + " %"`. */
  formatValue?: (value: number) => string;
  /** 30 px (fits a 44 px list row) or 44 px. Default `"sm"`. */
  size?: StepperSize;
  /** The bar-button gel of the theme, or the blue-gray gel of a blue NavigationBar. Default `"dark"`. */
  tint?: StepperTint;
  /** Dims the whole control; both buttons disable. */
  disabled?: boolean;
  /** `aria-label` for the group, e.g. `"Quantity"`. */
  label?: string;
  /** `aria-label` of the − button. Default `"Decrease"`. */
  decrementLabel?: string;
  /** `aria-label` of the + button. Default `"Increase"`. */
  incrementLabel?: string;
}

const REPEAT_DELAY_MS = 500;
const REPEAT_INTERVAL_MS = 100;
const REPEAT_FAST_INTERVAL_MS = 50;
const REPEAT_FAST_AFTER_MS = 2000;

/** Decimal places of a number, including the `1e-7` spelling. */
function decimalsOf(n: number): number {
  const match = /(?:\.(\d+))?(?:e-(\d+))?$/.exec(String(n));
  return (match?.[1]?.length ?? 0) + Number(match?.[2] ?? 0);
}

/** The value math, kept pure so the auto-repeat can call it from a timer. */
interface StepperConfig {
  min: number;
  max: number;
  step: number;
  wraps: boolean;
}

function clamp(value: number, { min, max }: StepperConfig): number {
  return Math.min(max, Math.max(min, value));
}

/** `current` moved by `direction` steps, rounded to the step grid's precision, clamped or wrapped. */
function stepValue(current: number, direction: 1 | -1, config: StepperConfig): number {
  const { min, max, step, wraps } = config;
  const precision = Math.min(20, Math.max(decimalsOf(step), decimalsOf(min)));
  const next = Number((current + direction * step).toFixed(precision));
  if (wraps) {
    if (next > max) return min;
    if (next < min) return max;
    return next;
  }
  return clamp(next, config);
}

/**
 * The joined "− | +" gel control (`UIStepper`) for a list row: two glass
 * segments cut by a 1 px black divider, like a two-segment SegmentedControl,
 * with an optional sunken value well beside them.
 *
 * The buttons are ordinary buttons (Tab / Enter / Space); on either one
 * ArrowUp/ArrowRight increment, ArrowDown/ArrowLeft decrement and Home/End
 * jump to the bounds. Holding a button repeats.
 */
export const Stepper = forwardRef<HTMLDivElement, StepperProps>(function Stepper(
  {
    value,
    defaultValue,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    wraps = false,
    autoRepeat = true,
    showValue = false,
    formatValue,
    size = "sm",
    tint = "dark",
    disabled = false,
    label,
    decrementLabel = "Decrease",
    incrementLabel = "Increase",
    className,
    ...rest
  },
  ref,
) {
  const config: StepperConfig = { min, max, step, wraps };
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => clamp(defaultValue ?? min, config));
  const current = isControlled ? value : internal;

  // Latest value and props for the auto-repeat, whose timers outlive a render.
  // Uncontrolled steps write the ref straight away so back-to-back steps chain;
  // controlled ones rely on the parent re-rendering with the value it accepted.
  const latest = useRef({ current, config, onChange, isControlled });
  latest.current = { current, config, onChange, isControlled };

  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);

  const stopRepeat = () => {
    if (repeatTimer.current) clearTimeout(repeatTimer.current);
    repeatTimer.current = null;
  };
  useEffect(() => stopRepeat, []);

  /** Commits `next`; returns whether the value actually moved. */
  const commit = (next: number): boolean => {
    const { current: now, onChange: change, isControlled: controlled } = latest.current;
    if (next === now) return false;
    if (!controlled) {
      latest.current.current = next;
      setInternal(next);
    }
    change?.(next);
    return true;
  };

  const stepBy = (direction: 1 | -1) =>
    commit(stepValue(latest.current.current, direction, latest.current.config));

  /* ---- pointer: hold to repeat ---------------------------------------- */

  const press = (direction: 1 | -1) => (event: PointerEvent<HTMLButtonElement>) => {
    if (!autoRepeat || disabled) return;
    if (event.button !== 0) return;
    stopRepeat();
    repeated.current = false;
    const start = Date.now();
    const tick = () => {
      repeated.current = true;
      // A held button that reached its bound (and so just went disabled) may
      // never see its pointerup — stop as soon as a step changes nothing.
      if (!stepBy(direction)) {
        stopRepeat();
        return;
      }
      const fast = Date.now() - start >= REPEAT_FAST_AFTER_MS;
      repeatTimer.current = setTimeout(tick, fast ? REPEAT_FAST_INTERVAL_MS : REPEAT_INTERVAL_MS);
    };
    repeatTimer.current = setTimeout(tick, REPEAT_DELAY_MS);
  };

  const activate = (direction: 1 | -1) => (event: MouseEvent<HTMLButtonElement>) => {
    // A held button already stepped while repeating, so its release must not add
    // one more. Keyboard activation (`detail === 0`) never follows a hold and is exempt.
    if (repeated.current && event.detail !== 0) {
      repeated.current = false;
      return;
    }
    stepBy(direction);
  };

  /* ---- keyboard --------------------------------------------------------- */

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (event.key) {
      case "ArrowUp":
      case "ArrowRight":
        stepBy(1);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        stepBy(-1);
        break;
      case "Home":
        commit(min);
        break;
      case "End":
        commit(max);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /* ---- render ----------------------------------------------------------- */

  const atMin = current <= min;
  const atMax = current >= max;
  const decrementDisabled = disabled || (!wraps && atMin);
  const incrementDisabled = disabled || (!wraps && atMax);

  const button = (
    direction: 1 | -1,
    { text, icon, isDisabled }: { text: string; icon: typeof Minus; isDisabled: boolean },
  ) => (
    <button
      type="button"
      aria-label={text}
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      className={cn(
        "gs-stepper__button",
        direction === 1 ? "gs-stepper__button--increment" : "gs-stepper__button--decrement",
      )}
      onPointerDown={press(direction)}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      onPointerCancel={stopRepeat}
      onClick={activate(direction)}
      onKeyDown={handleKeyDown}
    >
      <Icon icon={icon} variant="flat" size={16} strokeWidth={3} className="gs-stepper__icon" />
    </button>
  );

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        "gs-stepper",
        `gs-stepper--${size}`,
        `gs-stepper--${tint}`,
        disabled && "gs-stepper--disabled",
        className,
      )}
      {...rest}
    >
      {showValue && (
        <span className="gs-stepper__value" aria-live="polite" aria-atomic="true">
          {formatValue ? formatValue(current) : String(current)}
        </span>
      )}
      <span className="gs-stepper__buttons">
        {button(-1, { text: decrementLabel, icon: Minus, isDisabled: decrementDisabled })}
        {button(1, { text: incrementLabel, icon: Plus, isDisabled: incrementDisabled })}
      </span>
    </div>
  );
});
