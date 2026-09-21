import { useState } from "react";
import { Image, Mail, Share, Trash2, UserRound } from "lucide-react";
import { ActionSheet, BarButton, Button, Icon, List, ListItem, NavigationBar } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Action Sheet",
  description:
    "The iOS 3 action sheet (UIActionSheet): a translucent black-glass sheet that slides up from the bottom " +
    "with a small gray title and a stack of full-width 46 px gel buttons — light silver glass for normal actions, " +
    "red gel for the destructive one and a dark \"Cancel\" pinned at the bottom, all 1 px black outlined.",
  usage: `<ActionSheet
  open={open}
  title="Share this photo"
  actions={[
    { label: "Email Photo", onClick: email },
    { label: "Delete Photo", variant: "destructive", onClick: remove },
  ]}
  onClose={() => setOpen(false)}
/>`,
  propTypes: ["ActionSheetProps", "ActionSheetAction"],
  props: [
    { name: "open", type: "boolean", note: "renders nothing while false" },
    { name: "title", type: "ReactNode", note: "small gray centered text at the top" },
    {
      name: "actions",
      type: "ActionSheetAction[]",
      note: "{ label, onClick?, variant?: default | destructive, keepOpen?, disabled? }; stacked in order",
    },
    { name: "cancelLabel", type: "string | null", note: 'default "Cancel"; null hides the button' },
    {
      name: "onClose",
      type: "() => void",
      note: "after any action, on Cancel, on Escape, on backdrop click (if enabled)",
    },
    { name: "dismissOnBackdrop", type: "boolean", note: "default true" },
    { name: "contained", type: "boolean", note: "render in place (absolute, inset 0) instead of a body portal" },
  ],
};

type Which = "share" | "delete" | "nocancel" | "disabled";

export default function ActionSheetDemo() {
  const [which, setWhich] = useState<Which | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const close = () => setWhich(null);
  const choose = (label: string) => () => setLast(label);

  return (
    <Screen
      top={
        <NavigationBar
          title="Photo"
          right={<BarButton icon={Share} aria-label="Share" onClick={() => setWhich("share")} />}
        />
      }
    >
      <List header="More sheets">
        <ListItem
          icon={<Icon icon={Image} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Share…"
          subtitle="Title + four actions + Cancel"
          accessory="chevron"
          onClick={() => setWhich("share")}
        />
        <ListItem
          icon={<Icon icon={Trash2} variant="flat" size={18} />}
          iconTile
          iconTint="red"
          title="Delete Photo"
          subtitle="Destructive + Cancel, no title"
          accessory="chevron"
          onClick={() => setWhich("delete")}
        />
        <ListItem
          icon={<Icon icon={Mail} variant="flat" size={18} />}
          iconTile
          title="No Cancel button"
          subtitle="cancelLabel={null}, tap outside to dismiss"
          accessory="chevron"
          onClick={() => setWhich("nocancel")}
        />
        <ListItem
          icon={<Icon icon={UserRound} variant="flat" size={18} />}
          iconTile
          title="Disabled action"
          subtitle="One row greyed out"
          accessory="chevron"
          onClick={() => setWhich("disabled")}
        />
      </List>

      <Button block variant="destructive" icon={Trash2} onClick={() => setWhich("delete")}>
        Delete Photo
      </Button>

      <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
        Last action: {last ?? "—"}
      </p>

      <ActionSheet
        contained
        open={which === "share"}
        title="Share this photo"
        actions={[
          { label: "Email Photo", onClick: choose("Email Photo") },
          { label: "Send to MobileMe", onClick: choose("Send to MobileMe") },
          { label: "Assign to Contact", onClick: choose("Assign to Contact") },
          { label: "Use as Wallpaper", onClick: choose("Use as Wallpaper") },
        ]}
        onClose={close}
      />

      <ActionSheet
        contained
        open={which === "delete"}
        actions={[{ label: "Delete Photo", variant: "destructive", onClick: choose("Delete Photo") }]}
        onClose={close}
      />

      <ActionSheet
        contained
        open={which === "nocancel"}
        title="Tap outside to dismiss"
        cancelLabel={null}
        dismissOnBackdrop
        actions={[
          { label: "Copy", onClick: choose("Copy") },
          { label: "Print", onClick: choose("Print") },
        ]}
        onClose={close}
      />

      <ActionSheet
        contained
        open={which === "disabled"}
        title="Some options are unavailable"
        actions={[
          { label: "Email Photo", onClick: choose("Email Photo") },
          { label: "Send to MobileMe", disabled: true, onClick: choose("Send to MobileMe") },
          { label: "Use as Wallpaper", onClick: choose("Use as Wallpaper") },
        ]}
        onClose={close}
      />
    </Screen>
  );
}
