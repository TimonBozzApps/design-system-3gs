import { useState } from "react";
import { Alert, Button } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Alert",
  description:
    "The iOS 3 modal alert (UIAlertView): a deep-blue glass dialog with a thick translucent white border, " +
    "an elliptical top gloss, bold centered white text and 43 px gel buttons — two side by side, three or more stacked. " +
    "Pops in with a slight overshoot; the \"OK\" button is the light glass one.",
  usage: `<Alert
  open={open}
  title="Delete Contact?"
  message="This cannot be undone."
  actions={[
    { label: "Cancel" },
    { label: "Delete", variant: "destructive", onClick: remove },
  ]}
  onClose={() => setOpen(false)}
/>`,
  propTypes: ["AlertProps", "AlertAction"],
  props: [
    { name: "open", type: "boolean", note: "renders nothing while false" },
    { name: "title", type: "ReactNode" },
    { name: "message", type: "ReactNode" },
    {
      name: "actions",
      type: "AlertAction[]",
      note: "{ label, onClick?, variant?: default | primary | destructive, keepOpen? }; 2 → side by side, else stacked",
    },
    { name: "onClose", type: "() => void", note: "after an action, on Escape, on backdrop click (if enabled)" },
    { name: "dismissOnBackdrop", type: "boolean", note: "default false — iOS alerts were modal" },
    { name: "contained", type: "boolean", note: "render in place (absolute, inset 0) instead of a body portal" },
  ],
};

type Which = "ok" | "two" | "three" | "classic";



function Trigger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button block onClick={onClick}>
      {label}
    </Button>
  );
}

export default function AlertDemo() {
  const [which, setWhich] = useState<Which | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const close = () => setWhich(null);
  const choose = (label: string) => () => setLast(label);

  return (
    <Screen>
      <div style={{ display: "grid", gap: 8 }}>
        <Trigger label="Show alert (OK)" onClick={() => setWhich("ok")} />
        <Trigger label="Two actions (Cancel / Delete)" onClick={() => setWhich("two")} />
        <Trigger label="Three actions (stacked)" onClick={() => setWhich("three")} />
        <Trigger label="Classic: Cannot connect" onClick={() => setWhich("classic")} />
      </div>

      <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0 }}>
        Last action: {last ?? "—"}
      </p>

      <Alert
        contained
        open={which === "ok"}
        title="20% of battery remaining"
        actions={[{ label: "OK", variant: "primary", onClick: choose("OK") }]}
        onClose={close}
      />

      <Alert
        contained
        open={which === "two"}
        title="Delete Contact?"
        message="This cannot be undone."
        actions={[
          { label: "Cancel", onClick: choose("Cancel") },
          { label: "Delete", variant: "destructive", onClick: choose("Delete") },
        ]}
        onClose={close}
      />

      <Alert
        contained
        open={which === "three"}
        title="Save Changes?"
        message="You have unsaved changes to this note."
        actions={[
          { label: "Save", variant: "primary", onClick: choose("Save") },
          { label: "Don't Save", onClick: choose("Don't Save") },
          { label: "Cancel", onClick: choose("Cancel") },
        ]}
        onClose={close}
      />

      <Alert
        contained
        open={which === "classic"}
        title="Could not activate cellular data network"
        message="You are not subscribed to a cellular data service."
        actions={[{ label: "OK", variant: "primary", onClick: choose("OK") }]}
        onClose={close}
      />
    </Screen>
  );
}
