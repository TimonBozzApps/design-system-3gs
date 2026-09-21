import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react";

/**
 * Every user-facing string a component falls back to when the caller passes
 * no explicit label. Override any subset through `<GsProvider strings>`.
 */
export interface GsStrings {
  /* ---- buttons ---------------------------------------------------------- */
  /** ActionSheet cancel button, SearchField cancel button, ModalSheet left bar button. */
  cancel: string;
  /** ModalSheet right bar button; Keyboard `returnKey="Done"`. */
  done: string;
  ok: string;
  close: string;
  /** TextField clear (ⓧ) button `aria-label`. */
  clear: string;
  /** SearchField default placeholder; Keyboard `returnKey="Search"`. */
  search: string;
  /** Keyboard `returnKey="Go"` / `"Send"` / `"Next"`. */
  go: string;
  send: string;
  next: string;

  /* ---- status ----------------------------------------------------------- */
  /** ActivityIndicator `aria-label`. */
  loading: string;
  /** HUD `kind="progress"` bar `aria-label` when the title isn't a string. */
  progress: string;

  /* ---- landmark / group names ------------------------------------------- */
  /** ActionSheet `aria-label` when it has no title. */
  actions: string;
  /** Popover / ModalSheet `aria-label` when nothing else names the dialog. */
  dialog: string;
  /** TabBar tablist `aria-label`. */
  tabs: string;
  /** SegmentedControl group `aria-label`. */
  segments: string;
  /** PageControl tablist `aria-label`. */
  pages: string;
  /** PageControl dot `aria-label`, e.g. `"Page 2 of 5"`. */
  pageOf: (page: number, count: number) => string;
  /** Toolbar `aria-label`. */
  toolbar: string;

  /* ---- keyboard --------------------------------------------------------- */
  /** Keyboard group `aria-label`. */
  keyboard: string;
  shift: string;
  delete: string;
  /** Layer-switch key `aria-label`s (`123`, `#+=`, `ABC`). */
  numbers: string;
  symbols: string;
  letters: string;
  /** Visible label of the space bar. */
  space: string;
  /** Visible label of the plain (non-blue) return key. */
  return: string;

  /* ---- switch ----------------------------------------------------------- */
  on: string;
  off: string;

  /* ---- date picker ------------------------------------------------------ */
  /** DatePicker `aria-label` per mode. */
  date: string;
  time: string;
  dateTime: string;
  /** Drum (column) `aria-label`s. */
  month: string;
  day: string;
  year: string;
  hour: string;
  minute: string;
  dayPeriod: string;
  /** The rolling day drum's label for the current day. */
  today: string;
  /** Day-period fallbacks when `Intl` can't supply them for the locale. */
  am: string;
  pm: string;
}

/** English — what every component uses when no `<GsProvider>` is above it. */
export const defaultStrings: GsStrings = {
  cancel: "Cancel",
  done: "Done",
  ok: "OK",
  close: "Close",
  clear: "Clear",
  search: "Search",
  go: "Go",
  send: "Send",
  next: "Next",

  loading: "Loading",
  progress: "Progress",

  actions: "Actions",
  dialog: "Dialog",
  tabs: "Tabs",
  segments: "Segments",
  pages: "Pages",
  pageOf: (page, count) => `Page ${page} of ${count}`,
  toolbar: "Toolbar",

  keyboard: "Keyboard",
  shift: "shift",
  delete: "delete",
  numbers: "numbers",
  symbols: "symbols",
  letters: "letters",
  space: "space",
  return: "return",

  on: "ON",
  off: "OFF",

  date: "Date",
  time: "Time",
  dateTime: "Date and time",
  month: "Month",
  day: "Day",
  year: "Year",
  hour: "Hour",
  minute: "Minute",
  dayPeriod: "AM/PM",
  today: "Today",
  am: "AM",
  pm: "PM",
};

interface GsContextValue {
  /** BCP 47 tag for `Intl` formatting (DatePicker month / weekday / day-period names). */
  locale: string | undefined;
  strings: GsStrings;
}

const GsContext = createContext<GsContextValue>({ locale: undefined, strings: defaultStrings });

export interface GsProviderProps {
  /** BCP 47 locale, e.g. `"de-DE"`. Inherited from an outer provider when omitted. */
  locale?: string;
  /** Overrides merged over the outer provider's strings (or the English defaults). */
  strings?: Partial<GsStrings>;
  children: ReactNode;
}

/** `{ ...base, ...overrides }` that ignores `undefined` values so a partial never blanks a key. */
function mergeStrings(base: GsStrings, overrides: Partial<GsStrings>): GsStrings {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overrides) as Array<keyof GsStrings>) {
    const value = overrides[key];
    if (value !== undefined) out[key] = value;
  }
  return out as unknown as GsStrings;
}

/**
 * Sets the locale and the fallback UI strings for every component below it.
 * Providers nest: an inner one merges its `strings` over the outer one's and
 * inherits its `locale` when it sets none. Hoist the `strings` object (module
 * scope or `useMemo`) so the context value stays referentially stable.
 */
export function GsProvider({ locale, strings, children }: GsProviderProps): ReactElement {
  const parent = useContext(GsContext);
  const value = useMemo<GsContextValue>(
    () => ({
      locale: locale ?? parent.locale,
      strings: strings ? mergeStrings(parent.strings, strings) : parent.strings,
    }),
    [parent, locale, strings],
  );
  return <GsContext.Provider value={value}>{children}</GsContext.Provider>;
}

/** The effective strings — English defaults when no provider is above. */
export function useGsStrings(): GsStrings {
  return useContext(GsContext).strings;
}

/** The effective locale — `undefined` when no provider set one (components then use their own default). */
export function useGsLocale(): string | undefined {
  return useContext(GsContext).locale;
}
