import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import "./Slider.css";

export interface SliderProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange" | "size" | "type" | "min" | "max" | "step"
  > {
  /** Controlled value. Leave undefined to let the slider manage its own state. */
  value?: number;
  /** Initial value when uncontrolled. Default: `min`. */
  defaultValue?: number;
  /** Fires continuously while dragging (and on every key press). */
  onChange?: (value: number) => void;
  /** Fires when the value is committed — pointer release / key release (the native `change` event). */
  onChangeEnd?: (value: number) => void;
  /** Default `0`. */
  min?: number;
  /** Default `100`. */
  max?: number;
  /** Default `1`. */
  step?: number;
  disabled?: boolean;
  /** Accessible name (`aria-label`). Required unless `aria-labelledby` is passed. */
  label?: string;
  /** Small flat gray icon left of the track (e.g. `Volume`, `Sun`). */
  minIcon?: LucideIcon;
  /** Larger flat gray icon right of the track (e.g. `Volume2`, `Sun`). */
  maxIcon?: LucideIcon;
  /** Renders the numeric value right of the track. */
  showValue?: boolean;
  /** `className` goes to the `<input>`; this one to the outer wrapper. */
  wrapperClassName?: string;
}

const MIN_ICON_SIZE = 16;
const MAX_ICON_SIZE = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The iOS 3 volume / brightness slider: a thin sunken track, blue gel fill to
 * the left of the knob, dark inset to the right, and a round silver gel knob
 * (the Switch's) with a black outline. Optional flat icons at each end.
 *
 * Built on a native `<input type="range">` so keyboard, touch, forms and
 * assistive tech come for free; the ref points at that input. The blue fill
 * is driven by the `--gs-slider-pct` custom property on the wrapper.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  {
    value,
    defaultValue,
    onChange,
    onChangeEnd,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    label,
    minIcon: MinIcon,
    maxIcon: MaxIcon,
    showValue = false,
    wrapperClassName,
    className,
    ...rest
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  // Mirror the value for uncontrolled usage so the blue fill tracks the knob.
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => clamp(defaultValue ?? min, min, max));
  const current = isControlled ? value : internal;

  const range = max - min;
  const pct = range > 0 ? clamp(((current - min) / range) * 100, 0, 100) : 0;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  // React's `onChange` is the continuous `input` event; the native `change`
  // event (fired once on release) is what `onChangeEnd` maps to. Keep the
  // latest callback in a ref so the listener is attached only once.
  const onChangeEndRef = useRef(onChangeEnd);
  onChangeEndRef.current = onChangeEnd;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleNativeChange = () => {
      onChangeEndRef.current?.(Number(input.value));
    };
    input.addEventListener("change", handleNativeChange);
    return () => input.removeEventListener("change", handleNativeChange);
  }, []);

  return (
    <div
      className={cn("gs-slider", disabled && "gs-slider--disabled", wrapperClassName)}
      style={{ "--gs-slider-pct": pct } as CSSProperties}
    >
      {MinIcon && (
        <Icon
          icon={MinIcon}
          variant="flat"
          size={MIN_ICON_SIZE}
          className="gs-slider__icon gs-slider__icon--min"
        />
      )}
      <input
        ref={inputRef}
        type="range"
        className={cn("gs-slider__input", className)}
        value={isControlled ? value : undefined}
        defaultValue={isControlled ? undefined : internal}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        {...rest}
      />
      {MaxIcon && (
        <Icon
          icon={MaxIcon}
          variant="flat"
          size={MAX_ICON_SIZE}
          className="gs-slider__icon gs-slider__icon--max"
        />
      )}
      {showValue && <span className="gs-slider__value">{current}</span>}
    </div>
  );
});
