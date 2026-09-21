# @3gs/ui

React components in the **iPhone 3GS / iOS 3** style — glossy gel
skeuomorphism, dark by default, with the classic blue-gray light theme one
attribute away. Icons via [lucide](https://lucide.dev), tinted through an SVG
gradient so they get the same glass.

```bash
pnpm add @3gs/ui lucide-react
```

```tsx
import "@3gs/ui/styles.css";
import { NavigationBar, BarButton, List, ListItem, TabBar, TabBarItem, Icon } from "@3gs/ui";
import { Gamepad2, Star, LayoutGrid } from "lucide-react";

export function Screen() {
  return (
    <div className="gs-root">
      <NavigationBar title="Categories" left={<BarButton variant="back">Featured</BarButton>} />
      <List>
        <ListItem iconTile iconTint="red" icon={<Icon icon={Gamepad2} variant="flat" size={18} />} title="Games" accessory="chevron" onClick={…} />
      </List>
      <TabBar defaultValue="featured">
        <TabBarItem value="featured" icon={Star} label="Featured" />
        <TabBarItem value="categories" icon={LayoutGrid} label="Categories" badge={43} />
      </TabBar>
    </div>
  );
}
```

- **Themes:** wrap in `.gs-root` (dark) or `.gs-root[data-theme="light"]`.
- **Tokens:** every colour, gel gradient, rim, radius and size is a `--gs-*`
  custom property; override on `.gs-root` to retint.
- **Components:** Button, Switch, TextField / SearchField, NavigationBar /
  BarButton, TabBar, List, Alert, SegmentedControl, Slider, ActionSheet,
  Picker, DatePicker, ProgressBar / ActivityIndicator, StatusBar, Toolbar,
  PageControl, Popover, HUD, Keyboard, ModalSheet, Stepper, SearchBar,
  NotificationBanner, plus the `Icon` and `Badge` foundation.
- **Peer deps:** React 18 or 19.

Showcase, tokens gallery and source: https://github.com/TimonBozzApps/design-system-3gs
