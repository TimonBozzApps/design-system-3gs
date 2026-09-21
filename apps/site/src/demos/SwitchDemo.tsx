import { useState, type ReactNode } from "react";
import { Switch } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Switch",
  description:
    "The iOS 3 ON/OFF slider: a 94×27 gel pill whose blue/dark two-tone strip slides under a silver gel knob.",
  usage: `<Switch defaultChecked label="Wi-Fi" onChange={(on) => setWifi(on)} />`,
  props: [
    { name: "checked", type: "boolean", note: "controlled" },
    { name: "defaultChecked", type: "boolean", note: "uncontrolled initial state" },
    { name: "onChange", type: "(checked: boolean) => void" },
    { name: "disabled", type: "boolean" },
    { name: "onLabel", type: "string", note: 'default "ON"' },
    { name: "offLabel", type: "string", note: 'default "OFF"' },
    { name: "label", type: "string", note: "aria-label when there is no visible label" },
    { name: "name", type: "string", note: "renders a hidden checkbox for forms" },
  ],
};

/** Stand-in for a grouped-list row (List isn't a dependency of this demo). */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        minHeight: 44,
        background: "var(--gs-surface)",
        border: "var(--gs-border)",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          color: "var(--gs-text)",
          textShadow: "var(--gs-text-emboss)",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export default function SwitchDemo() {
  const [wifi, setWifi] = useState(true);

  return (
    <Screen>
      <Row label="Uncontrolled">
        <Switch label="Uncontrolled" />
      </Row>
      <Row label={`Controlled: ${wifi ? "on" : "off"}`}>
        <Switch checked={wifi} onChange={setWifi} label="Controlled" />
      </Row>
      <Row label="Default on">
        <Switch defaultChecked label="Default on" />
      </Row>
      <Row label="Disabled off">
        <Switch disabled label="Disabled off" />
      </Row>
      <Row label="Disabled on">
        <Switch disabled defaultChecked label="Disabled on" />
      </Row>
      <Row label="Custom labels">
        <Switch onLabel="I" offLabel="O" label="Custom labels" />
      </Row>
    </Screen>
  );
}
