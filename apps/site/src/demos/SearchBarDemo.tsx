import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { BarButton, List, ListItem, NavigationBar, SearchBar, type SearchScope } from "@3gs/ui";
import { Screen } from "../shell/Screen";
import type { DemoMeta } from "./types";

export const meta: DemoMeta = {
  title: "Search Bar",
  description:
    "UISearchBar — the strip of bar glass under the navigation bar in Contacts and Mail: the pill search field, " +
    "a gel Cancel button that slides in while you type, and the optional row of scope buttons (a small segmented " +
    "control) folded underneath. Same chrome as the NavigationBar, so it stacks straight under one.",
  usage: `<SearchBar
  value={query} onChange={setQuery} onSearch={run}
  scopes={[{ value: "all", label: "All" }, { value: "work", label: "Work" }]}
  scope={scope} onScopeChange={setScope}
/>`,
  propTypes: ["SearchBarProps", "SearchScope"],
  props: [
    { name: "value / defaultValue", type: "string", note: "controlled / uncontrolled query" },
    { name: "onChange", type: "(query: string) => void", note: "every keystroke, ⓧ and Cancel (\"\")" },
    { name: "onSearch", type: "(query: string) => void", note: "Enter key" },
    { name: "onCancel", type: "() => void", note: "Cancel tapped — the bar clears and blurs first" },
    { name: "scopes", type: "SearchScope[]", note: "{ value, label, disabled? } — adds the segmented scope row" },
    { name: "scope / defaultScope", type: "string", note: "controlled / uncontrolled scope (default: the first)" },
    { name: "onScopeChange", type: "(scope: string) => void" },
    { name: "showsScopeBar", type: '"always" | "whileEditing"', note: "whileEditing folds the row open with the field" },
    { name: "showsCancel", type: '"whileEditing" | "always" | "never"', note: "editing = focused or has text" },
    { name: "cancelLabel", type: "string", note: 'default "Cancel"' },
    { name: "tint", type: '"black" | "blue"', note: "black glass, or the blue-gray bar in both themes" },
    { name: "placeholder", type: "string", note: 'default "Search"' },
    { name: "autoFocus / disabled", type: "boolean" },
    { name: "label", type: "string", note: 'aria-label of the role="search" landmark, default "Search"' },
    { name: "inputProps", type: "InputHTMLAttributes<HTMLInputElement>", note: "escape hatch for the inner <input>" },
    { name: "ref", type: "HTMLInputElement", note: "the inner input" },
  ],
};

type Group = "friends" | "work";

const contacts: Array<{ name: string; group: Group }> = [
  { name: "Ada Lovelace", group: "work" },
  { name: "Bill Atkinson", group: "friends" },
  { name: "Grace Hopper", group: "work" },
  { name: "Jef Raskin", group: "friends" },
  { name: "Jony Ive", group: "work" },
  { name: "Ken Thompson", group: "friends" },
  { name: "Margaret Hamilton", group: "work" },
  { name: "Scott Forstall", group: "work" },
  { name: "Steve Jobs", group: "friends" },
  { name: "Steve Wozniak", group: "friends" },
  { name: "Susan Kare", group: "work" },
  { name: "Tim Berners-Lee", group: "friends" },
];

const scopes: SearchScope[] = [
  { value: "all", label: "All" },
  { value: "friends", label: "Friends" },
  { value: "work", label: "Work" },
];

const groupLabel: Record<Group, string> = { friends: "Friend", work: "Work" };

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

export default function SearchBarDemo() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");

  const needle = query.trim().toLowerCase();
  const results = contacts.filter(
    ({ name, group }) =>
      (scope === "all" || group === scope) && name.toLowerCase().includes(needle),
  );

  return (
    <Screen
      top={
        <>
          <NavigationBar title="Contacts" right={<BarButton icon={Plus} aria-label="Add" />} />
          <SearchBar
            value={query}
            onChange={setQuery}
            scopes={scopes}
            scope={scope}
            onScopeChange={setScope}
            label="Search contacts"
          />
        </>
      }
      background="black"
      flush
    >
      {results.length > 0 ? (
        <List variant="plain" footer={`${results.length} contact${results.length === 1 ? "" : "s"}`}>
          {results.map(({ name, group }) => (
            <ListItem key={name} title={name} detail={groupLabel[group]} onClick={() => {}} />
          ))}
        </List>
      ) : (
        <div
          style={{
            padding: "40px 10px",
            textAlign: "center",
            fontSize: 17,
            fontWeight: 700,
            color: "var(--gs-text-secondary)",
            textShadow: "var(--gs-text-emboss)",
          }}
        >
          No Results
        </div>
      )}

      <div style={{ display: "grid", gap: 6, paddingTop: 24 }}>
        <Caption>Blue · scopes while editing</Caption>
        <SearchBar
          tint="blue"
          showsCancel="always"
          showsScopeBar="whileEditing"
          scopes={[
            { value: "from", label: "From" },
            { value: "to", label: "To" },
            { value: "subject", label: "Subject" },
            { value: "all", label: "All", disabled: true },
          ]}
          placeholder="Search Mail"
          label="Search mail"
        />
      </div>

      <div style={{ display: "grid", gap: 6, padding: "24px 0 20px" }}>
        <Caption>Disabled · no Cancel</Caption>
        <SearchBar defaultValue="Wozniak" showsCancel="never" disabled label="Search (disabled)" />
      </div>
    </Screen>
  );
}
