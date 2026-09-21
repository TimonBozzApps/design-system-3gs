import { useState, type CSSProperties } from "react";
import { List, ListItem, NavigationBar, Picker, Switch, type PickerColumn, type PickerValue } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Picker",
  description:
    "The spinning wheel (UIPickerView) from Settings → Date & Time: one drum per column inside black chrome, " +
    "44 px rows shaded into darkness toward the top and bottom edges to fake a cylinder, and a translucent " +
    "blue-glass bar across the middle row. Flick a drum and it snaps to a row; tap a row to select it.",
  usage: `<Picker
  label="Date"
  columns={[
    { key: "month", align: "left", width: "45%", options: months },
    { key: "day", align: "right", width: "20%", options: days },
    { key: "year", width: "35%", options: years },
  ]}
  value={date}
  onChange={setDate}
/>`,
  propTypes: ["PickerProps", "PickerColumn", "PickerOption"],
  props: [
    {
      name: "columns",
      type: "PickerColumn[]",
      note: "{ key, options: { value, label, disabled? }[], label?, width?, align? } — one drum each",
    },
    { name: "value", type: "PickerValue", note: "controlled — { [column.key]: option.value }" },
    { name: "defaultValue", type: "PickerValue", note: "uncontrolled; missing keys start on the first option" },
    { name: "onChange", type: "(value, changed: { key, value }) => void" },
    { name: "rows", type: "3 | 5 | 7", note: "visible rows per drum (44 px each), default 5" },
    { name: "label", type: "string", note: "aria-label for the picker; column.label names each drum" },
    { name: "disabled", type: "boolean", note: "drums lose focus and pointer, text dims" },
  ],
};

/* ---- data ---------------------------------------------------------------- */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dateColumns: PickerColumn[] = [
  {
    key: "month",
    label: "Month",
    align: "left",
    width: "45%",
    options: MONTHS.map((name, i) => ({ value: String(i + 1), label: name })),
  },
  {
    key: "day",
    label: "Day",
    align: "right",
    width: "20%",
    options: Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  },
  {
    key: "year",
    label: "Year",
    width: "35%",
    options: Array.from({ length: 6 }, (_, i) => ({ value: String(2007 + i), label: String(2007 + i) })),
  },
];

const RINGTONES = [
  "Marimba", "Alarm", "Ascending", "Bark", "Bell Tower", "Blues", "Boing", "Crickets",
  "Digital", "Doorbell", "Duck", "Harp", "Motorcycle", "Old Phone", "Piano Riff", "Pinball",
  "Robot", "Sci-Fi", "Sonar", "Strum", "Timba", "Time Passing", "Trill", "Xylophone",
];

const ringtoneColumns: PickerColumn[] = [
  {
    key: "ringtone",
    label: "Ringtone",
    options: RINGTONES.map((name) => ({
      value: name.toLowerCase().replace(/\W+/g, "-"),
      label: name,
      disabled: name === "Motorcycle", // one that isn't on this phone
    })),
  },
];

const formatDate = (v: PickerValue) => `${MONTHS[Number(v.month) - 1].slice(0, 3)} ${v.day}, ${v.year}`;

const ringtoneLabel = (value: string) =>
  ringtoneColumns[0].options.find((o) => o.value === value)?.label ?? value;

/* ---- layout helpers ------------------------------------------------------ */

const padded: CSSProperties = { padding: "10px 10px 0" };

const caption: CSSProperties = {
  padding: "14px 10px 6px",
  fontSize: "var(--gs-font-size-md)",
  fontWeight: 700,
  color: "var(--gs-text-secondary)",
  textShadow: "var(--gs-text-emboss)",
};

export default function PickerDemo() {
  const [auto, setAuto] = useState(false);
  const [date, setDate] = useState<PickerValue>({ month: "6", day: "19", year: "2009" }); // 3GS launch day
  const [ringtone, setRingtone] = useState("marimba");

  return (
    <Screen top={<NavigationBar title="Date & Time" />} flush>
      <div style={padded}>
        <List footer={auto ? "Date is set by the network — picker disabled." : undefined}>
          <ListItem
            title="Set Automatically"
            accessory={<Switch checked={auto} onChange={setAuto} label="Set Automatically" />}
          />
          <ListItem title="Date" detail={formatDate(date)} />
        </List>
      </div>

      <div style={caption}>Ringtone · {ringtoneLabel(ringtone)}</div>
      <Picker
        label="Ringtone"
        rows={3}
        columns={ringtoneColumns}
        defaultValue={{ ringtone: "marimba" }}
        onChange={(v) => setRingtone(v.ringtone)}
      />

      <div style={{ marginTop: "auto", paddingTop: 14 }}>
        <Picker label="Date" columns={dateColumns} value={date} onChange={setDate} disabled={auto} />
      </div>
    </Screen>
  );
}
