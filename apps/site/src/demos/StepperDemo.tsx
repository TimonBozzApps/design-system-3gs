import { useState } from "react";
import { BarButton, List, ListItem, NavigationBar, Stepper } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Stepper",
  description:
    "The iOS 3 stepper: a joined − | + pair of raised gel segments cut by a 1 px black divider — a two-segment " +
    "SegmentedControl that counts — with an optional sunken value well beside it. At a bound the glyph dims; " +
    "hold a button and it repeats, speeding up after two seconds.",
  usage: `<Stepper value={qty} onChange={setQty} min={0} max={9} label="Espresso quantity" />
<Stepper defaultValue={50} step={10} showValue formatValue={(v) => v + " %"} label="Brightness" />`,
  propTypes: ["StepperProps"],
  props: [
    { name: "value", type: "number", note: "controlled" },
    { name: "defaultValue", type: "number", note: "uncontrolled initial value (default: min)" },
    { name: "onChange", type: "(value: number) => void" },
    { name: "min / max / step", type: "number", note: "defaults 0 / 100 / 1; rounded to the step's precision" },
    { name: "wraps", type: "boolean", note: "wrap around at the bounds instead of disabling the button" },
    {
      name: "autoRepeat",
      type: "boolean",
      note: "hold to repeat: 500 ms delay, every 100 ms, every 50 ms after 2 s (default true)",
    },
    { name: "showValue", type: "boolean", note: "sunken value well on the inline-start side" },
    { name: "formatValue", type: "(value: number) => string" },
    { name: "size", type: '"sm" | "md"', note: "30 px (default, fits a 44 px row) or 44 px" },
    {
      name: "tint",
      type: '"dark" | "blue"',
      note: "the bar-button gel of the theme (default) or the blue-gray gel of a blue NavigationBar",
    },
    { name: "disabled", type: "boolean" },
    { name: "label", type: "string", note: "aria-label for the group" },
    { name: "decrementLabel / incrementLabel", type: "string", note: 'button aria-labels, default "Decrease" / "Increase"' },
  ],
};

export default function StepperDemo() {
  const [espresso, setEspresso] = useState(2);
  const [croissant, setCroissant] = useState(1);
  const [brightness, setBrightness] = useState(50);
  const [repeat, setRepeat] = useState(1);

  return (
    <Screen top={<NavigationBar title="Order" left={<BarButton variant="back">Menu</BarButton>} />}>
      <List header="Cart">
        <ListItem
          title="Espresso"
          detail={espresso}
          accessory={
            <Stepper value={espresso} onChange={setEspresso} min={0} max={9} label="Espresso quantity" />
          }
        />
        <ListItem
          title="Croissant"
          detail={croissant}
          accessory={
            <Stepper value={croissant} onChange={setCroissant} min={0} max={9} label="Croissant quantity" />
          }
        />
      </List>

      <List header="Settings" footer="Hold a button to repeat.">
        <ListItem
          title="Brightness"
          accessory={
            <Stepper
              value={brightness}
              onChange={setBrightness}
              step={10}
              showValue
              formatValue={(v) => v + " %"}
              label="Brightness"
            />
          }
        />
        <ListItem
          title="Repeat"
          accessory={
            <Stepper value={repeat} onChange={setRepeat} min={1} max={5} wraps showValue label="Repeat" />
          }
        />
        <ListItem
          title="Blue tint"
          accessory={<Stepper defaultValue={3} max={9} tint="blue" showValue label="Blue tint" />}
        />
        <ListItem
          title="Medium"
          accessory={<Stepper defaultValue={1} max={9} size="md" showValue label="Medium size" />}
        />
        <ListItem
          title="Disabled"
          accessory={<Stepper defaultValue={4} max={9} disabled showValue label="Disabled" />}
        />
      </List>
    </Screen>
  );
}
