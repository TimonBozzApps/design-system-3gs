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
import { Icon } from "../Icon";
import { Badge } from "../Badge";
import "./TabBar.css";

/* ---- context ------------------------------------------------------------ */

interface TabBarContextValue {
  /** Value of the selected tab. */
  selected: string | undefined;
  /** Value of the tab that carries `tabIndex=0` (roving tabindex). */
  focusable: string | undefined;
  select: (value: string) => void;
}

const TabBarContext = createContext<TabBarContextValue | null>(null);

/** Ordered `value`s of the direct `<TabBarItem>` children. */
function collectValues(children: ReactNode): string[] {
  const values: string[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<{ value?: unknown }>(child) && typeof child.props.value === "string") {
      values.push(child.props.value);
    }
  });
  return values;
}

/* ---- TabBar ------------------------------------------------------------- */

export interface TabBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Controlled selected tab. */
  value?: string;
  /** Uncontrolled initial tab. Defaults to the first item — an iOS tab bar always has a selection. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** `aria-label` for the tablist. Default `"Tabs"`. */
  label?: string;
  /** `<TabBarItem>`s. */
  children: ReactNode;
}

/**
 * The 49 px black-glass bottom bar (`UITabBar`, `UIBarStyleBlack`): evenly
 * spaced items, each a gray gel icon over a tiny bold label; the selected one
 * turns blue on a subtly lighter, slightly sunken rounded rectangle.
 *
 * Keyboard: Left/Right (and Home/End) move focus *and* select — roving
 * tabindex, so the bar is a single Tab stop.
 */
export const TabBar = forwardRef<HTMLDivElement, TabBarProps>(function TabBar(
  { value, defaultValue, onChange, label = "Tabs", className, children, onKeyDown, ...rest },
  ref,
) {
  const values = collectValues(children);
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | undefined>(() => defaultValue ?? values[0]);
  const selected = isControlled ? value : internal;
  // if nothing (or an unknown value) is selected, the first tab stays reachable by keyboard
  const focusable = selected !== undefined && values.includes(selected) ? selected : values[0];

  const select = useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const ctx = useMemo<TabBarContextValue>(
    () => ({ selected, focusable, select }),
    [selected, focusable, select],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).filter((tab) => !tab.disabled);
    if (tabs.length === 0) return;

    const current = tabs.findIndex((tab) => tab.contains(event.target as Node));
    if (current === -1) return;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (current + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const target = tabs[next];
    target.focus();
    target.click(); // selection follows focus (the item's click handler calls `select`)
  };

  return (
    <TabBarContext.Provider value={ctx}>
      <div
        ref={ref}
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className={cn("gs-tabbar", className)}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    </TabBarContext.Provider>
  );
});

/* ---- TabBarItem --------------------------------------------------------- */

export interface TabBarItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  /** Identifies the tab; what `TabBar` reports through `onChange`. */
  value: string;
  /** Any `lucide-react` icon — gray glass when idle, blue glass when selected. */
  icon: LucideIcon;
  /** The 10 px bold caption under the icon. */
  label: string;
  /** Red gel badge on the icon's top-right corner (`43`, `"New"`; numbers > 99 render `99+`). */
  badge?: number | string;
}

export const TabBarItem = forwardRef<HTMLButtonElement, TabBarItemProps>(function TabBarItem(
  { value, icon, label, badge, className, onClick, ...rest },
  ref,
) {
  const ctx = useContext(TabBarContext);
  if (!ctx) {
    throw new Error("<TabBarItem> must be rendered inside a <TabBar>.");
  }
  const selected = ctx.selected === value;
  // roving tabindex; if the bar couldn't determine a focusable tab, every tab stays reachable
  const tabIndex = ctx.focusable === undefined || ctx.focusable === value ? 0 : -1;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || selected) return;
    ctx.select(value);
  };

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={tabIndex}
      className={cn("gs-tabbar-item", selected && "gs-tabbar-item--selected", className)}
      onClick={handleClick}
      {...rest}
    >
      <span className="gs-tabbar-item__icon">
        <Icon icon={icon} variant={selected ? "active" : "gloss"} size={26} />
        <Badge value={badge} className="gs-tabbar-item__badge" />
      </span>
      <span className="gs-tabbar-item__label">{label}</span>
    </button>
  );
});
