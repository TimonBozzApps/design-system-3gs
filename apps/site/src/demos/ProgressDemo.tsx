import { useEffect, useState } from "react";
import { BookOpen, Compass, Download, Gamepad2, Music, Radio } from "lucide-react";
import { ActivityIndicator, Button, Icon, List, ListItem, NavigationBar, ProgressBar } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Progress",
  description:
    "The App Store download bar and UIActivityIndicatorView. A thin sunken pill track holds a blue gel fill with " +
    "its own hard 50 % highlight; the spinner is 12 fading spokes turned in 12 discrete steps per second — " +
    "stepped, not smooth, exactly like the frame-based original.",
  usage: `<ProgressBar value={42} showValue label="Download" />
<ProgressBar />                      {/* indeterminate */}
<ActivityIndicator />                {/* 20 px white */}
<ActivityIndicator size={37} tone="gray" label="Syncing" />`,
  propTypes: ["ProgressBarProps", "ActivityIndicatorProps"],
  props: [
    { name: "value", type: "number", note: "ProgressBar — 0..max; omit for indeterminate" },
    { name: "max", type: "number", note: "ProgressBar — default 100" },
    { name: "size", type: '"sm" | "md"', note: "ProgressBar — 9 / 12 px track" },
    { name: "showValue", type: "boolean", note: 'ProgressBar — "42 %" right of the track' },
    { name: "tint", type: '"blue" | "gray"', note: "ProgressBar — App Store blue / iPod silver gel" },
    { name: "label", type: "string", note: 'aria-label; ActivityIndicator defaults to "Loading"' },
    { name: "ActivityIndicator.size", type: "number", note: "px, 20 (default) or 37 (large)" },
    { name: "ActivityIndicator.tone", type: '"white" | "gray"', note: "spoke colour" },
    { name: "ActivityIndicator.animating", type: "boolean", note: "false renders nothing (hidesWhenStopped)" },
  ],
};

/** 0 → 100 in ~3 s: one tick every 30 ms. */
const TICK_MS = 30;

export default function ProgressDemo() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  // The interval lives with `running`; the cleanup clears it on stop and on unmount.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setProgress((p) => Math.min(100, p + 1)), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && progress >= 100) setRunning(false);
  }, [running, progress]);

  const startDownload = () => {
    setProgress(0);
    setRunning(true);
  };

  const downloaded = !running && progress >= 100;

  return (
    <Screen top={<NavigationBar title="Updates" />}>
      <List header="Updates">
        <ListItem
          icon={<Icon icon={Gamepad2} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Tap Tap Revenge"
          subtitle={<ProgressBar value={62} label="Tap Tap Revenge download" />}
        />
        <ListItem
          icon={<Icon icon={Music} variant="flat" size={18} />}
          iconTile
          iconTint="red"
          title="Shazam"
          subtitle={<ProgressBar value={18} showValue label="Shazam download" />}
        />
        <ListItem
          icon={<Icon icon={Compass} variant="flat" size={18} />}
          iconTile
          iconTint="gray"
          title="Maps"
          subtitle={<ProgressBar value={94} label="Maps download" />}
        />
        <ListItem
          icon={<Icon icon={BookOpen} variant="flat" size={18} />}
          iconTile
          iconTint="gray"
          title="Stanza"
          subtitle="Waiting…"
          accessory={<ActivityIndicator label="Waiting" />}
        />
      </List>

      <List header="States">
        <ListItem title="Queued" subtitle={<ProgressBar value={0} showValue label="Queued" />} />
        <ListItem title="Downloading" subtitle={<ProgressBar value={35} showValue label="Downloading" />} />
        <ListItem title="Installed" subtitle={<ProgressBar value={100} showValue label="Installed" />} />
        <ListItem title="Connecting…" subtitle={<ProgressBar label="Connecting" />} />
        <ListItem title="Medium track" subtitle={<ProgressBar value={58} size="md" label="Medium track" />} />
        <ListItem
          icon={<Icon icon={Music} variant="flat" size={18} />}
          iconTile
          iconTint="gray"
          title="iPod scrubber"
          subtitle={<ProgressBar value={42} tint="gray" label="Now playing" />}
        />
      </List>

      <List header="Activity">
        <ListItem title="White" subtitle="20 px" accessory={<ActivityIndicator />} />
        <ListItem title="Gray" subtitle="20 px" accessory={<ActivityIndicator tone="gray" />} />
        <ListItem title="Large" subtitle="37 px" accessory={<ActivityIndicator size={37} />} />
        <ListItem
          title="Stopped"
          subtitle="animating={false} renders nothing"
          accessory={<ActivityIndicator animating={false} />}
        />
      </List>

      <List header="Download" footer={running ? "Downloading…" : downloaded ? "Installed." : "Tap the button to start."}>
        <ListItem
          icon={<Icon icon={Radio} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Pandora Radio"
          subtitle={<ProgressBar value={progress} showValue label="Pandora Radio download" />}
          accessory={running ? <ActivityIndicator label="Downloading" /> : downloaded ? "checkmark" : "none"}
        />
      </List>
      <Button variant="primary" block icon={Download} onClick={startDownload} disabled={running}>
        {downloaded ? "Download again" : "Simulate download"}
      </Button>
    </Screen>
  );
}
