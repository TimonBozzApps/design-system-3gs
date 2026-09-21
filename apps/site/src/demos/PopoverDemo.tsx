import { useRef, useState } from "react";
import { Book, BookmarkPlus, Clock, Copy, Folder, Globe, Mail, Printer, Share, Type } from "lucide-react";
import { BarButton, Button, Icon, List, ListItem, NavigationBar, Popover, Switch } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Popover",
  description:
    "The iOS 3.2 popover (UIPopoverController), the era's dropdown and menu: a dark navy-black bubble with a " +
    "thick translucent rim and a triangular arrow pointing at its anchor. It sits on the preferred side, flips " +
    "when there is no room and stays inside the screen — the arrow keeps pointing at the anchor after clamping.",
  usage: `const ref = useRef<HTMLButtonElement>(null);

<BarButton ref={ref} icon={Book} aria-label="Bookmarks" onClick={() => setOpen(true)} />
<Popover open={open} anchor={ref.current} placement="bottom" label="Bookmarks" onClose={() => setOpen(false)}>
  <List>
    <ListItem title="History" accessory="chevron" onClick={pick} />
  </List>
</Popover>`,
  props: [
    { name: "open", type: "boolean", note: "renders nothing while false" },
    {
      name: "anchor",
      type: "HTMLElement | null",
      note: "the element the arrow points at (pass ref.current); re-measured on open, resize and scroll",
    },
    { name: "placement", type: '"top" | "bottom" | "left" | "right"', note: 'default "bottom"; flips when there is no room' },
    { name: "width", type: "number | string", note: "panel width, default 240 (the 8 px rim sits outside it)" },
    { name: "onClose", type: "() => void", note: "on Escape and on an outside click / tap" },
    { name: "dismissOnOutside", type: "boolean", note: "default true; false lets clicks through to the page" },
    { name: "label", type: "string", note: 'aria-label for the role="dialog" panel when there is no heading inside' },
    { name: "contained", type: "boolean", note: "render in place (absolute, inside the nearest positioned ancestor) instead of a body portal" },
    { name: "children", type: "ReactNode", note: "arbitrary content — a grouped List fills the bubble edge to edge" },
  ],
};

type Which = "bookmarks" | "text" | "share";

export default function PopoverDemo() {
  const [which, setWhich] = useState<Which | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [largeText, setLargeText] = useState(false);
  const [boldText, setBoldText] = useState(true);

  const bookmarksRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);

  const close = () => setWhich(null);
  const pick = (name: string) => () => {
    setLast(name);
    close();
  };

  return (
    <Screen
      top={
        <NavigationBar
          title="Safari"
          right={
            <BarButton
              ref={bookmarksRef}
              icon={Book}
              aria-label="Bookmarks"
              aria-haspopup="dialog"
              aria-expanded={which === "bookmarks"}
              onClick={() => setWhich("bookmarks")}
            />
          }
        />
      }
    >
      <List header="Page">
        <ListItem
          icon={<Icon icon={Globe} variant="flat" size={18} />}
          iconTile
          iconTint="blue"
          title="Apple"
          subtitle="apple.com"
        />
        <ListItem title="Text" detail={`${largeText ? "Large" : "Regular"}${boldText ? ", bold" : ""}`} />
      </List>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 48 }}>
        <Button
          ref={textRef}
          icon={Type}
          aria-haspopup="dialog"
          aria-expanded={which === "text"}
          onClick={() => setWhich("text")}
        >
          Font size
        </Button>
      </div>

      <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
        Last: {last ?? "—"}
      </p>

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
        <Button
          ref={shareRef}
          size="sm"
          icon={Share}
          aria-haspopup="dialog"
          aria-expanded={which === "share"}
          onClick={() => setWhich("share")}
        >
          Share
        </Button>
      </div>

      {/* bottom: from the nav bar button, clamped away from the right edge; 264 = as wide as a phone allows */}
      <Popover
        contained
        open={which === "bookmarks"}
        anchor={bookmarksRef.current}
        placement="bottom"
        width={264}
        label="Bookmarks"
        onClose={close}
      >
        <List>
          <ListItem
            icon={<Icon icon={Clock} variant="flat" size={18} />}
            iconTile
            title="History"
            accessory="chevron"
            onClick={pick("History")}
          />
          <ListItem
            icon={<Icon icon={Folder} variant="flat" size={18} />}
            iconTile
            iconTint="blue"
            title="Bookmarks Bar"
            accessory="chevron"
            onClick={pick("Bookmarks Bar")}
          />
          <ListItem
            icon={<Icon icon={Folder} variant="flat" size={18} />}
            iconTile
            iconTint="blue"
            title="Bookmarks Menu"
            accessory="chevron"
            onClick={pick("Bookmarks Menu")}
          />
          <ListItem
            icon={<Icon icon={Globe} variant="flat" size={18} />}
            iconTile
            title="Apple"
            accessory="chevron"
            onClick={pick("Apple")}
          />
          <ListItem
            icon={<Icon icon={Globe} variant="flat" size={18} />}
            iconTile
            title="Wikipedia"
            accessory="chevron"
            onClick={pick("Wikipedia")}
          />
        </List>
      </Popover>

      {/* top: arrow on the bottom edge, switch rows stay open while toggling */}
      <Popover
        contained
        open={which === "text"}
        anchor={textRef.current}
        placement="top"
        label="Font size"
        onClose={close}
      >
        <List>
          <ListItem
            title="Large Text"
            accessory={<Switch checked={largeText} onChange={setLargeText} label="Large Text" />}
          />
          <ListItem
            title="Bold Text"
            accessory={<Switch checked={boldText} onChange={setBoldText} label="Bold Text" />}
          />
        </List>
      </Popover>

      {/* left: narrow, anchored near the bottom-right corner — clamped up, arrow slides down */}
      <Popover
        contained
        open={which === "share"}
        anchor={shareRef.current}
        placement="left"
        width={168}
        label="Share"
        onClose={close}
      >
        <List>
          <ListItem
            icon={<Icon icon={BookmarkPlus} variant="flat" size={20} />}
            title="Bookmark"
            onClick={pick("Add Bookmark")}
          />
          <ListItem icon={<Icon icon={Mail} variant="flat" size={20} />} title="Mail Link" onClick={pick("Mail Link")} />
          <ListItem icon={<Icon icon={Copy} variant="flat" size={20} />} title="Copy" onClick={pick("Copy")} />
          <ListItem icon={<Icon icon={Printer} variant="flat" size={20} />} title="Print" onClick={pick("Print")} />
        </List>
      </Popover>
    </Screen>
  );
}
