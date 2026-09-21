import { useState, type ReactNode } from "react";
import { Lock, Mail, User } from "lucide-react";
import { SearchField, TextField } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Text Field",
  description:
    "Sunken text wells — iOS 3 pressed inputs into the surface instead of raising them: dark well, inset shadow, hairline edge, bold inline label. SearchField is the shorter pill search bar with the gel Cancel button.",
  usage: `<TextField label="Name" placeholder="required" />
<SearchField value={q} onChange={(e) => setQ(e.target.value)} showCancel onCancel={() => setQ("")} />`,
  props: [
    { name: "label", type: "ReactNode", note: "bold inline label on the left (\"Name | value\")" },
    { name: "helper", type: "ReactNode", note: "secondary text under the field" },
    { name: "error", type: "ReactNode", note: "red rim + message, sets aria-invalid" },
    { name: "clearable", type: "boolean", note: "gray ⓧ while there is a value; fires onChange('') + onClear" },
    { name: "onClear", type: "() => void" },
    { name: "leadingIcon", type: "LucideIcon", note: "flat gray icon on the left" },
    { name: "size", type: '"md" | "lg"', note: "44 px / 50 px tall" },
    { name: "wrapperClassName", type: "string", note: "className goes to the <input>" },
    { name: "showCancel", type: "boolean", note: "SearchField: gel Cancel button on the right" },
    { name: "cancelLabel", type: "string", note: 'SearchField, default "Cancel"' },
    { name: "onCancel", type: "() => void", note: "SearchField" },
  ],
};

/** iOS grouped-table section caption. */
function Caption({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "0 10px",
        fontSize: 13,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        color: "var(--gs-text-secondary)",
        textShadow: "var(--gs-text-emboss)",
      }}
    >
      {children}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <Caption>{title}</Caption>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

export default function TextFieldDemo() {
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("steve@apple.com");

  return (
    <Screen>
      <SearchField
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        showCancel
        onCancel={() => setQuery("")}
        aria-label="Search"
      />

      <Group title="Form">
        <TextField label="Name" placeholder="required" autoComplete="name" />
        <TextField label="Email" type="email" placeholder="you@example.com" autoComplete="email" />
        <TextField label="Password" type="password" placeholder="required" autoComplete="current-password" />
      </Group>

      <Group title="Icon + clearable (controlled)">
        <TextField
          leadingIcon={Mail}
          clearable
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          aria-label="Email"
        />
        <TextField
          leadingIcon={User}
          clearable
          defaultValue="uncontrolled"
          placeholder="Username"
          aria-label="Username"
        />
      </Group>

      <Group title="Helper / error">
        <TextField
          label="Nickname"
          placeholder="optional"
          helper="Shown to other players. Max 12 characters."
        />
        <TextField
          label="Card"
          defaultValue="4111 1111"
          inputMode="numeric"
          error="Card number is incomplete."
        />
      </Group>

      <Group title="Disabled">
        <TextField label="Region" defaultValue="Cupertino, CA" disabled />
        <TextField leadingIcon={Lock} placeholder="Locked" disabled aria-label="Locked" />
      </Group>

      <Group title='size="lg"'>
        <TextField size="lg" label="Title" placeholder="A taller field" />
      </Group>
    </Screen>
  );
}
