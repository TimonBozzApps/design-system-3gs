import { useState } from "react";
import {
  Alert,
  BarButton,
  Icon,
  List,
  ListItem,
  NavigationBar,
  TabBar,
  TabBarItem,
} from "@3gs/ui";
import {
  Clapperboard,
  Download,
  Gamepad2,
  LayoutGrid,
  Music,
  Search,
  Star,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { Screen } from "./Screen";

const categories = [
  { title: "Games", icon: Gamepad2, tint: "red" as const },
  { title: "Entertainment", icon: Clapperboard, tint: "blue" as const },
  { title: "Utilities", icon: Wrench, tint: "gray" as const },
  { title: "Social Networking", icon: Users, tint: "blue" as const },
  { title: "Music", icon: Music, tint: "red" as const },
];

/** The reference screenshot, rebuilt from the library: nav bar + grouped list + tab bar. */
export function AppStoreScreen() {
  const [tab, setTab] = useState("categories");
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Screen
      top={
        <NavigationBar
          title="Categories"
          left={<BarButton variant="back">Featured</BarButton>}
          right={<BarButton variant="done">Done</BarButton>}
        />
      }
      bottom={
        <TabBar value={tab} onChange={setTab} label="App Store">
          <TabBarItem value="featured" icon={Star} label="Featured" />
          <TabBarItem value="categories" icon={LayoutGrid} label="Categories" />
          <TabBarItem value="top" icon={Trophy} label="Top 25" />
          <TabBarItem value="search" icon={Search} label="Search" />
          <TabBarItem value="updates" icon={Download} label="Updates" badge={43} />
        </TabBar>
      }
    >
      <List>
        {categories.map((c) => (
          <ListItem
            key={c.title}
            iconTile
            iconTint={c.tint}
            icon={<Icon icon={c.icon} variant="flat" size={18} />}
            title={c.title}
            accessory="chevron"
            onClick={() => setPicked(c.title)}
          />
        ))}
      </List>
      <Alert
        contained
        open={picked !== null}
        title={picked ?? ""}
        message="Every part of this screen is a component from @3gs/ui."
        actions={[{ label: "OK", variant: "primary" }]}
        onClose={() => setPicked(null)}
      />
    </Screen>
  );
}
