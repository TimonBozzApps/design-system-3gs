import { useState } from "react";
import {
  Clock,
  Download,
  Ellipsis,
  LayoutGrid,
  Mail,
  Music,
  Phone,
  Search,
  Star,
  Trophy,
  User,
} from "lucide-react";
import { TabBar, TabBarItem } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Tab Bar",
  description:
    "The 49 px black-glass bottom bar from the App Store: gray gel icons over 10 px labels, the selected tab in blue glass on a subtly sunken rounded rectangle, and the red gel badge hanging off an icon's corner.",
  usage: `<TabBar value={tab} onChange={setTab} label="App Store">
  <TabBarItem value="featured" icon={Star} label="Featured" />
  <TabBarItem value="updates" icon={Download} label="Updates" badge={43} />
</TabBar>`,
  propTypes: ["TabBarProps", "TabBarItemProps"],
  props: [
    { name: "value", type: "string", note: "controlled selected tab" },
    {
      name: "defaultValue",
      type: "string",
      note: "uncontrolled initial tab; falls back to the first item",
    },
    { name: "onChange", type: "(value: string) => void" },
    { name: "label", type: "string", note: 'aria-label for the tablist, default "Tabs"' },
    { name: "TabBarItem.value", type: "string" },
    { name: "TabBarItem.icon", type: "LucideIcon", note: "gray gel, blue gel when selected" },
    { name: "TabBarItem.label", type: "string" },
    {
      name: "TabBarItem.badge",
      type: "number | string",
      note: "red gel badge; numbers over 99 render 99+",
    },
    { name: "TabBarItem.disabled", type: "boolean" },
  ],
};

const captionStyle = {
  margin: 0,
  fontSize: "var(--gs-font-size-sm)",
  color: "var(--gs-text-secondary)",
  textShadow: "var(--gs-text-emboss)",
} as const;

export default function TabBarDemo() {
  const [tab, setTab] = useState("featured");

  return (
    <Screen
      bottom={
        <TabBar value={tab} onChange={setTab} label="App Store">
          <TabBarItem value="featured" icon={Star} label="Featured" />
          <TabBarItem value="categories" icon={LayoutGrid} label="Categories" />
          <TabBarItem value="top25" icon={Trophy} label="Top 25" />
          <TabBarItem value="search" icon={Search} label="Search" />
          <TabBarItem value="updates" icon={Download} label="Updates" badge={43} />
        </TabBar>
      }
    >
      <p
        style={{
          margin: 0,
          fontWeight: 700,
          color: "var(--gs-text)",
          textShadow: "var(--gs-text-emboss)",
        }}
      >
        Selected: {tab}
      </p>

      <div style={{ display: "grid", gap: 6 }}>
        <p style={captionStyle}>Uncontrolled, 3 tabs (defaultValue)</p>
        <div style={{ borderRadius: 6, overflow: "hidden" }}>
          <TabBar defaultValue="recents" label="Phone">
            <TabBarItem value="favorites" icon={Star} label="Favorites" />
            <TabBarItem value="recents" icon={Clock} label="Recents" />
            <TabBarItem value="contacts" icon={User} label="Contacts" />
          </TabBar>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <p style={captionStyle}>Text badge, 99+ overflow, disabled tab</p>
        <div style={{ borderRadius: 6, overflow: "hidden" }}>
          <TabBar defaultValue="music" label="More">
            <TabBarItem value="music" icon={Music} label="Music" badge="New" />
            <TabBarItem value="mail" icon={Mail} label="Mail" badge={120} />
            <TabBarItem value="phone" icon={Phone} label="Phone" disabled />
            <TabBarItem value="more" icon={Ellipsis} label="More" />
          </TabBar>
        </div>
      </div>
    </Screen>
  );
}
