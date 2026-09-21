import type { CSSProperties, ReactNode } from "react";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";
import { BarButton, NavigationBar } from "@3gs/ui";
import { Plus, RefreshCw, Search } from "lucide-react";

export const meta: DemoMeta = {
  title: "Navigation Bar",
  description:
    "The 44 px black-glass top bar (UIBarStyleBlack): hard-split gel gradient, 1 px light rim, bold centred title, and the small 30 px bar buttons — including the pointed back button, whose 1 px outline is drawn with two clipped layers.",
  usage: `<NavigationBar
  title="Categories"
  left={<BarButton variant="back">Featured</BarButton>}
  right={<BarButton variant="done">Done</BarButton>}
/>`,
  propTypes: ["NavigationBarProps", "BarButtonProps"],
  props: [
    { name: "title", type: "ReactNode", note: "bold 20 px, centred over the full width, ellipsis when too long" },
    { name: "left", type: "ReactNode", note: 'usually <BarButton variant="back">' },
    { name: "right", type: "ReactNode", note: 'usually <BarButton variant="done"> or a default BarButton' },
    { name: "tint", type: '"black" | "blue"', note: "black glass (default) or the classic iOS 3 blue-gray bar" },
    { name: "BarButton.variant", type: '"default" | "back" | "done"', note: "dark gel / pointed back arrow / blue gel for the primary action" },
    { name: "BarButton.icon", type: "LucideIcon", note: "flat white 16 px icon before the label (or alone with aria-label)" },
  ],
};

/* small layout helpers only — the bars themselves are the component */
const frame: CSSProperties = {
  borderRadius: 6,
  overflow: "hidden",
  boxShadow: "0 1px 0 rgba(255,255,255,.06)",
};

const captionStyle: CSSProperties = {
  margin: "0 0 4px 10px",
  font: "700 11px/1.2 var(--gs-font)",
  color: "var(--gs-text-secondary)",
  textShadow: "0 -1px 0 rgba(0,0,0,.6)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

function Example({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div>
      <p style={captionStyle}>{caption}</p>
      <div style={frame}>{children}</div>
    </div>
  );
}

export default function NavigationBarDemo() {
  return (
    <Screen
      top={
        <NavigationBar
          title="Categories"
          left={<BarButton variant="back">Featured</BarButton>}
          right={<BarButton variant="done">Done</BarButton>}
        />
      }
    >
      <Example caption="Title only">
        <NavigationBar title="Settings" />
      </Example>

      <Example caption="Back + title + icon button">
        <NavigationBar
          title="Contacts"
          left={<BarButton variant="back">Groups</BarButton>}
          right={<BarButton icon={Plus} aria-label="Add contact" />}
        />
      </Example>

      <Example caption='tint="blue" — the classic bar'>
        <NavigationBar
          tint="blue"
          title="Mail"
          left={<BarButton variant="back">Inbox</BarButton>}
          right={<BarButton variant="done">Done</BarButton>}
        />
      </Example>

      <Example caption="Long title → ellipsis">
        <NavigationBar
          title="An Unreasonably Long Screen Title That Cannot Fit"
          left={<BarButton variant="back">Back</BarButton>}
          right={<BarButton icon={RefreshCw}>Sync</BarButton>}
        />
      </Example>

      <Example caption="Left only / right only">
        <NavigationBar title="Edit" right={<BarButton>Cancel</BarButton>} />
        <NavigationBar title="Photos" left={<BarButton variant="back">Albums</BarButton>} />
      </Example>

      <div>
        <p style={captionStyle}>Bar buttons</p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "2px 0" }}>
          <BarButton>Edit</BarButton>
          <BarButton variant="back">Back</BarButton>
          <BarButton variant="done">Done</BarButton>
          <BarButton icon={Plus}>Add</BarButton>
          <BarButton icon={Search} aria-label="Search" />
          <BarButton className="gs-barbutton--pressed">Pressed</BarButton>
          <BarButton variant="back" className="gs-barbutton--pressed">
            Pressed
          </BarButton>
          <BarButton disabled>Disabled</BarButton>
          <BarButton variant="back" disabled>
            Disabled
          </BarButton>
          <BarButton variant="done" disabled>
            Disabled
          </BarButton>
        </div>
      </div>
    </Screen>
  );
}
