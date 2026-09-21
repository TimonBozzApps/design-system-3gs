import { useState } from "react";
import {
  BarButton,
  DatePicker,
  List,
  ListItem,
  NavigationBar,
  Segment,
  SegmentedControl,
  type DatePickerMode,
} from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Date Picker",
  description:
    "UIDatePicker — the Calendar app's date and time drums built on Picker. Three presets: Month · Day · Year, " +
    "Hour · Minute · AM/PM, and the rolling \"Today / Mon Jun 29\" day drum with a time. The day drum shrinks " +
    "with the month (Feb 30 snaps to Feb 28) and the minutes step by minuteInterval, just like the 3GS.",
  usage: `<DatePicker
  mode="dateTime"
  value={starts}
  onChange={setStarts}
  minuteInterval={5}
/>`,
  propTypes: ["DatePickerProps"],
  props: [
    { name: "mode", type: '"date" | "time" | "dateTime"', note: "which UIDatePicker preset, default date" },
    { name: "value", type: "Date", note: "controlled" },
    { name: "defaultValue", type: "Date", note: "uncontrolled; default now, minutes rounded to the interval" },
    { name: "onChange", type: "(date: Date) => void", note: "a new Date, seconds zeroed, day clamped to the month" },
    { name: "minuteInterval", type: "1 | 5 | 10 | 15 | 30", note: "step of the minute drum, default 1" },
    { name: "hourCycle", type: '"h12" | "h23"', note: "1–12 with an AM/PM drum (default) or 0–23" },
    { name: "yearRange", type: "[number, number]", note: "date mode, default [1970, 2037]" },
    { name: "dayRange", type: "number", note: "dateTime mode: days before/after the initial value, default 365" },
    { name: "locale", type: "string", note: "Intl locale for month, weekday and AM/PM names, default en-US" },
    { name: "rows", type: "3 | 5 | 7", note: "visible rows per drum, default 5" },
    { name: "disabled", type: "boolean" },
    { name: "label", type: "string", note: "aria-label for the picker" },
  ],
};

/* ---- data ---------------------------------------------------------------- */

type Field = "starts" | "ends";

/** "Sep 30, 11:45 PM" — a List row's detail gets at most half the cell, so no year. */
const formatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Today at the next full hour — a plausible "new event" default. */
function nextFullHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export default function DatePickerDemo() {
  const [starts, setStarts] = useState<Date>(nextFullHour);
  const [ends, setEnds] = useState<Date>(() => new Date(nextFullHour().getTime() + 60 * 60 * 1000));
  const [editing, setEditing] = useState<Field>("starts");
  const [mode, setMode] = useState<DatePickerMode>("dateTime");

  const value = editing === "starts" ? starts : ends;
  const setValue = editing === "starts" ? setStarts : setEnds;

  return (
    <Screen
      top={
        <NavigationBar
          title="Add Event"
          left={<BarButton>Cancel</BarButton>}
          right={<BarButton variant="done">Done</BarButton>}
        />
      }
    >
      <List>
        <ListItem
          title="Starts"
          detail={formatter.format(starts)}
          selected={editing === "starts"}
          onClick={() => setEditing("starts")}
        />
        <ListItem
          title="Ends"
          detail={formatter.format(ends)}
          selected={editing === "ends"}
          onClick={() => setEditing("ends")}
        />
      </List>

      <SegmentedControl
        block
        size="sm"
        value={mode}
        onChange={(v) => setMode(v as DatePickerMode)}
        label="Picker mode"
      >
        <Segment value="date">Date</Segment>
        <Segment value="time">Time</Segment>
        <Segment value="dateTime">Date+Time</Segment>
      </SegmentedControl>

      {/* pinned to the bottom and bled through the body padding, like the Calendar app */}
      <div style={{ margin: "auto -10px -20px" }}>
        <DatePicker
          label={editing === "starts" ? "Starts" : "Ends"}
          mode={mode}
          value={value}
          onChange={setValue}
          minuteInterval={5}
        />
      </div>
    </Screen>
  );
}
