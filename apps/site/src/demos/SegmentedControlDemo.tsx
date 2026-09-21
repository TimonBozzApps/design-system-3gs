import { useState, type CSSProperties, type ReactNode } from "react";
import { LayoutGrid, List as ListIcon, Mail, MailOpen, Map as MapIcon } from "lucide-react";
import { BarButton, List, ListItem, NavigationBar, Segment, SegmentedControl } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Segmented Control",
  description:
    "The iOS 3 segmented control: one rounded gel bar cut into equal segments by 1 px black dividers, the selected segment pressed in as sunken blue-black glass while the rest stay raised gloss — the All / Missed switch from the Phone app's Recents bar.",
  usage: `<SegmentedControl value={range} onChange={setRange} label="Range" block>
  <Segment value="day">Day</Segment>
  <Segment value="week">Week</Segment>
  <Segment value="month">Month</Segment>
</SegmentedControl>`,
  props: [
    { name: "value", type: "string", note: "controlled selected segment" },
    {
      name: "defaultValue",
      type: "string",
      note: "uncontrolled initial segment; falls back to the first one",
    },
    { name: "onChange", type: "(value: string) => void" },
    {
      name: "size",
      type: '"sm" | "md"',
      note: "30 px / 13 px text for bars, or 44 px / 15 px (default)",
    },
    {
      name: "tint",
      type: '"dark" | "blue"',
      note: "dark gel (default) or the blue-gray gel of a blue NavigationBar",
    },
    { name: "block", type: "boolean", note: "stretch to the container width" },
    { name: "label", type: "string", note: 'aria-label for the group, default "Segments"' },
    { name: "Segment.value", type: "string" },
    { name: "Segment.icon", type: "LucideIcon", note: "flat white 16 px icon, before the text or alone" },
    {
      name: "Segment.label",
      type: "string",
      note: "accessible name for an icon-only segment; the visible text when there are no children",
    },
    { name: "Segment.disabled", type: "boolean", note: "skipped by the arrow keys" },
  ],
};

/* small layout helpers only — the controls themselves are the component */
const captionStyle: CSSProperties = {
  margin: "0 0 6px 10px",
  font: "700 11px/1.2 var(--gs-font)",
  color: "var(--gs-text-secondary)",
  textShadow: "0 -1px 0 rgba(0,0,0,.6)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const barFrame: CSSProperties = {
  borderRadius: 6,
  overflow: "hidden",
  boxShadow: "0 1px 0 rgba(255,255,255,.06)",
};

function Example({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div>
      <p style={captionStyle}>{caption}</p>
      {children}
    </div>
  );
}

const USAGE = {
  day: { header: "Today", calls: "12", talk: "48 min" },
  week: { header: "This week", calls: "63", talk: "4 h 12 min" },
  month: { header: "This month", calls: "241", talk: "17 h 30 min" },
} as const;
type Range = keyof typeof USAGE;

export default function SegmentedControlDemo() {
  const [range, setRange] = useState<Range>("week");
  const usage = USAGE[range];

  return (
    <Screen
      top={
        <NavigationBar
          title={
            <SegmentedControl size="sm" defaultValue="all" label="Recents filter">
              <Segment value="all">All</Segment>
              <Segment value="missed">Missed</Segment>
            </SegmentedControl>
          }
          left={<BarButton>Clear</BarButton>}
        />
      }
    >
      <Example caption="Controlled, block">
        <SegmentedControl
          block
          value={range}
          onChange={(next) => setRange(next as Range)}
          label="Range"
        >
          <Segment value="day">Day</Segment>
          <Segment value="week">Week</Segment>
          <Segment value="month">Month</Segment>
        </SegmentedControl>
      </Example>

      <List header={usage.header} footer="The rows follow the selected range.">
        <ListItem title="Calls" detail={usage.calls} />
        <ListItem title="Talk time" detail={usage.talk} />
      </List>

      <Example caption="Icon only — label names each segment">
        <SegmentedControl defaultValue="list" label="View">
          <Segment value="list" icon={ListIcon} label="List" />
          <Segment value="grid" icon={LayoutGrid} label="Grid" />
          <Segment value="map" icon={MapIcon} label="Map" />
        </SegmentedControl>
      </Example>

      <Example caption="Disabled segment">
        <SegmentedControl defaultValue="map" label="Map type">
          <Segment value="map">Map</Segment>
          <Segment value="satellite">Satellite</Segment>
          <Segment value="hybrid" disabled>
            Hybrid
          </Segment>
        </SegmentedControl>
      </Example>

      <Example caption='tint="blue" in a blue bar, icon + text'>
        <div style={barFrame}>
          <NavigationBar
            tint="blue"
            title={
              <SegmentedControl size="sm" tint="blue" defaultValue="all" label="Mail filter">
                <Segment value="all" icon={Mail}>
                  All
                </Segment>
                <Segment value="unread" icon={MailOpen}>
                  Unread
                </Segment>
              </SegmentedControl>
            }
            left={<BarButton variant="back">Inbox</BarButton>}
          />
        </div>
      </Example>
    </Screen>
  );
}
