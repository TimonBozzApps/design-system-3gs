import { useState } from "react";
import { Inbox, LogOut, PanelTop, Settings, SquarePen } from "lucide-react";
import {
  Badge,
  BarButton,
  Button,
  Icon,
  List,
  ListItem,
  ModalSheet,
  NavigationBar,
  Switch,
  TextField,
} from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Modal Sheet",
  description:
    "The iOS 3 modally presented screen (UIModalTransitionStyleCoverVertical): a full-size panel that slides " +
    "up from the bottom over the current screen with its own black-glass navigation bar — Cancel / title / blue " +
    "Done — and a scrolling body on the pinstripe. Compose, Add Event, Settings forms.",
  usage: `<ModalSheet
  open={open}
  title="New Message"
  onClose={() => setOpen(false)}
>
  <TextField label="To" placeholder="name@example.com" />
  <TextField label="Subject" />
</ModalSheet>`,
  propTypes: ["ModalSheetProps"],
  props: [
    { name: "open", type: "boolean", note: "renders nothing while false; slides up on open" },
    { name: "onClose", type: "() => void", note: "Escape and the default Cancel / Done buttons" },
    { name: "title", type: "ReactNode", note: "NavigationBar title; a string also names the dialog" },
    { name: "left", type: "ReactNode", note: 'default <BarButton>Cancel</BarButton>; null hides it' },
    { name: "right", type: "ReactNode", note: 'default <BarButton variant="done">Done</BarButton>; null hides it' },
    { name: "tint", type: '"black" | "blue"', note: "forwarded to the NavigationBar" },
    { name: "background", type: '"pinstripe" | "black" | "surface"', note: "body background, default pinstripe" },
    { name: "bodyClassName", type: "string", note: "className goes to the panel; this one to the body" },
    { name: "contained", type: "boolean", note: "render in place (absolute, inset 0) instead of a body portal" },
    { name: "label", type: "string", note: "aria-label when title isn't a string" },
  ],
};

type Which = "compose" | "settings" | "custom";

const textareaStyle = {
  minHeight: 120,
  padding: 10,
  resize: "none",
  font: "inherit",
  color: "var(--gs-text)",
  background: "var(--gs-surface-sunken)",
  border: "var(--gs-border)",
  borderRadius: "var(--gs-radius-md)",
  boxShadow: "var(--gs-inset)",
  outline: "none",
} as const;

export default function ModalSheetDemo() {
  const [which, setWhich] = useState<Which | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [push, setPush] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [preview, setPreview] = useState(false);
  const [signature, setSignature] = useState("Sent from my iPhone");

  const close = (what: string) => () => {
    setLast(what);
    setWhich(null);
  };

  return (
    <Screen
      top={
        <NavigationBar
          title="Mail"
          right={<BarButton icon={SquarePen} aria-label="Compose" onClick={() => setWhich("compose")} />}
        />
      }
    >
      <List header="Mailboxes">
        <ListItem
          icon={<Icon icon={Inbox} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Inbox"
          subtitle="Tap ✎ above to compose"
          accessory={<Badge value={3} />}
          onClick={() => setWhich("compose")}
        />
      </List>

      <List header="More sheets">
        <ListItem
          icon={<Icon icon={Settings} variant="flat" size={18} />}
          iconTile
          title="Settings"
          subtitle="Switch rows + destructive button"
          accessory="chevron"
          onClick={() => setWhich("settings")}
        />
        <ListItem
          icon={<Icon icon={PanelTop} variant="flat" size={18} />}
          iconTile
          title="Custom bar"
          subtitle='left={null}, "Save", background="black"'
          accessory="chevron"
          onClick={() => setWhich("custom")}
        />
      </List>

      <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
        Last: {last ?? "—"}
      </p>

      {/* Compose: default Cancel + Done, first field focused on open */}
      <ModalSheet
        contained
        open={which === "compose"}
        title="New Message"
        onClose={close("Compose closed")}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <TextField
            label="To"
            type="email"
            placeholder="name@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            clearable
            onClear={() => setTo("")}
          />
          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            clearable
            onClear={() => setSubject("")}
          />
          <textarea
            aria-label="Message"
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={textareaStyle}
          />
        </div>
        <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
          Esc, Cancel or Done close the sheet. Tab cycles inside it.
        </p>
      </ModalSheet>

      {/* Settings: switch rows, a destructive button that closes */}
      <ModalSheet
        contained
        open={which === "settings"}
        title="Settings"
        onClose={close("Settings closed")}
      >
        <List header="Notifications">
          <ListItem
            title="Push"
            accessory={<Switch checked={push} onChange={setPush} label="Push" />}
          />
          <ListItem
            title="Sounds"
            accessory={<Switch checked={sounds} onChange={setSounds} label="Sounds" />}
          />
          <ListItem
            title="Preview"
            accessory={<Switch checked={preview} onChange={setPreview} label="Preview" />}
          />
        </List>
        <List header="Account">
          <ListItem title="Address" detail="steve@apple.com" />
          <ListItem
            title="Signature"
            detail={signature || "None"}
            accessory="chevron"
            onClick={() => setWhich("custom")}
          />
        </List>
        <Button block variant="destructive" icon={LogOut} onClick={close("Signed out")}>
          Sign Out
        </Button>
      </ModalSheet>

      {/* Custom bar: no Cancel, a "Save" done button, plain black body */}
      <ModalSheet
        contained
        open={which === "custom"}
        title="Signature"
        left={null}
        right={
          <BarButton variant="done" onClick={close("Saved")}>
            Save
          </BarButton>
        }
        background="black"
        onClose={close("Custom closed")}
      >
        <TextField
          label="Text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          clearable
          onClear={() => setSignature("")}
        />
        <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0 }}>
          The bar has no Cancel button — Save (or Esc) is the only way out.
        </p>
      </ModalSheet>
    </Screen>
  );
}
