import { useState } from "react";
import { Mail, Share } from "lucide-react";
import {
  ActionSheet,
  DatePicker,
  GsProvider,
  Icon,
  Keyboard,
  List,
  ListItem,
  ModalSheet,
  NavigationBar,
  SearchField,
  Switch,
  TextField,
  type GsStrings,
} from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  propTypes: ["GsProviderProps", "GsStrings"],
  title: "Localization",
  description:
    "Every built-in UI string — Cancel, Done, ON / OFF, space, Clear, the aria-labels — is a default that " +
    "GsProvider can override for a whole subtree, and its locale drives the DatePicker's Intl month, weekday " +
    "and AM/PM names. Explicit props still win; providers nest and merge, so a screen can re-word one string.",
  usage: `<GsProvider locale="de-DE" strings={{ cancel: "Abbrechen", done: "Fertig", on: "EIN", off: "AUS" }}>
  <App />
</GsProvider>

// inside a component
const strings = useGsStrings(); // → strings.cancel === "Abbrechen"`,
  props: [
    {
      name: "locale",
      type: "string",
      note: "BCP 47 tag for Intl formatting (DatePicker); inherited from an outer provider when omitted",
    },
    {
      name: "strings",
      type: "Partial<GsStrings>",
      note: "merged over the outer provider's strings (or the English defaultStrings); hoist the object",
    },
    { name: "useGsStrings()", type: "() => GsStrings", note: "hook: the effective strings (defaults without a provider)" },
    { name: "useGsLocale()", type: "() => string | undefined", note: "hook: the effective locale" },
    { name: "defaultStrings", type: "GsStrings", note: "the English table, exported for reference / extension" },
  ],
};

/** German table — hoisted so the provider's context value stays referentially stable. */
const de: Partial<GsStrings> = {
  cancel: "Abbrechen",
  done: "Fertig",
  ok: "OK",
  close: "Schließen",
  clear: "Löschen",
  search: "Suchen",
  go: "Öffnen",
  send: "Senden",
  next: "Weiter",
  loading: "Laden…",
  progress: "Fortschritt",
  actions: "Aktionen",
  dialog: "Dialog",
  tabs: "Tabs",
  segments: "Segmente",
  pages: "Seiten",
  pageOf: (p, n) => `Seite ${p} von ${n}`,
  toolbar: "Symbolleiste",
  keyboard: "Tastatur",
  shift: "Umschalt",
  delete: "Löschen",
  numbers: "Ziffern",
  symbols: "Symbole",
  letters: "Buchstaben",
  space: "Leerzeichen",
  return: "Return",
  on: "EIN",
  off: "AUS",
  date: "Datum",
  time: "Uhrzeit",
  dateTime: "Datum und Uhrzeit",
  month: "Monat",
  day: "Tag",
  year: "Jahr",
  hour: "Stunde",
  minute: "Minute",
  dayPeriod: "Tageshälfte",
  today: "Heute",
  am: "vorm.",
  pm: "nachm.",
};

type Sheet = "share" | "compose";

export default function I18nDemo() {
  const [airplane, setAirplane] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [query, setQuery] = useState("");
  const [to, setTo] = useState("");
  const [birthday, setBirthday] = useState(() => new Date(2007, 5, 29));

  const close = () => setSheet(null);

  return (
    <GsProvider locale="de-DE" strings={de}>
      <Screen
        top={<NavigationBar title="Einstellungen" />}
        bottom={<Keyboard value={query} onChange={setQuery} returnKey="Search" />}
      >
        {/* no placeholder → strings.search; the ⓧ is strings.clear */}
        <SearchField value={query} onChange={(e) => setQuery(e.target.value)} />

        <List header="Allgemein">
          {/* no onLabel / offLabel → strings.on / strings.off */}
          <ListItem title="Flugmodus" accessory={<Switch checked={airplane} onChange={setAirplane} />} />
          <ListItem
            icon={<Icon icon={Share} variant="flat" size={18} />}
            iconTile
            iconTint="blue"
            title="Foto teilen"
            subtitle="ActionSheet — Abbrechen kommt aus dem Provider"
            accessory="chevron"
            onClick={() => setSheet("share")}
          />
          <ListItem
            icon={<Icon icon={Mail} variant="flat" size={18} />}
            iconTile
            title="Neue Nachricht"
            subtitle="ModalSheet — Abbrechen / Fertig"
            accessory="chevron"
            onClick={() => setSheet("compose")}
          />
        </List>

        <List header="Geburtstag">
          {/* no locale prop → provider's de-DE: German month names */}
          <DatePicker mode="date" rows={3} value={birthday} onChange={setBirthday} />
        </List>

        <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
          Kein Element auf diesem Bildschirm hat ein Label-Prop erhalten — Abbrechen, Fertig, EIN / AUS,
          Suchen, Leerzeichen und die Monatsnamen kommen alle aus dem GsProvider.
        </p>

        {/* default cancel button → strings.cancel */}
        <ActionSheet
          contained
          open={sheet === "share"}
          title="Foto teilen"
          actions={[{ label: "Per E-Mail senden", onClick: close }]}
          onClose={close}
        />

        {/* default bar buttons → strings.cancel / strings.done */}
        <ModalSheet contained open={sheet === "compose"} title="Neue Nachricht" onClose={close}>
          <TextField
            label="An"
            type="email"
            placeholder="name@example.de"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            clearable
            onClear={() => setTo("")}
          />
          <p style={{ color: "var(--gs-text-secondary)", fontSize: 13, margin: 0, textAlign: "center" }}>
            Die Leiste zeigt Abbrechen / Fertig ohne left- oder right-Prop.
          </p>
        </ModalSheet>
      </Screen>
    </GsProvider>
  );
}
