import { useState, type ReactNode } from "react";
import { Sun, Volume, Volume2 } from "lucide-react";
import { BarButton, List, ListItem, NavigationBar, Slider, Switch } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Slider",
  description:
    "The iOS 3 volume / brightness slider: a thin sunken track filled with blue gel up to a round silver gel " +
    "knob with a black outline, optional flat icons at each end. A native range input underneath, so " +
    "keyboard, touch and forms come for free.",
  usage: `<Slider defaultValue={70} minIcon={Volume} maxIcon={Volume2} label="Ringer volume"
        onChange={(v) => preview(v)} onChangeEnd={(v) => save(v)} />`,
  propTypes: ["SliderProps"],
  props: [
    { name: "value", type: "number", note: "controlled" },
    { name: "defaultValue", type: "number", note: "uncontrolled initial value (default: min)" },
    { name: "onChange", type: "(value: number) => void", note: "fires continuously while dragging" },
    { name: "onChangeEnd", type: "(value: number) => void", note: "fires on pointer / key release" },
    { name: "min / max / step", type: "number", note: "defaults 0 / 100 / 1" },
    { name: "minIcon / maxIcon", type: "LucideIcon", note: "flat gray 16 px / 20 px icons at the track ends" },
    { name: "showValue", type: "boolean", note: "numeric readout right of the track" },
    { name: "disabled", type: "boolean" },
    { name: "label", type: "string", note: "aria-label (required unless aria-labelledby is passed)" },
    { name: "wrapperClassName", type: "string", note: "className goes to the <input>" },
  ],
};

/** A full-width cell holding a slider; the padding keeps the knob's shadow and focus ring clear of the cell's clip. */
function SliderRow({ children }: { children: ReactNode }) {
  return <ListItem title={<div style={{ width: "100%", padding: "4px 0" }}>{children}</div>} accessory="none" />;
}

export default function SliderDemo() {
  const [vibrate, setVibrate] = useState(true);
  const [brightness, setBrightness] = useState(65);
  const [committed, setCommitted] = useState(65);

  return (
    <Screen top={<NavigationBar title="Sounds" left={<BarButton variant="back">Settings</BarButton>} />}>
      <List header="Ringer and Alerts">
        <SliderRow>
          <Slider defaultValue={70} minIcon={Volume} maxIcon={Volume2} label="Ringer volume" />
        </SliderRow>
        <ListItem title="Vibrate" accessory={<Switch checked={vibrate} onChange={setVibrate} label="Vibrate" />} />
      </List>

      <List
        header="Brightness"
        footer={`Live ${brightness} · committed ${committed} — onChange fires while dragging, onChangeEnd on release.`}
      >
        <SliderRow>
          <Slider defaultValue={40} minIcon={Sun} maxIcon={Sun} label="Brightness" />
        </SliderRow>
        <SliderRow>
          <Slider
            value={brightness}
            onChange={setBrightness}
            onChangeEnd={setCommitted}
            showValue
            label="Brightness (controlled)"
          />
        </SliderRow>
      </List>

      <List header="Steps of 10" footer="step={10} — arrow keys move one step, Page Up/Down jump further.">
        <SliderRow>
          <Slider defaultValue={30} step={10} showValue minIcon={Volume} maxIcon={Volume2} label="Alert volume" />
        </SliderRow>
      </List>

      <List header="Disabled">
        <SliderRow>
          <Slider defaultValue={55} disabled minIcon={Volume} maxIcon={Volume2} label="Disabled volume" />
        </SliderRow>
        <SliderRow>
          <Slider defaultValue={55} disabled showValue label="Disabled with value" />
        </SliderRow>
      </List>
    </Screen>
  );
}
