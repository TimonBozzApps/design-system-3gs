import { forwardRef, useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { cn } from "../../lib/cn";
import { useGsStrings } from "../../lib/i18n";
import "./Switch.css";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "value"> {
  /** Controlled state. Leave undefined to let the switch manage its own state. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Text on the blue half. Default `strings.on` ("ON"). */
  onLabel?: string;
  /** Text on the dark half. Default `strings.off` ("OFF"). */
  offLabel?: string;
  /** Accessible name (`aria-label`) when there is no visible label. */
  label?: string;
  /** When set, a hidden `<input type="checkbox">` carries the value in form submissions. */
  name?: string;
}

/**
 * The iOS 3 ON/OFF slider: a 94×27 gel pill whose two-tone strip (blue "ON",
 * dark "OFF") slides under a silver gel knob.
 *
 * Rendered as `<button role="switch">`. Space and Enter already dispatch
 * `click` on a native button, so a single click handler covers pointer and
 * keyboard activation.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    defaultChecked = false,
    onChange,
    disabled = false,
    onLabel,
    offLabel,
    label,
    name,
    className,
    onClick,
    ...rest
  },
  ref,
) {
  const strings = useGsStrings();
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = isControlled ? checked : internal;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    const next = !isOn;
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={label}
        disabled={disabled}
        className={cn(
          "gs-switch",
          isOn && "gs-switch--on",
          disabled && "gs-switch--disabled",
          className,
        )}
        onClick={handleClick}
        {...rest}
      >
        <span className="gs-switch__track" aria-hidden="true">
          <span className="gs-switch__strip">
            <span className="gs-switch__on">{onLabel ?? strings.on}</span>
            <span className="gs-switch__off">{offLabel ?? strings.off}</span>
          </span>
        </span>
        <span className="gs-switch__knob" aria-hidden="true" />
      </button>
      {name && (
        <input
          type="checkbox"
          name={name}
          checked={isOn}
          disabled={disabled}
          readOnly
          hidden
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </>
  );
});
