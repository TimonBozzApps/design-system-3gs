import { useState } from "react";
import { AlignLeft, Calendar, Mail, MessageSquare, X } from "lucide-react";
import { Icon, List, ListItem, NavigationBar, NotificationBanner } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Notification Banner",
  description:
    "The push-notification banner: a 60 px translucent black glass strip that drops over the status and nav bar " +
    "with a glossy 29 px app-icon tile, a bold white title, a two-line message, an optional dark gel action button " +
    "and a three-dot grip. Non-modal and auto-dismissing (the timer pauses while hovered, pressed or keyboard-focused); " +
    "tapping the body opens the app, swiping it up slides it away.",
  usage: `<NotificationBanner
  open={shown}
  icon={<Icon icon={MessageSquare} variant="flat" size={18} />}
  iconTint="blue"
  title="Jony Ive"
  message="Can you send the gel spec by tonight?"
  actionLabel="Reply"
  onAction={reply}
  onClick={openMessages}
  onClose={() => setShown(false)}
/>`,
  propTypes: ["NotificationBannerProps"],
  props: [
    { name: "open", type: "boolean", note: "renders nothing while false" },
    { name: "title", type: "ReactNode", note: "bold 14 px white line" },
    { name: "message", type: "ReactNode", note: "13 px line, clamped to two lines" },
    { name: "icon", type: "ReactNode", note: "glyph inside the 29 px tile, e.g. <Icon icon={Mail} variant=\"flat\" size={18} />" },
    { name: "iconTint", type: '"gray" | "blue" | "red" | "green"', note: "tile gel; default gray" },
    { name: "actionLabel / onAction", type: "string / () => void", note: "26 px dark gel bar-button on the end side" },
    { name: "onClick", type: "() => void", note: "tapping the body (not the action) — e.g. open the app" },
    { name: "duration", type: "number", note: "ms until onClose; default 4000; 0 = persistent; paused while hovered / pressed / keyboard-focused" },
    { name: "onClose", type: "() => void", note: "after duration, a swipe up, Escape, or an action / body tap" },
    { name: "dismissOnAction", type: "boolean", note: "default true — an action / body tap also calls onClose" },
    { name: "contained", type: "boolean", note: "absolute at the top of the nearest positioned ancestor instead of fixed in a body portal" },
    { name: "label", type: "string", note: 'aria-label of the status region; default "Notification"' },
  ],
};

type Which = "message" | "calendar" | "mail" | "long";

export default function NotificationBannerDemo() {
  const [which, setWhich] = useState<Which | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const close = (name: string) => () => {
    setWhich(null);
    setLast(`${name} closed`);
  };

  return (
    <Screen top={<NavigationBar title="Home" />}>
      <List header="Show a banner">
        <ListItem
          icon={<Icon icon={MessageSquare} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Message"
          subtitle="Blue tile, Reply action, 4 s"
          accessory="chevron"
          onClick={() => setWhich("message")}
        />
        <ListItem
          icon={<Icon icon={Calendar} variant="flat" size={18} />}
          iconTile
          iconTint="red"
          title="Calendar"
          subtitle="Red tile, no action, 6 s"
          accessory="chevron"
          onClick={() => setWhich("calendar")}
        />
        <ListItem
          icon={<Icon icon={Mail} variant="flat" size={18} />}
          iconTile
          title="Mail"
          subtitle="Persistent (duration 0)"
          accessory="chevron"
          onClick={() => setWhich("mail")}
        />
        <ListItem
          icon={<Icon icon={X} variant="flat" size={18} />}
          iconTile
          title="Dismiss"
          subtitle="Closes the persistent banner"
          disabled={which !== "mail"}
          onClick={close("Mail")}
        />
        <ListItem
          icon={<Icon icon={AlignLeft} variant="flat" size={18} />}
          iconTile
          title="Long message"
          subtitle="Green tile, clamps to two lines"
          accessory="chevron"
          onClick={() => setWhich("long")}
        />
      </List>

      <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
        {last ? `Last: ${last}` : "Tap a row. Swipe the banner up to dismiss it; hover to pause the timer."}
      </p>

      <NotificationBanner
        contained
        open={which === "message"}
        icon={<Icon icon={MessageSquare} variant="flat" size={18} />}
        iconTint="blue"
        title="Jony Ive"
        message="Can you send the gel spec by tonight?"
        actionLabel="Reply"
        onAction={() => setLast("Message → Reply")}
        onClick={() => setLast("Message opened")}
        onClose={close("Message")}
      />

      <NotificationBanner
        contained
        open={which === "calendar"}
        icon={<Icon icon={Calendar} variant="flat" size={18} />}
        iconTint="red"
        title="Design review"
        message="In 15 minutes · Caffè Macs"
        duration={6000}
        onClick={() => setLast("Calendar opened")}
        onClose={close("Calendar")}
      />

      <NotificationBanner
        contained
        open={which === "mail"}
        icon={<Icon icon={Mail} variant="flat" size={18} />}
        iconTint="gray"
        title="Scott Forstall"
        message="Re: Banner spec — looks good, ship it."
        actionLabel="Open"
        duration={0}
        onAction={() => setLast("Mail → Open")}
        onClick={() => setLast("Mail opened")}
        onClose={close("Mail")}
      />

      <NotificationBanner
        contained
        open={which === "long"}
        icon={<Icon icon={AlignLeft} variant="flat" size={18} />}
        iconTint="green"
        title="Messages"
        message={
          "The banner clamps its message to two lines with an ellipsis, so a long text like this one never " +
          "pushes the strip taller than the sixty pixels it is allowed to cover of the screen below it."
        }
        actionLabel="View"
        duration={8000}
        onAction={() => setLast("Long → View")}
        onClick={() => setLast("Long opened")}
        onClose={close("Long")}
      />
    </Screen>
  );
}
