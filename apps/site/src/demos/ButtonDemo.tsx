import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Button",
  description:
    "Gel push buttons in the three iOS 3 tints — dark, blue (\"Done\") and red (\"Delete Contact\"). " +
    "Vertical gradient with the hard 50 % highlight, black outline, light inner rim; pressing drops the gloss and sinks the gel.",
  usage: `<Button variant="primary" icon={Check}>Done</Button>`,
  props: [
    { name: "variant", type: '"default" | "primary" | "destructive"', note: "dark / blue / red gel" },
    { name: "size", type: '"sm" | "md" | "lg"', note: "30 / 44 / 50 px tall" },
    { name: "block", type: "boolean", note: "full width, grouped-table style" },
    { name: "icon", type: "LucideIcon", note: "rendered flat in white" },
    { name: "iconPosition", type: '"leading" | "trailing"' },
    { name: "disabled", type: "boolean", note: "native; 50 % opacity, no press" },
  ],
};

const labelStyle: CSSProperties = {
  color: "var(--gs-text-secondary)",
  fontSize: 13,
  margin: "0 0 4px",
};

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p style={labelStyle}>{label}</p>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>{children}</div>;
}

export default function ButtonDemo() {
  return (
    <Screen>
      <Group label="Variants">
        <Row>
          <Button>Cancel</Button>
          <Button variant="primary">Done</Button>
          <Button variant="destructive">Delete</Button>
        </Row>
      </Group>

      <Group label="Sizes">
        <Row>
          <Button size="sm">Edit</Button>
          <Button size="md">Edit</Button>
          <Button size="lg">Edit</Button>
        </Row>
      </Group>

      <Group label="With icon">
        <Row>
          <Button variant="primary" icon={Check}>
            Save
          </Button>
          <Button variant="destructive" icon={Trash2}>
            Delete
          </Button>
          <Button icon={ChevronRight} iconPosition="trailing">
            Next
          </Button>
          <Button size="sm" icon={Check}>
            OK
          </Button>
        </Row>
      </Group>

      <Group label="Pressed look">
        <Row>
          <Button data-pressed="">Cancel</Button>
          <Button variant="primary" data-pressed="">
            Done
          </Button>
          <Button variant="destructive" data-pressed="">
            Delete
          </Button>
        </Row>
      </Group>

      <Group label="Block (grouped screen)">
        <Button block>Sign Out</Button>
        <Button block variant="destructive" icon={Trash2}>
          Delete Contact
        </Button>
      </Group>

      <Group label="Disabled">
        <Row>
          <Button disabled>Cancel</Button>
          <Button variant="primary" disabled>
            Done
          </Button>
          <Button variant="destructive" disabled icon={Trash2}>
            Delete
          </Button>
        </Row>
      </Group>
    </Screen>
  );
}
