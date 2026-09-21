import { useRef, useState, type UIEvent } from "react";
import {
  AlarmClock,
  BookOpen,
  Calculator,
  Calendar,
  Camera,
  Cloud,
  Compass,
  Contact,
  Film,
  Gamepad2,
  Globe,
  Headphones,
  Image,
  Mail,
  Map,
  MessageSquare,
  Mic,
  Music,
  Newspaper,
  NotebookPen,
  Phone,
  Settings,
  ShoppingBag,
  Store,
  Timer,
  TrendingUp,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Icon, List, ListItem, NavigationBar, PageControl } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Page Control",
  description:
    "The row of dots under the home screen (UIPageControl): the current page a solid white gel dot with a faint " +
    "gloss and dark outline, the others translucent white sunk into the surface. Tapping the strip's right half " +
    "goes forward, the left half back; each dot is also a button, and the arrow keys walk the pages.",
  usage: `<PageControl count={3} value={page} onChange={(p) => {
  setPage(p);
  pager.current?.scrollTo({ left: p * width, behavior: "smooth" });
}} label="Home screen pages" />`,
  props: [
    { name: "count", type: "number", note: "number of pages; renders nothing for <= 1 (see hideForSinglePage)" },
    { name: "value", type: "number", note: "controlled current page, 0-based, clamped to [0, count - 1]" },
    { name: "defaultValue", type: "number", note: "uncontrolled initial page, default 0" },
    { name: "onChange", type: "(page: number) => void" },
    { name: "label", type: "string", note: 'aria-label for the tablist, default "Pages"' },
    { name: "hideForSinglePage", type: "boolean", note: "default true — UIPageControl.hidesForSinglePage" },
    { name: "size", type: '"sm" | "md"', note: "6 px dots (home screen, default) or 8 px" },
  ],
};

/* ---- fake home screen ---------------------------------------------------- */

interface App {
  icon: LucideIcon;
  name: string;
}

const PAGES: App[][] = [
  [
    { icon: MessageSquare, name: "Messages" },
    { icon: Calendar, name: "Calendar" },
    { icon: Image, name: "Photos" },
    { icon: Camera, name: "Camera" },
    { icon: Video, name: "YouTube" },
    { icon: TrendingUp, name: "Stocks" },
    { icon: Map, name: "Maps" },
    { icon: Cloud, name: "Weather" },
    { icon: Mic, name: "Voice Memos" },
    { icon: NotebookPen, name: "Notes" },
    { icon: AlarmClock, name: "Clock" },
    { icon: Calculator, name: "Calculator" },
  ],
  [
    { icon: Settings, name: "Settings" },
    { icon: Store, name: "App Store" },
    { icon: Music, name: "iTunes" },
    { icon: Compass, name: "Compass" },
    { icon: Contact, name: "Contacts" },
    { icon: Globe, name: "Safari" },
    { icon: BookOpen, name: "Books" },
    { icon: Newspaper, name: "News" },
    { icon: Headphones, name: "Podcasts" },
    { icon: Film, name: "Videos" },
    { icon: Gamepad2, name: "Games" },
    { icon: Timer, name: "Stopwatch" },
  ],
  [
    { icon: ShoppingBag, name: "Shop" },
    { icon: Wallet, name: "Wallet" },
    { icon: Phone, name: "Phone" },
    { icon: Mail, name: "Mail" },
  ],
];

const labelStyle = {
  maxWidth: 66,
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.2,
  color: "var(--gs-white)",
  textShadow: "var(--gs-text-shadow-dark)",
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

function AppTile({ icon, name }: App) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
      <div
        style={{
          width: 57,
          height: 57,
          display: "grid",
          placeItems: "center",
          borderRadius: 12,
          background: "var(--gs-gloss), var(--gs-gradient-dark)",
          border: "var(--gs-border)",
          boxShadow: "var(--gs-emboss)",
        }}
      >
        <Icon icon={icon} size={30} />
      </div>
      <span style={labelStyle}>{name}</span>
    </div>
  );
}

const captionStyle = {
  margin: 0,
  fontSize: "var(--gs-font-size-sm)",
  color: "var(--gs-text-secondary)",
  textShadow: "var(--gs-text-shadow-dark)",
  textAlign: "center",
} as const;

export default function PageControlDemo() {
  const pagerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  // swiping the pager drives the dots …
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const pager = event.currentTarget;
    const next = Math.round(pager.scrollLeft / pager.clientWidth);
    if (next !== page) setPage(next);
  };

  // … and the dots drive the pager
  const handleChange = (next: number) => {
    setPage(next);
    const pager = pagerRef.current;
    pager?.scrollTo({ left: next * pager.clientWidth, behavior: "smooth" });
  };

  return (
    <Screen top={<NavigationBar title="Home" />} background="black" flush>
      <div
        ref={pagerRef}
        onScroll={handleScroll}
        style={{
          display: "flex",
          flexShrink: 0,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          overscrollBehaviorX: "contain",
        }}
      >
        {PAGES.map((apps, index) => (
          <div
            key={index}
            style={{
              flex: "0 0 100%",
              scrollSnapAlign: "start",
              display: "grid",
              gridTemplateColumns: "repeat(4, 57px)",
              gridAutoRows: "max-content",
              justifyContent: "space-between",
              rowGap: 12,
              padding: "14px 18px 8px",
              alignContent: "start",
            }}
          >
            {apps.map((app) => (
              <AppTile key={app.name} {...app} />
            ))}
          </div>
        ))}
      </div>

      <PageControl count={PAGES.length} value={page} onChange={handleChange} label="Home screen pages" />

      <p style={{ ...captionStyle, padding: "0 10px 4px" }}>
        Page {page + 1} of {PAGES.length} — swipe the icons, tap a dot, or tap the strip's right / left half.
      </p>

      <div style={{ display: "grid", gap: 14, padding: "10px 0 20px" }}>
        <List variant="plain" header="Other sizes">
          <ListItem
            title='size="md"'
            subtitle="uncontrolled, 5 pages, defaultValue 2"
            accessory={<PageControl size="md" count={5} defaultValue={2} label="Photos" />}
          />
          <ListItem
            title="count={1}"
            subtitle="hidesForSinglePage — renders nothing"
            accessory={<PageControl count={1} label="Single page" />}
          />
          <ListItem
            title="count={1}, hideForSinglePage={false}"
            subtitle="the lone dot is shown"
            accessory={<PageControl count={1} hideForSinglePage={false} label="Single page, shown" />}
          />
        </List>
      </div>
    </Screen>
  );
}
