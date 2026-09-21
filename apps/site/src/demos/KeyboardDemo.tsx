import { useState } from "react";
import { BarButton, Keyboard, NavigationBar, TextField, type KeyboardLayer } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Keyboard",
  description:
    "The 320×216 on-screen keyboard in its dark alert appearance (UIKeyboardAppearanceAlert): gel letter keys, darker function keys, the enlarged popup bubble over a pressed key, shift / caps lock, and the blue return key for Go / Search / Done / Send / Next. Bind it to a value and it types.",
  usage: `<Keyboard value={text} onChange={setText} returnKey="Send" autoCapitalize onReturn={send} />`,
  props: [
    { name: "value", type: "string", note: "high-level binding: the keyboard appends / backspaces this string" },
    { name: "onChange", type: "(value: string) => void", note: "receives the edited string" },
    { name: "onKey", type: "(key: string) => void", note: 'low-level: a character, " " for space, "\\n" for return' },
    { name: "onBackspace", type: "() => void" },
    { name: "onReturn", type: "() => void" },
    {
      name: "returnKey",
      type: '"return" | "Go" | "Search" | "Done" | "Send" | "Next"',
      note: 'label of the return key; anything but "return" renders the blue gel key',
    },
    { name: "layer", type: '"letters" | "numbers" | "symbols"', note: "controlled layer (optional)" },
    { name: "onLayerChange", type: "(layer: KeyboardLayer) => void" },
    { name: "defaultShift", type: "boolean", note: "start with shift on" },
    { name: "autoCapitalize", type: "boolean", note: 'shift auto-enables on an empty value or after ". "' },
    { name: "disabled", type: "boolean" },
    { name: "label", type: "string", note: 'aria-label, default "Keyboard"' },
  ],
};

export default function KeyboardDemo() {
  const [message, setMessage] = useState("");
  const [layer, setLayer] = useState<KeyboardLayer>("letters");
  const [log, setLog] = useState("Log:");

  const send = () => setLog((prev) => `${prev} ✓ sent`);

  return (
    <Screen
      top={
        <NavigationBar
          title="New Message"
          right={
            <BarButton variant="done" onClick={send}>
              Send
            </BarButton>
          }
        />
      }
      bottom={
        <Keyboard
          value={message}
          onChange={setMessage}
          returnKey="Send"
          autoCapitalize
          onLayerChange={setLayer}
          onReturn={send}
        />
      }
    >
      <div style={{ display: "grid", gap: 8 }}>
        <TextField label="To" defaultValue="Jony Ive" readOnly />
        <TextField
          label="Message"
          placeholder="Tap the keys below"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          clearable
        />
      </div>
      <div
        style={{
          padding: "0 10px",
          fontSize: 13,
          color: "var(--gs-text-secondary)",
          textShadow: "var(--gs-text-emboss)",
        }}
      >
        {message.length} {message.length === 1 ? "character" : "characters"} · layer: {layer}
      </div>
      <div
        style={{
          padding: "0 10px",
          fontSize: 13,
          color: "var(--gs-text-secondary)",
          textShadow: "var(--gs-text-emboss)",
        }}
      >
        {log}
      </div>
    </Screen>
  );
}
