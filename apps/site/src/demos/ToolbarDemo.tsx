import { useState, type CSSProperties, type ReactNode } from "react";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";
import {
  BarButton,
  List,
  ListItem,
  NavigationBar,
  Toolbar,
  ToolbarButton,
  ToolbarSpacer,
  ToolbarTitle,
} from "@3gs/ui";
import {
  Book,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Share,
  SquarePen,
  Trash2,
} from "lucide-react";

export const meta: DemoMeta = {
  title: "Toolbar",
  description:
    "The 44 px black-glass bottom bar of Safari and Mail (UIToolbar, UIBarStyleBlack): plain glossy icon buttons with no chrome — the icon itself is the glass — flexible spacers, the centred gray status text, and gel BarButtons whenever an action needs a label.",
  usage: `<Toolbar>
  <ToolbarButton icon={RefreshCw} label="Check mail" />
  <ToolbarSpacer />
  <ToolbarTitle subtitle="Updated 9/21/26 9:41 AM">5 Unread</ToolbarTitle>
  <ToolbarSpacer />
  <ToolbarButton icon={SquarePen} label="Compose" />
</Toolbar>`,
  props: [
    { name: "tint", type: '"black" | "blue"', note: "black glass (default) or the classic iOS 3 blue-gray bar" },
    { name: "position", type: '"bottom" | "top"', note: "where the 1 px black outline goes: top edge (default) or bottom edge like a nav bar" },
    { name: "label", type: "string", note: 'aria-label for the toolbar, default "Toolbar"' },
    { name: "ToolbarButton.icon", type: "LucideIcon", note: "24 px gray glass; blue glass when active" },
    { name: "ToolbarButton.label", type: "string", note: "required aria-label (the button is icon-only), also the native title tooltip" },
    { name: "ToolbarButton.active", type: "boolean", note: "blue glass — current page, bookmarked… pass aria-pressed yourself for real toggles" },
    { name: "ToolbarButton.badge", type: "number | string", note: "red gel count on the icon's top-right corner" },
    { name: "ToolbarTitle.subtitle", type: "ReactNode", note: "small second line; the main line turns white when present" },
    { name: "ToolbarSpacer", type: "—", note: "flexible space; one on each side of an item centres it" },
  ],
};

const mails = [
  { sender: "Apple", subject: "Your receipt from the App Store", time: "9:41 AM" },
  { sender: "Scott Forstall", subject: "Re: The gel, again", time: "8:12 AM" },
  { sender: "Ruth Ellison", subject: "Photos from the weekend", time: "Yesterday" },
  { sender: "MobileMe", subject: "Your calendar has been synced", time: "Yesterday" },
  { sender: "Finn", subject: "LAN evening — bring the cable", time: "Friday" },
];

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

export default function ToolbarDemo() {
  const [bookmarked, setBookmarked] = useState(true);

  return (
    <Screen
      background="black"
      flush
      top={
        <NavigationBar
          title="Inbox (5)"
          left={<BarButton variant="back">Mailboxes</BarButton>}
          right={<BarButton>Edit</BarButton>}
        />
      }
      bottom={
        <Toolbar label="Mail">
          <ToolbarButton icon={RefreshCw} label="Check mail" />
          <ToolbarSpacer />
          <ToolbarTitle subtitle="Updated 9/21/26 9:41 AM">5 Unread</ToolbarTitle>
          <ToolbarSpacer />
          <ToolbarButton icon={SquarePen} label="Compose" />
        </Toolbar>
      }
    >
      <List variant="plain">
        {mails.map((mail) => (
          <ListItem
            key={mail.subject}
            title={mail.sender}
            subtitle={mail.subject}
            detail={mail.time}
            accessory="chevron"
            onClick={() => {}}
          />
        ))}
      </List>

      <div style={{ padding: 10, display: "grid", gap: 12 }}>
        <Example caption="Safari — disabled, active, badge">
          <Toolbar label="Safari">
            <ToolbarButton icon={ChevronLeft} label="Back" disabled />
            <ToolbarSpacer />
            <ToolbarButton icon={ChevronRight} label="Forward" />
            <ToolbarSpacer />
            <ToolbarButton icon={Plus} label="Add bookmark" />
            <ToolbarSpacer />
            <ToolbarButton
              icon={Book}
              label="Bookmarks"
              active={bookmarked}
              aria-pressed={bookmarked}
              onClick={() => setBookmarked((value) => !value)}
            />
            <ToolbarSpacer />
            <ToolbarButton icon={Copy} label="Pages" badge={3} />
          </Toolbar>
        </Example>

        <Example caption="Gel bar buttons">
          <Toolbar label="Edit">
            <BarButton>Edit</BarButton>
            <ToolbarSpacer />
            <BarButton variant="done">Done</BarButton>
          </Toolbar>
        </Example>

        <Example caption="Title only, no spacers">
          <Toolbar label="Status">
            <ToolbarButton icon={RefreshCw} label="Refresh" />
            <ToolbarTitle>Updated 9/21/26 9:41 AM</ToolbarTitle>
            <ToolbarButton icon={Trash2} label="Delete" />
          </Toolbar>
        </Example>

        <Example caption='tint="blue" position="top"'>
          <Toolbar tint="blue" position="top" label="Photos">
            <BarButton variant="back">Albums</BarButton>
            <ToolbarSpacer />
            <ToolbarTitle subtitle="3 of 12">Camera Roll</ToolbarTitle>
            <ToolbarSpacer />
            <ToolbarButton icon={Share} label="Share" />
            <BarButton variant="done">Done</BarButton>
          </Toolbar>
        </Example>
      </div>
    </Screen>
  );
}
