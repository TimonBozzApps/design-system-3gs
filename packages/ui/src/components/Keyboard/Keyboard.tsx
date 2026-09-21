import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { ArrowBigUp, Delete } from "lucide-react";
import { cn } from "../../lib/cn";
import { Icon } from "../Icon";
import "./Keyboard.css";

export type KeyboardLayer = "letters" | "numbers" | "symbols";
export type KeyboardReturnKey = "return" | "Go" | "Search" | "Done" | "Send" | "Next";

// `autoCapitalize` shadows the native string attribute on purpose: here it is a boolean.
export interface KeyboardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "autoCapitalize"> {
  /** High-level binding: the keyboard edits this string (append / backspace) and reports the result. */
  value?: string;
  onChange?: (value: string) => void;
  /** Low-level: a character, `" "` for space, `"\n"` for return. Fired in addition to `onChange`. */
  onKey?: (key: string) => void;
  onBackspace?: () => void;
  onReturn?: () => void;
  /** Label of the return key. Anything but `"return"` renders as the blue gel key (`UIReturnKeyType`). */
  returnKey?: KeyboardReturnKey;
  /** Controlled layer. Leave undefined to let the keyboard manage its own, starting at `"letters"`. */
  layer?: KeyboardLayer;
  onLayerChange?: (layer: KeyboardLayer) => void;
  /** Start with shift on (sentence start). Default `false`. */
  defaultShift?: boolean;
  /** Shift auto-enables on an empty value or after `". "`. Only acts through the `value`/`onChange` binding. */
  autoCapitalize?: boolean;
  disabled?: boolean;
  /** Accessible name (`aria-label`). Default `"Keyboard"`. */
  label?: string;
}

/* ---- layouts ------------------------------------------------------------- */

type KeyDef =
  | { kind: "char"; value: string }
  | { kind: "shift" }
  | { kind: "delete" }
  | { kind: "layer"; to: KeyboardLayer; text: string; wide?: boolean }
  | { kind: "space" }
  | { kind: "return" };

const chars = (s: string): KeyDef[] => s.split("").map((value) => ({ kind: "char", value }));
const SHIFT: KeyDef = { kind: "shift" };
const DELETE: KeyDef = { kind: "delete" };
const SPACE: KeyDef = { kind: "space" };
const RETURN: KeyDef = { kind: "return" };
const TO_NUMBERS: KeyDef = { kind: "layer", to: "numbers", text: "123" };
const TO_SYMBOLS: KeyDef = { kind: "layer", to: "symbols", text: "#+=" };
const TO_LETTERS_WIDE: KeyDef = { kind: "layer", to: "letters", text: "ABC", wide: true };
const TO_NUMBERS_WIDE: KeyDef = { kind: "layer", to: "numbers", text: "123", wide: true };

const LAYOUTS: Record<KeyboardLayer, KeyDef[][]> = {
  letters: [
    chars("qwertyuiop"),
    chars("asdfghjkl"),
    [SHIFT, ...chars("zxcvbnm"), DELETE],
    [TO_NUMBERS_WIDE, SPACE, RETURN],
  ],
  numbers: [
    chars("1234567890"),
    chars('-/:;()$&@"'),
    [TO_SYMBOLS, ...chars(".,?!'"), DELETE],
    [TO_LETTERS_WIDE, SPACE, RETURN],
  ],
  symbols: [
    chars("[]{}#%^*+="),
    chars("_\\|~<>€£¥•"),
    [TO_NUMBERS, ...chars(".,?!'"), DELETE],
    [TO_LETTERS_WIDE, SPACE, RETURN],
  ],
};

const LAYER_LABEL: Record<KeyboardLayer, string> = {
  letters: "letters",
  numbers: "numbers",
  symbols: "symbols",
};

const POPUP_WIDTH = 46;
const CAPS_DOUBLE_TAP_MS = 300;
const REPEAT_DELAY_MS = 500;
const REPEAT_INTERVAL_MS = 100;

type Shift = "off" | "on" | "caps";
type PopupEdge = "left" | "right";
interface Pressed {
  id: string;
  edge?: PopupEdge;
}

/** Sentence start: empty, a new line, or a sentence terminator followed by whitespace. */
const wantsCapital = (text: string) =>
  text.length === 0 || /[.!?]\s+$/.test(text) || /\n\s*$/.test(text);

/**
 * The iOS 3 on-screen keyboard in its dark "alert" appearance
 * (`UIKeyboardAppearanceAlert`): 320×216, dark gel letter keys, darker
 * function keys, and the enlarged popup bubble above the key being pressed.
 *
 * Keys are real buttons. Every key cancels `pointerdown`/`mousedown` so a
 * focused text field elsewhere on the page keeps its focus (and caret) while
 * the user types here; the key commits on `click`, so keyboard activation
 * (Tab + Enter/Space) works too.
 */
export const Keyboard = forwardRef<HTMLDivElement, KeyboardProps>(function Keyboard(
  {
    value,
    onChange,
    onKey,
    onBackspace,
    onReturn,
    returnKey = "return",
    layer: layerProp,
    onLayerChange,
    defaultShift = false,
    autoCapitalize = false,
    disabled = false,
    label = "Keyboard",
    className,
    ...rest
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement, []);

  const [internalLayer, setInternalLayer] = useState<KeyboardLayer>("letters");
  const layer = layerProp ?? internalLayer;

  const [shift, setShift] = useState<Shift>(() =>
    defaultShift || (autoCapitalize && !!onChange && wantsCapital(value ?? "")) ? "on" : "off",
  );
  const [pressed, setPressed] = useState<Pressed | null>(null);

  // Latest props for the delete auto-repeat, whose timers outlive a render.
  const latest = useRef({ value, onChange, onBackspace, autoCapitalize });
  latest.current = { value, onChange, onBackspace, autoCapitalize };

  const lastShiftTap = useRef(0);
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const repeated = useRef(false);

  const stopRepeat = () => {
    if (repeatTimer.current) clearTimeout(repeatTimer.current);
    if (repeatInterval.current) clearInterval(repeatInterval.current);
    repeatTimer.current = null;
    repeatInterval.current = null;
  };
  useEffect(() => stopRepeat, []);

  /* ---- editing --------------------------------------------------------- */

  /**
   * Where shift lands after an edit or a layer switch. Caps lock is sticky;
   * with the `autoCapitalize` binding shift follows the text; otherwise a
   * one-shot shift ends only when a letter (or a layer switch) consumed it.
   */
  const settleShift = (text: string, consumed: boolean) => {
    const { autoCapitalize: auto, onChange: bound } = latest.current;
    setShift((prev) => {
      if (prev === "caps") return prev;
      if (auto && bound) return wantsCapital(text) ? "on" : "off";
      return consumed ? "off" : prev;
    });
  };

  const setLayer = (next: KeyboardLayer) => {
    if (next === layer) return;
    if (layerProp === undefined) setInternalLayer(next);
    onLayerChange?.(next);
    settleShift(value ?? "", true);
  };

  const typeChar = (raw: string) => {
    const isLetter = layer === "letters";
    const char = isLetter && shift !== "off" ? raw.toUpperCase() : raw;
    const next = (value ?? "") + char;
    onKey?.(char);
    onChange?.(next);
    settleShift(next, isLetter);
  };

  const typeSpace = () => {
    const next = (value ?? "") + " ";
    onKey?.(" ");
    onChange?.(next);
    settleShift(next, false);
  };

  const typeReturn = () => {
    const inserts = returnKey === "return";
    const next = inserts ? (value ?? "") + "\n" : value ?? "";
    onKey?.("\n");
    onReturn?.();
    if (inserts) onChange?.(next);
    settleShift(next, false);
  };

  // Reads through `latest` so the repeat interval never sees a stale value.
  const backspace = () => {
    const { value: current, onChange: change, onBackspace: back } = latest.current;
    const next = (current ?? "").slice(0, -1);
    back?.();
    change?.(next);
    settleShift(next, false);
  };

  const tapShift = () => {
    const now = Date.now();
    const doubleTap = now - lastShiftTap.current < CAPS_DOUBLE_TAP_MS;
    lastShiftTap.current = now;
    setShift((prev) => {
      if (prev === "caps") return "off";
      if (prev === "on") return doubleTap ? "caps" : "off";
      return "on";
    });
  };

  /* ---- pointer / press state ------------------------------------------- */

  const popupEdge = (button: HTMLElement): PopupEdge | undefined => {
    const root = rootRef.current;
    if (!root) return undefined;
    const k = button.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    const overhang = (POPUP_WIDTH - k.width) / 2;
    if (k.left - overhang < r.left) return "left";
    if (k.right + overhang > r.right) return "right";
    return undefined;
  };

  const press = (id: string, key: KeyDef) => (event: PointerEvent<HTMLButtonElement>) => {
    // Keep focus where it is (a text field) — the key itself never takes it.
    event.preventDefault();
    if (event.button !== 0 && event.pointerType === "mouse") return;
    setPressed({
      id,
      edge: key.kind === "char" ? popupEdge(event.currentTarget) : undefined,
    });
    if (key.kind === "delete") {
      stopRepeat();
      repeated.current = false;
      repeatTimer.current = setTimeout(() => {
        repeated.current = true;
        backspace();
        repeatInterval.current = setInterval(backspace, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }
  };

  const release = () => {
    setPressed(null);
    stopRepeat();
  };

  const preventFocus = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

  const activate = (key: KeyDef) => (event: MouseEvent<HTMLButtonElement>) => {
    switch (key.kind) {
      case "char":
        typeChar(key.value);
        break;
      case "space":
        typeSpace();
        break;
      case "return":
        typeReturn();
        break;
      case "shift":
        tapShift();
        break;
      case "layer":
        setLayer(key.to);
        break;
      case "delete":
        // A held key already deleted while repeating, so its release must not add one
        // more. Keyboard activation (`detail === 0`) never follows a hold and is exempt.
        if (repeated.current && event.detail !== 0) repeated.current = false;
        else backspace();
        break;
    }
  };

  /* ---- render ---------------------------------------------------------- */

  const upper = layer === "letters" && shift !== "off";

  const renderKey = (key: KeyDef, id: string) => {
    const isPressed = pressed?.id === id;
    const common = {
      type: "button" as const,
      disabled,
      onPointerDown: press(id, key),
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
      onMouseDown: preventFocus,
      onClick: activate(key),
    };

    switch (key.kind) {
      case "char": {
        const glyph = upper ? key.value.toUpperCase() : key.value;
        return (
          <button
            key={id}
            {...common}
            className={cn(
              "gs-keyboard__key",
              "gs-keyboard__key--letter",
              layer !== "letters" && "gs-keyboard__key--symbol",
              isPressed && "gs-keyboard__key--pressed",
            )}
          >
            {glyph}
            {isPressed && (
              <span
                aria-hidden="true"
                className={cn(
                  "gs-keyboard__popup",
                  pressed?.edge === "left" && "gs-keyboard__popup--left",
                  pressed?.edge === "right" && "gs-keyboard__popup--right",
                )}
              >
                {glyph}
              </span>
            )}
          </button>
        );
      }
      case "shift":
        return (
          <button
            key={id}
            {...common}
            aria-label="shift"
            aria-pressed={shift !== "off"}
            className={cn(
              "gs-keyboard__key",
              "gs-keyboard__key--fn",
              "gs-keyboard__key--shift",
              shift === "on" && "gs-keyboard__key--shift-on",
              shift === "caps" && "gs-keyboard__key--caps",
              isPressed && "gs-keyboard__key--pressed",
            )}
          >
            <Icon
              icon={ArrowBigUp}
              variant="flat"
              size={22}
              strokeWidth={2}
              fill={shift !== "off" ? "currentColor" : "none"}
              className="gs-keyboard__icon"
            />
          </button>
        );
      case "delete":
        return (
          <button
            key={id}
            {...common}
            aria-label="delete"
            className={cn(
              "gs-keyboard__key",
              "gs-keyboard__key--fn",
              "gs-keyboard__key--delete",
              isPressed && "gs-keyboard__key--pressed",
            )}
          >
            <Icon
              icon={Delete}
              variant="flat"
              size={22}
              strokeWidth={2}
              className="gs-keyboard__icon"
            />
          </button>
        );
      case "layer":
        return (
          <button
            key={id}
            {...common}
            aria-label={LAYER_LABEL[key.to]}
            className={cn(
              "gs-keyboard__key",
              "gs-keyboard__key--fn",
              key.wide && "gs-keyboard__key--wide",
              isPressed && "gs-keyboard__key--pressed",
            )}
          >
            {key.text}
          </button>
        );
      case "space":
        return (
          <button
            key={id}
            {...common}
            aria-label="space"
            className={cn(
              "gs-keyboard__key",
              "gs-keyboard__key--space",
              isPressed && "gs-keyboard__key--pressed",
            )}
          >
            space
          </button>
        );
      case "return":
        return (
          <button
            key={id}
            {...common}
            aria-label={returnKey}
            className={cn(
              "gs-keyboard__key",
              "gs-keyboard__key--return",
              returnKey !== "return" && "gs-keyboard__key--return-blue",
              isPressed && "gs-keyboard__key--pressed",
            )}
          >
            {returnKey}
          </button>
        );
    }
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn("gs-keyboard", disabled && "gs-keyboard--disabled", className)}
      {...rest}
    >
      {LAYOUTS[layer].map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            "gs-keyboard__row",
            rowIndex === 1 && "gs-keyboard__row--inset",
            rowIndex === 3 && "gs-keyboard__row--bottom",
          )}
        >
          {row.map((key, colIndex) => renderKey(key, `${rowIndex}-${colIndex}`))}
        </div>
      ))}
    </div>
  );
});
