import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { CircleX, Search, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import "./TextField.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Bold inline label on the left of the well — the iOS grouped-form "Name | value" pattern. */
  label?: ReactNode;
  /** Secondary hint under the field. */
  helper?: ReactNode;
  /** Error message under the field; also tints the rim red and sets `aria-invalid`. */
  error?: ReactNode;
  /** Shows the gray ⓧ button while the field has a value. Clearing fires `onChange` (empty) and `onClear`. */
  clearable?: boolean;
  onClear?: () => void;
  /** Flat gray lucide icon on the left. */
  leadingIcon?: LucideIcon;
  /** 44 px (default) or 50 px tall. */
  size?: "md" | "lg";
  /** `className` goes to the `<input>`; this one to the outer wrapper. */
  wrapperClassName?: string;
}

const ICON_SIZE = 18;

/**
 * Sunken text input. Unlike the raised gel buttons, iOS 3 text fields were
 * pressed *into* the surface: dark well, inset shadow, hairline black edge.
 * Controlled (`value`) and uncontrolled (`defaultValue`) both work; the
 * clear button clears either way and reports through `onChange`.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    helper,
    error,
    clearable = false,
    onClear,
    leadingIcon: LeadingIcon,
    size = "md",
    wrapperClassName,
    className,
    id: idProp,
    value,
    defaultValue,
    onChange,
    disabled,
    readOnly,
    type = "text",
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  // Mirror the value for uncontrolled usage so the clear button knows when to show.
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(() => String(defaultValue ?? ""));
  const currentValue = isControlled ? value : innerValue;
  const hasValue = currentValue != null && String(currentValue).length > 0;
  const showClear = clearable && hasValue && !disabled && !readOnly;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInnerValue(e.target.value);
    onChange?.(e);
  };

  const handleClear = () => {
    const input = inputRef.current;
    if (!input) return;
    // Write through the prototype setter so React's value tracker sees a real
    // change and dispatches `onChange` with a genuine event (controlled or not).
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, "");
    else input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    if (!isControlled) setInnerValue("");
    onClear?.();
    input.focus();
  };

  // Tapping the well's padding or the leading icon focuses the input (the icon
  // is `pointer-events: none`, so its clicks land on the well itself).
  const handleWellClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) inputRef.current?.focus();
  };

  const describedBy =
    [ariaDescribedBy, helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div
      className={cn(
        "gs-textfield",
        `gs-textfield--${size}`,
        !!error && "gs-textfield--error",
        disabled && "gs-textfield--disabled",
        wrapperClassName,
      )}
    >
      <div className="gs-textfield__field" onClick={handleWellClick}>
        {label && (
          <label htmlFor={id} className="gs-textfield__label">
            {label}
          </label>
        )}
        {LeadingIcon && (
          <Icon icon={LeadingIcon} variant="flat" size={ICON_SIZE} className="gs-textfield__icon" />
        )}
        <input
          ref={inputRef}
          id={id}
          type={type}
          className={cn("gs-textfield__input", className)}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {showClear && (
          <button
            type="button"
            className="gs-textfield__clear"
            aria-label="Clear"
            // keep focus in the input while the button is pressed
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          >
            <Icon icon={CircleX} variant="flat" size={ICON_SIZE} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {helper && (
        <div id={helperId} className="gs-textfield__helper">
          {helper}
        </div>
      )}
      {error && (
        <div id={errorId} className="gs-textfield__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

export interface SearchFieldProps extends Omit<TextFieldProps, "label" | "leadingIcon" | "size"> {
  /** Renders the small dark-gel "Cancel" button to the right of the pill. */
  showCancel?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
}

/**
 * The iOS 3 search bar: a short pill well with a magnifier, a ⓧ once you type,
 * and an optional gel "Cancel" button beside it.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    showCancel = false,
    cancelLabel = "Cancel",
    onCancel,
    wrapperClassName,
    placeholder = "Search",
    clearable = true,
    type = "search",
    ...rest
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  const handleCancel = () => {
    onCancel?.();
    inputRef.current?.blur();
  };

  return (
    <div className={cn("gs-searchfield", wrapperClassName)}>
      <TextField
        ref={inputRef}
        wrapperClassName="gs-searchfield__field"
        leadingIcon={Search}
        placeholder={placeholder}
        clearable={clearable}
        type={type}
        enterKeyHint="search"
        {...rest}
      />
      {showCancel && (
        <button
          type="button"
          className="gs-searchfield__cancel"
          // don't blur the input before `onCancel` runs (lets `showCancel={focused}` work)
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCancel}
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
});
