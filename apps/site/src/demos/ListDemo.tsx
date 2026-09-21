import { useState } from "react";
import {
  Bell,
  Clapperboard,
  Gamepad2,
  Globe,
  Info,
  Lock,
  Mail,
  Music,
  Star,
  Users,
  Wifi,
  Wrench,
} from "lucide-react";
import { Badge, Icon, List, ListItem } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "List",
  description:
    "The grouped table view — the App Store \"Categories\" screen. Rounded 10 px group with a black outline on the " +
    "pinstripe, 44 px cells with a glossy app-icon tile, bold etched title and gray disclosure chevron; tapping floods " +
    "the cell with the blue gel. Plain variant bleeds edge to edge.",
  usage: `<List header="General" footer="Shown on the lock screen.">
  <ListItem icon={<Icon icon={Gamepad2} variant="flat" size={18} />} iconTile iconTint="blue"
            title="Games" accessory="chevron" onClick={() => {}} />
  <ListItem title="Wi-Fi" detail="On" accessory="chevron" href="#" />
  <ListItem title="Mail" accessory={<Badge value={3} />} />
</List>`,
  props: [
    { name: "variant", type: '"grouped" | "plain"', note: "List — rounded container vs. full-bleed rows" },
    { name: "header / footer", type: "ReactNode", note: "List — section title above, gray note below" },
    { name: "title / subtitle", type: "ReactNode", note: "bold 17 px white / 14 px gray, both ellipsise" },
    { name: "icon", type: "ReactNode", note: "29 × 29 slot on the left" },
    { name: "iconTile / iconTint", type: 'boolean / "gray" | "blue" | "red"', note: "glossy app-icon tile" },
    { name: "detail", type: "ReactNode", note: "right-aligned blue value text" },
    { name: "accessory", type: '"chevron" | "checkmark" | "detail" | "none" | ReactNode', note: "or a Switch / Badge" },
    { name: "selected", type: "boolean", note: "persistent blue tapped-row highlight" },
    { name: "disabled", type: "boolean", note: "50 % opacity, no press" },
    { name: "href / onClick", type: "string / MouseEventHandler", note: "renders <a> / <button>; otherwise a listitem" },
  ],
};

const categories = [
  { label: "Games", icon: Gamepad2, tint: "blue" as const },
  { label: "Entertainment", icon: Clapperboard, tint: "red" as const },
  { label: "Utilities", icon: Wrench, tint: "gray" as const },
  { label: "Social Networking", icon: Users, tint: "blue" as const },
  { label: "Music", icon: Music, tint: "red" as const },
];

export default function ListDemo() {
  const [picked, setPicked] = useState<string | null>(null);
  const [wifi, setWifi] = useState(true);
  const [language, setLanguage] = useState<"English" | "Deutsch">("English");

  return (
    <Screen>
      <List header="Categories">
        {categories.map(({ label, icon, tint }) => (
          <ListItem
            key={label}
            icon={<Icon icon={icon} variant="flat" size={18} />}
            iconTile
            iconTint={tint}
            title={label}
            accessory="chevron"
            selected={picked === label}
            onClick={() => setPicked(label)}
          />
        ))}
      </List>

      <List header="General" footer="Tap a row to see the blue gel highlight.">
        <ListItem
          icon={<Icon icon={Wifi} size={22} />}
          title="Wi-Fi"
          detail={wifi ? "On" : "Off"}
          accessory="chevron"
          onClick={() => setWifi((w) => !w)}
        />
        <ListItem
          icon={<Icon icon={Globe} size={22} />}
          title="Language"
          detail={language}
          accessory="chevron"
          onClick={() => setLanguage((l) => (l === "English" ? "Deutsch" : "English"))}
        />
        <ListItem icon={<Icon icon={Mail} size={22} />} title="Mail" accessory={<Badge value={3} />} />
        <ListItem icon={<Icon icon={Star} variant="active" size={22} />} title="Ringtone" detail="Marimba" accessory="checkmark" />
        <ListItem icon={<Icon icon={Bell} size={22} />} title="Notifications" accessory="detail" selected onClick={() => {}} />
        <ListItem
          icon={<Icon icon={Lock} size={22} />}
          title="Passcode Lock"
          subtitle="Requires the passcode after 1 minute of a very long explanatory subtitle"
          detail="Off"
          accessory="chevron"
          disabled
          onClick={() => {}}
        />
        <ListItem
          icon={<Icon icon={Info} size={22} />}
          title="About this iPhone and its ridiculously long title"
          subtitle="Version 3.1.3 (7E18)"
          accessory="chevron"
          href="#about"
        />
      </List>

      <List variant="plain" header="Plain">
        <ListItem title="Inbox" detail="12" accessory="chevron" onClick={() => {}} />
        <ListItem title="Drafts" accessory="chevron" onClick={() => {}} />
        <ListItem title="Sent" />
      </List>
    </Screen>
  );
}
