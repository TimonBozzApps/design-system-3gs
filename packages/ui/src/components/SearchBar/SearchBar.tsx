import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn } from "../../lib/cn";
import { useGsStrings } from "../../lib/i18n";
import type { NavigationBarTint } from "../NavigationBar";
import { Segment, SegmentedControl } from "../SegmentedControl";
import { SearchField } from "../TextField";
import "./SearchBar.css";

/** One scope button under the field. */
export interface SearchScope {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SearchBarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Controlled query. */
  value?: string;
  /** Uncontrolled initial query. */
  defaultValue?: string;
  /** Fires on every keystroke, on ⓧ and on Cancel (with `""`). */
  onChange?: (query: string) => void;
  /** Enter key — the keyboard's "Search". */
  onSearch?: (query: string) => void;
  /**
   * Cancel tapped. The bar clears the query (reports `onChange("")` when
   * controlled — keep your `value` to override) and gives up focus first.
   */
  onCancel?: () => void;
  /** Defaults to the SearchField's placeholder (`strings.search`, "Search"). */
  placeholder?: string;
  /** When given, a `SegmentedControl size="sm" block` row of scope buttons appears under the field. */
  scopes?: SearchScope[];
  /** Controlled scope. */
  scope?: string;
  /** Uncontrolled initial scope; falls back to the first one. */
  defaultScope?: string;
  onScopeChange?: (scope: string) => void;
  /** `always` (default) or fold the scope row open only while editing. */
  showsScopeBar?: "always" | "whileEditing";
  /**
   * `whileEditing` (default): Cancel slides in while the field is focused
   * or has text. `always` keeps it; `never` drops it.
   */
  showsCancel?: "whileEditing" | "always" | "never";
  /** Default `strings.cancel` ("Cancel"). */
  cancelLabel?: string;
  /** `black` glass (default) or the classic blue-gray bar — like NavigationBar. */
  tint?: NavigationBarTint;
  autoFocus?: boolean;
  disabled?: boolean;
  /** `aria-label` of the search landmark (and the input). Default `strings.search` ("Search"). */
  label?: string;
  /** Escape hatch for the inner `<input>`; `onChange` / `onKeyDown` given here are called too. */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

/**
 * UISearchBar: the strip of bar glass above a table — the pill search field,
 * a gel Cancel button that slides in while editing, and optional scope
 * buttons underneath. Same chrome as the NavigationBar, so it stacks straight
 * under one.
 *
 * "Editing" = focus is somewhere inside the bar (input, Cancel or a scope
 * button) or the field has text. Focus is tracked on the bar rather than the
 * input alone, so tabbing from the input to Cancel — or into the scope row —
 * doesn't fold those controls away from under the focus.
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  {
    value,
    defaultValue,
    onChange,
    onSearch,
    onCancel,
    placeholder,
    scopes,
    scope,
    defaultScope,
    onScopeChange,
    showsScopeBar = "always",
    showsCancel = "whileEditing",
    cancelLabel,
    tint = "black",
    autoFocus,
    disabled = false,
    label,
    inputProps,
    className,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const strings = useGsStrings();
  const rootRef = useRef<HTMLDivElement>(null);

  // Query: controlled or uncontrolled here; the inner SearchField is always
  // controlled from this state, so ⓧ and Cancel clear the DOM value either way.
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const query = isControlled ? value : innerValue;

  const isScopeControlled = scope !== undefined;
  const [innerScope, setInnerScope] = useState(() => defaultScope ?? scopes?.[0]?.value);
  const currentScope = isScopeControlled ? scope : innerScope;

  const [focusWithin, setFocusWithin] = useState(false);
  useEffect(() => {
    // `autoFocus` focuses during React's commit — make sure that counts as editing
    const root = rootRef.current;
    if (root && root.contains(document.activeElement)) setFocusWithin(true);
  }, []);

  const editing = focusWithin || query.length > 0;
  const hasScopes = !!scopes && scopes.length > 0;
  const cancelVisible =
    showsCancel === "always" || (showsCancel === "whileEditing" && editing && !disabled);
  const scopesVisible = hasScopes && (showsScopeBar === "always" || editing);

  const setQuery = (next: string) => {
    if (!isControlled) setInnerValue(next);
    onChange?.(next);
  };

  const { onChange: inputOnChange, onKeyDown: inputOnKeyDown, ...inputRest } = inputProps ?? {};

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    inputOnChange?.(event);
    setQuery(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    inputOnKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter") onSearch?.(query);
  };

  const handleCancel = () => {
    setQuery("");
    // Cancel resigns the whole bar — whichever part of it holds focus
    // (SearchField itself only blurs the input, afterwards).
    const active = document.activeElement;
    if (active instanceof HTMLElement && rootRef.current?.contains(active)) active.blur();
    onCancel?.();
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    onFocus?.(event);
    setFocusWithin(true);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);
    // still "within" when focus merely moves between the input, Cancel and a scope
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
  };

  const handleScopeChange = (next: string) => {
    if (!isScopeControlled) setInnerScope(next);
    onScopeChange?.(next);
  };

  // Tapping a scope must not take focus from the input — with a
  // "whileEditing" scope bar it would fold away under the finger. Same trick
  // as the SearchField's Cancel and ⓧ buttons.
  const keepFocus = (event: MouseEvent<HTMLDivElement>) => event.preventDefault();

  const searchLabel = label ?? strings.search;

  return (
    <div
      ref={rootRef}
      role="search"
      aria-label={searchLabel}
      className={cn(
        "gs-searchbar",
        `gs-searchbar--${tint}`,
        editing && "gs-searchbar--editing",
        disabled && "gs-searchbar--disabled",
        hasScopes && "gs-searchbar--has-scopes",
        cancelVisible && "gs-searchbar--show-cancel",
        scopesVisible && "gs-searchbar--show-scopes",
        className,
      )}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    >
      <div className="gs-searchbar__row">
        <SearchField
          aria-label={searchLabel}
          {...inputRest}
          ref={ref}
          wrapperClassName="gs-searchbar__field"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          // "never" drops the button; otherwise it stays mounted and the
          // --show-cancel class slides it in and out
          showCancel={showsCancel !== "never"}
          cancelLabel={cancelLabel}
          onCancel={handleCancel}
        />
      </div>
      {hasScopes && (
        <div className="gs-searchbar__scopes" onMouseDown={keepFocus}>
          <div className="gs-searchbar__scopes-clip">
            <SegmentedControl
              className="gs-searchbar__segments"
              size="sm"
              block
              tint={tint === "blue" ? "blue" : "dark"}
              value={currentScope}
              onChange={handleScopeChange}
            >
              {scopes.map((item) => (
                <Segment key={item.value} value={item.value} disabled={disabled || item.disabled}>
                  {item.label}
                </Segment>
              ))}
            </SegmentedControl>
          </div>
        </div>
      )}
    </div>
  );
});
