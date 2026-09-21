import { useEffect, useState } from "react";
import { List, ListItem, NavigationBar, StatusBar, Switch } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Status Bar",
  description:
    "The 20 px strip every screen starts with: five signal bars, the 3G / EDGE / Wi-Fi glyph, the bold clock, Bluetooth and a green gel battery that turns red under 20 %. Presentational — the phone frame on this site uses it.",
  usage: `<StatusBar time="3:53 PM" signal={4} network="3G" battery={80} bluetooth />
<StatusBar network="wifi" carrier="AT&T" battery={15} />
<StatusBar tint="gray" charging />`,
  propTypes: ["StatusBarProps"],
  props: [
    { name: "time", type: "string", note: 'clock text, default "3:53 PM"' },
    { name: "signal", type: "0 | 1 | 2 | 3 | 4 | 5", note: "lit bars" },
    { name: "network", type: '"3G" | "E" | "wifi" | "none"' },
    { name: "carrier", type: "string", note: "carrier name after the bars" },
    { name: "battery", type: "number", note: "0–100; ≤ 20 turns the gel red" },
    { name: "charging", type: "boolean", note: "lightning bolt over the battery" },
    { name: "bluetooth", type: "boolean", note: "default true" },
    { name: "tint", type: '"black" | "gray"', note: "black glass or translucent gray" },
  ],
};

const caption: React.CSSProperties = {
  color: "var(--gs-text-secondary)",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  margin: "0 0 4px",
  textShadow: "var(--gs-text-emboss)",
};

export default function StatusBarDemo() {
  const [battery, setBattery] = useState(64);
  const [charging, setCharging] = useState(false);

  // drain / charge slowly so the battery gel and bolt are seen changing
  useEffect(() => {
    const id = setInterval(
      () => setBattery((b) => (charging ? Math.min(100, b + 4) : b <= 4 ? 100 : b - 4)),
      600,
    );
    return () => clearInterval(id);
  }, [charging]);

  return (
    <Screen top={<NavigationBar title="Status Bar" />}>
      <div>
        <p style={caption}>Live</p>
        <div style={{ borderRadius: 4, overflow: "hidden" }}>
          <StatusBar time="9:41 AM" signal={4} network="3G" battery={battery} charging={charging} />
        </div>
      </div>
      <List>
        <ListItem
          title="Charging"
          accessory={<Switch checked={charging} onChange={setCharging} label="Charging" />}
        />
        <ListItem title="Battery" detail={`${battery} %`} />
      </List>
      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <p style={caption}>Wi-Fi + carrier</p>
          <div style={{ borderRadius: 4, overflow: "hidden" }}>
            <StatusBar time="12:00 PM" signal={2} network="wifi" carrier="AT&T" battery={82} />
          </div>
        </div>
        <div>
          <p style={caption}>EDGE, low battery, no Bluetooth</p>
          <div style={{ borderRadius: 4, overflow: "hidden" }}>
            <StatusBar time="11:58 PM" signal={1} network="E" battery={12} bluetooth={false} />
          </div>
        </div>
        <div>
          <p style={caption}>Gray tint (over photos), no service</p>
          <div style={{ borderRadius: 4, overflow: "hidden", background: "linear-gradient(135deg, #3a5a8a, #8a4a6a)", padding: "0 0 18px" }}>
            <StatusBar tint="gray" time="4:20 PM" signal={0} network="none" battery={55} charging />
          </div>
        </div>
      </div>
    </Screen>
  );
}
