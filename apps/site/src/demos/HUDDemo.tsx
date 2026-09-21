import { useEffect, useState } from "react";
import { Check, ClipboardCopy, Download, Loader, Lock, Volume2, X } from "lucide-react";
import { Button, HUD, Icon, List, ListItem, NavigationBar } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "HUD / Toast",
  description:
    "The iOS 3 progress HUD: a ~140 px rounded translucent black square (blurred glass, 1 px light rim) with a big " +
    "white spinner, a check mark, a gel progress bar or a custom glyph and a short bold label — the \"Loading…\", " +
    "\"Saved\" and volume overlays. This era's toast: non-modal, never dims the screen, and can auto-dismiss.",
  usage: `<HUD
  open={saved}
  kind="success"
  title="Saved"
  duration={1500}
  onClose={() => setSaved(false)}
/>`,
  propTypes: ["HUDProps"],
  props: [
    { name: "open", type: "boolean", note: "renders nothing while false" },
    {
      name: "kind",
      type: '"loading" | "progress" | "success" | "error" | "text" | "custom"',
      note: "default loading (37 px spinner); text = compact label-only toast; custom = your `icon`",
    },
    { name: "title", type: "ReactNode", note: "bold 16 px white label under the graphic" },
    { name: "message", type: "ReactNode", note: "13 px secondary line" },
    { name: "progress", type: "number", note: "0..100 for kind=progress; omit for an indeterminate bar" },
    { name: "icon", type: "ReactNode", note: "graphic for kind=custom, e.g. <Icon icon={Volume2} variant=\"flat\" size={48} />" },
    { name: "duration", type: "number", note: "ms until onClose; timer restarts when open / title / kind change" },
    { name: "onClose", type: "() => void" },
    { name: "position", type: '"center" | "top" | "bottom"', note: "default center; top / bottom sit 60 px from that edge" },
    { name: "blocking", type: "boolean", note: "default false (clicks pass through); true absorbs clicks + aria-busy" },
    { name: "contained", type: "boolean", note: "render in place (absolute, inset 0) instead of a body portal" },
  ],
};

type Which = "loading" | "progress" | "success" | "error" | "text" | "custom" | "blocking";

export default function HUDDemo() {
  const [which, setWhich] = useState<Which | null>(null);
  const [progress, setProgress] = useState(0);
  const [taps, setTaps] = useState(0);

  const close = () => setWhich(null);

  // Drive the progress HUD 0 → 100; the interval is cleared when the HUD
  // closes or the demo unmounts.
  useEffect(() => {
    if (which !== "progress") return;
    setProgress(0);
    const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 4)), 70);
    return () => window.clearInterval(id);
  }, [which]);
  const done = progress >= 100;

  return (
    <Screen top={<NavigationBar title="Notes" />}>
      <List header="Show a HUD">
        <ListItem
          icon={<Icon icon={Loader} variant="flat" size={18} />}
          iconTile
          title="Loading (2 s)"
          subtitle="Spinner, auto-dismiss"
          accessory="chevron"
          onClick={() => setWhich("loading")}
        />
        <ListItem
          icon={<Icon icon={Download} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Progress"
          subtitle="Gel bar driven 0 → 100"
          accessory="chevron"
          onClick={() => setWhich("progress")}
        />
        <ListItem
          icon={<Icon icon={Check} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Success toast"
          subtitle="Big check, 1.5 s"
          accessory="chevron"
          onClick={() => setWhich("success")}
        />
        <ListItem
          icon={<Icon icon={X} variant="flat" size={18} />}
          iconTile
          iconTint="red"
          title="Error"
          subtitle="role=alert, with message"
          accessory="chevron"
          onClick={() => setWhich("error")}
        />
        <ListItem
          icon={<Icon icon={ClipboardCopy} variant="flat" size={18} />}
          iconTile
          title="Text toast (bottom)"
          subtitle="Compact pill, position=bottom"
          accessory="chevron"
          onClick={() => setWhich("text")}
        />
        <ListItem
          icon={<Icon icon={Volume2} variant="flat" size={18} />}
          iconTile
          title="Custom (volume)"
          subtitle="Your own icon in the slot"
          accessory="chevron"
          onClick={() => setWhich("custom")}
        />
        <ListItem
          icon={<Icon icon={Lock} variant="flat" size={18} />}
          iconTile
          iconTint="red"
          title="Blocking loading"
          subtitle="Absorbs taps for 2.5 s"
          accessory="chevron"
          onClick={() => setWhich("blocking")}
        />
      </List>

      <div style={{ display: "grid", gap: 6 }}>
        <Button block onClick={() => setTaps((t) => t + 1)}>
          Tap me ({taps})
        </Button>
        <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
          Taps land through every HUD except the blocking one.
        </p>
      </div>

      <HUD contained open={which === "loading"} title="Loading…" duration={2000} onClose={close} />

      <HUD
        contained
        open={which === "progress"}
        kind="progress"
        progress={progress}
        title={done ? "Done" : "Downloading…"}
        duration={done ? 600 : undefined}
        onClose={close}
      />

      <HUD contained open={which === "success"} kind="success" title="Saved" duration={1500} onClose={close} />

      <HUD
        contained
        open={which === "error"}
        kind="error"
        title="Failed"
        message="Try again"
        duration={1800}
        onClose={close}
      />

      <HUD
        contained
        open={which === "text"}
        kind="text"
        title="Copied"
        position="bottom"
        duration={1200}
        onClose={close}
      />

      <HUD
        contained
        open={which === "custom"}
        kind="custom"
        icon={<Icon icon={Volume2} variant="flat" size={48} />}
        title="Ringer"
        duration={1500}
        onClose={close}
      />

      <HUD
        contained
        blocking
        open={which === "blocking"}
        title="Please wait…"
        message="Taps are blocked"
        duration={2500}
        onClose={close}
      />
    </Screen>
  );
}
