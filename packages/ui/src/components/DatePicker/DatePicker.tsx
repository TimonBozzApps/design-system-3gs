import { forwardRef, useMemo, useState, type HTMLAttributes } from "react";
import { Picker, type PickerColumn, type PickerOption, type PickerValue } from "../Picker";
import { cn } from "../../lib/cn";
import { useGsLocale, useGsStrings } from "../../lib/i18n";
import "./DatePicker.css";

/* ---- types -------------------------------------------------------------- */

export type DatePickerMode = "date" | "time" | "dateTime";

export interface DatePickerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Which `UIDatePicker` preset. Default `date`. */
  mode?: DatePickerMode;
  /** Controlled value. */
  value?: Date;
  /** Uncontrolled initial value. Default: now, minutes rounded to `minuteInterval`. */
  defaultValue?: Date;
  onChange?: (date: Date) => void;
  /** Step of the minute drum. Default `1`. */
  minuteInterval?: 1 | 5 | 10 | 15 | 30;
  /** `h12` (1–12 plus an AM/PM drum, default) or `h23` (0–23). */
  hourCycle?: "h12" | "h23";
  /** Years offered by the `date` preset, inclusive. Default `[1970, 2037]`. */
  yearRange?: [number, number];
  /** `dateTime` preset: days before and after the initial value in the rolling day drum. Default `365`. */
  dayRange?: number;
  /** Intl locale for month, weekday and AM/PM names. Default: the `<GsProvider>` locale, else `en-US`. */
  locale?: string;
  /** Visible rows per drum. Default `5`. */
  rows?: 3 | 5 | 7;
  disabled?: boolean;
  /** `aria-label` for the picker. Default: `strings.date` / `time` / `dateTime` per `mode`. */
  label?: string;
}

/* ---- pure helpers (Date ⇄ PickerValue) ---------------------------------- */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Days in `month` (1–12) of `year`. */
export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

/** Local calendar date as `yyyy-mm-dd` — the stable option value of the rolling day drum. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Parses a `yyyy-mm-dd` string into `[year, month (1–12), day]`. */
function fromISODate(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

/**
 * Copy of `date` with seconds zeroed and minutes rounded to the nearest
 * multiple of `interval` (`:58` at interval 5 carries into the next hour).
 */
export function roundToInterval(date: Date, interval: number): Date {
  const out = new Date(date.getTime());
  out.setSeconds(0, 0);
  const minutes = Math.round(out.getMinutes() / interval) * interval;
  if (minutes !== out.getMinutes()) out.setMinutes(minutes);
  return out;
}

/** Local date fields with the time part as an `h12` / `h23` drum would show it. */
function timeFields(date: Date, hourCycle: "h12" | "h23"): PickerValue {
  const hours = date.getHours();
  const fields: PickerValue = { minute: String(date.getMinutes()) };
  if (hourCycle === "h12") {
    fields.hour = String(hours % 12 || 12); // 0 → 12 AM, 12 → 12 PM, 13 → 1 PM
    fields.period = hours < 12 ? "am" : "pm";
  } else {
    fields.hour = String(hours);
  }
  return fields;
}

/**
 * The drum selection that shows `date`:
 * `date` → `{ month, day, year }` · `time` → `{ hour, minute, period? }` ·
 * `dateTime` → `{ day: "yyyy-mm-dd", hour, minute, period? }`
 * (`period` only with `hourCycle="h12"`; numbers are unpadded decimal strings).
 */
export function dateToValue(date: Date, mode: DatePickerMode, hourCycle: "h12" | "h23"): PickerValue {
  switch (mode) {
    case "date":
      return {
        month: String(date.getMonth() + 1),
        day: String(date.getDate()),
        year: String(date.getFullYear()),
      };
    case "time":
      return timeFields(date, hourCycle);
    case "dateTime":
      return { day: toISODate(date), ...timeFields(date, hourCycle) };
  }
}

/**
 * A new `Date` built from a drum selection. Fields the preset has no drum for
 * are copied from `base`; seconds are zeroed; a day past the end of the month
 * (Feb 30) is clamped to the month's last day.
 */
export function valueToDate(
  value: PickerValue,
  base: Date,
  mode: DatePickerMode,
  hourCycle: "h12" | "h23",
): Date {
  let year = base.getFullYear();
  let month = base.getMonth() + 1;
  let day = base.getDate();
  let hours = base.getHours();
  let minutes = base.getMinutes();

  if (mode === "date") {
    year = Number(value.year);
    month = Number(value.month);
    day = Number(value.day);
  } else if (mode === "dateTime") {
    [year, month, day] = fromISODate(value.day);
  }

  if (mode !== "date") {
    minutes = Number(value.minute);
    hours =
      hourCycle === "h12"
        ? (Number(value.hour) % 12) + (value.period === "pm" ? 12 : 0)
        : Number(value.hour);
  }

  day = Math.min(day, daysInMonth(month, year));

  // built in two steps so years below 100 are not mapped to 19xx by the constructor
  const out = new Date(base.getTime());
  out.setFullYear(year, month - 1, day);
  out.setHours(hours, minutes, 0, 0);
  return out;
}

/* ---- option builders ---------------------------------------------------- */

function monthOptions(locale: string): PickerOption[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long" });
  return Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: format.format(new Date(2000, i, 1)),
  }));
}

function numberOptions(from: number, to: number, step = 1, pad = false): PickerOption[] {
  const options: PickerOption[] = [];
  for (let n = from; n <= to; n += step) options.push({ value: String(n), label: pad ? pad2(n) : String(n) });
  return options;
}

/** Locale day-period names via `formatToParts`; falls back to the provider's `am` / `pm`. */
function periodOptions(locale: string, am: string, pm: string): PickerOption[] {
  const name = (hour: number, fallback: string) => {
    try {
      const parts = new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true }).formatToParts(
        new Date(2000, 0, 1, hour),
      );
      return parts.find((part) => part.type === "dayPeriod")?.value ?? fallback;
    } catch {
      return fallback;
    }
  };
  return [
    { value: "am", label: name(9, am) },
    { value: "pm", label: name(21, pm) },
  ];
}

/** `dayRange` days either side of `anchor`, labelled `today` ("Today") or like "Mon Jun 29". */
function rollingDayOptions(
  anchor: Date,
  dayRange: number,
  locale: string,
  todayISO: string,
  today: string,
): PickerOption[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" });
  const options: PickerOption[] = [];
  for (let offset = -dayRange; offset <= dayRange; offset++) {
    const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + offset, 12);
    const iso = toISODate(day);
    options.push({ value: iso, label: iso === todayISO ? today : format.format(day) });
  }
  return options;
}

/* ---- DatePicker --------------------------------------------------------- */

/**
 * `UIDatePicker`: the three date-and-time presets built on `Picker`'s drums —
 * `date` (Month · Day · Year), `time` (Hour · Minute · AM/PM) and `dateTime`
 * (a rolling "Today" / "Mon Jun 29" day drum · Hour · Minute · AM/PM). Works
 * in local time; the day drum shrinks with the selected month and a day that
 * no longer fits (Feb 30) is clamped and reported.
 */
export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  {
    mode = "date",
    value,
    defaultValue,
    onChange,
    minuteInterval = 1,
    hourCycle = "h12",
    yearRange = [1970, 2037],
    dayRange = 365,
    locale: localeProp,
    rows,
    disabled,
    label,
    className,
    ...rest
  },
  ref,
) {
  const strings = useGsStrings();
  const providerLocale = useGsLocale();
  const locale = localeProp ?? providerLocale ?? "en-US";
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<Date>(() =>
    roundToInterval(defaultValue ?? new Date(), minuteInterval),
  );
  const current = isControlled ? value : internal;
  // what the drums show: the time drums only offer multiples of the interval
  const shown = mode === "date" ? current : roundToInterval(current, minuteInterval);
  const selection = dateToValue(shown, mode, hourCycle);

  // the rolling day drum is centred on the initial value; re-centred only if the value leaves it
  const [anchor, setAnchor] = useState<Date>(() => current);
  const anchorOffset = Math.round(
    (new Date(shown.getFullYear(), shown.getMonth(), shown.getDate(), 12).getTime() -
      new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12).getTime()) /
      86_400_000,
  );
  if (mode === "dateTime" && Math.abs(anchorOffset) > dayRange) setAnchor(shown);

  const month = Number(selection.month);
  const year = Number(selection.year);
  const [yearFrom, yearTo] = yearRange;
  const todayISO = toISODate(new Date());

  const months = useMemo(() => monthOptions(locale), [locale]);
  const days = useMemo(
    () => (mode === "date" ? numberOptions(1, daysInMonth(month, year)) : []),
    [mode, month, year],
  );
  const years = useMemo(() => numberOptions(yearFrom, yearTo), [yearFrom, yearTo]);
  const hours = useMemo(
    () => (hourCycle === "h12" ? numberOptions(1, 12) : numberOptions(0, 23)),
    [hourCycle],
  );
  const minutes = useMemo(() => numberOptions(0, 59, minuteInterval, true), [minuteInterval]);
  const periods = useMemo(
    () => periodOptions(locale, strings.am, strings.pm),
    [locale, strings.am, strings.pm],
  );
  const rollingDays = useMemo(
    () =>
      mode === "dateTime" ? rollingDayOptions(anchor, dayRange, locale, todayISO, strings.today) : [],
    [mode, anchor, dayRange, locale, todayISO, strings.today],
  );

  const {
    month: monthLabel,
    day: dayLabel,
    year: yearLabel,
    hour: hourLabel,
    minute: minuteLabel,
    dayPeriod,
  } = strings;
  const columns = useMemo<PickerColumn[]>(() => {
    const h12 = hourCycle === "h12";
    switch (mode) {
      case "date":
        return [
          { key: "month", label: monthLabel, align: "left", width: "46%", options: months },
          { key: "day", label: dayLabel, align: "right", width: "20%", options: days },
          { key: "year", label: yearLabel, width: "34%", options: years },
        ];
      case "time":
        return [
          { key: "hour", label: hourLabel, align: "right", width: h12 ? "34%" : "50%", options: hours },
          { key: "minute", label: minuteLabel, width: h12 ? "33%" : "50%", options: minutes },
          ...(h12 ? [{ key: "period", label: dayPeriod, width: "33%", options: periods }] : []),
        ];
      case "dateTime":
        return [
          { key: "day", label: dayLabel, align: "left", width: h12 ? "44%" : "56%", options: rollingDays },
          { key: "hour", label: hourLabel, align: "right", width: h12 ? "18%" : "22%", options: hours },
          { key: "minute", label: minuteLabel, width: h12 ? "18%" : "22%", options: minutes },
          ...(h12 ? [{ key: "period", label: dayPeriod, width: "20%", options: periods }] : []),
        ];
    }
  }, [
    mode,
    hourCycle,
    months,
    days,
    years,
    hours,
    minutes,
    periods,
    rollingDays,
    monthLabel,
    dayLabel,
    yearLabel,
    hourLabel,
    minuteLabel,
    dayPeriod,
  ]);

  const handleChange = (next: PickerValue) => {
    const date = valueToDate(next, current, mode, hourCycle);
    if (!isControlled) setInternal(date);
    onChange?.(date);
  };

  return (
    <Picker
      ref={ref}
      columns={columns}
      value={selection}
      onChange={handleChange}
      rows={rows}
      disabled={disabled}
      // `GsStrings` names its picker labels after the modes, so the mode indexes it directly
      label={label ?? strings[mode]}
      className={cn("gs-datepicker", `gs-datepicker--${mode.toLowerCase()}`, className)}
      {...rest}
    />
  );
});
