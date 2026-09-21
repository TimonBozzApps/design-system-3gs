import { Fragment, type ReactNode } from "react";
import generatedJson from "./generated/props.json";
import "./PropsTable.css";

/* ---- generated data (scripts/extract-props.mjs → generated/props.json) --- */

export interface GeneratedProp {
  name: string;
  /** Type as written in the source, lib-local union aliases expanded. */
  type: string;
  /** The union alias `type` was expanded from, e.g. `ButtonVariant`. */
  alias?: string;
  optional: boolean;
  description: string;
  default?: string;
  /** Set when the prop is declared on a base interface (`SearchFieldProps` → `TextFieldProps`). */
  inheritedFrom?: string;
}

export interface GeneratedInterface {
  kind: "interface" | "type";
  extends: string[];
  description: string;
  props: GeneratedProp[];
}

export interface GeneratedAlias {
  kind: "alias";
  type: string;
  description: string;
  members?: Array<{ value: string; description: string }>;
}

export type GeneratedEntry = GeneratedInterface | GeneratedAlias;

const generated = generatedJson as unknown as {
  generatedAt: string;
  interfaces: Record<string, GeneratedEntry>;
};

const lookup = (name: string): GeneratedInterface | undefined => {
  const entry = generated.interfaces[name];
  return entry && entry.kind !== "alias" ? entry : undefined;
};

/* ---- hand-written hints --------------------------------------------------- */

export interface PropNote {
  name: string;
  type: string;
  note?: string;
}

/**
 * Attaches each hint to a generated row. A hint name may be `"variant"`,
 * `"header / footer"` (several rows) or `"TabBarItem.badge"` (a specific
 * interface); an unprefixed name goes to the first listed interface that has
 * that prop. Hints that match no row are returned as `leftover`.
 */
function attachNotes(names: string[], notes: PropNote[]) {
  const byRow = new Map<string, string[]>();
  const leftover: PropNote[] = [];

  const rowFor = (part: string): string | undefined => {
    const dot = part.indexOf(".");
    if (dot !== -1) {
      const prefix = part.slice(0, dot);
      const prop = part.slice(dot + 1);
      const iface = names.find((n) => n === `${prefix}Props`) ?? names.find((n) => n.startsWith(prefix));
      return iface && lookup(iface)?.props.some((p) => p.name === prop) ? `${iface}.${prop}` : undefined;
    }
    const iface = names.find((n) => lookup(n)?.props.some((p) => p.name === part));
    return iface ? `${iface}.${part}` : undefined;
  };

  for (const note of notes) {
    const keys = note.name
      .split("/")
      .map((s) => rowFor(s.trim()))
      .filter((k): k is string => Boolean(k));
    if (keys.length === 0) {
      leftover.push(note);
      continue;
    }
    if (!note.note) continue;
    for (const key of keys) byRow.set(key, [...(byRow.get(key) ?? []), note.note]);
  }
  return { byRow, leftover };
}

/* ---- rendering helpers --------------------------------------------------- */

/** `` `code` `` spans in JSDoc text → `<code>`. */
function inlineCode(text: string): ReactNode {
  const parts = text.split("`");
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>));
}

/** "Omit<HTMLAttributes<HTMLDivElement>, "title">" → "plus native <div> attributes, except title". */
function describeExtends(heritage: string[]): ReactNode {
  const parts = heritage.map((text) => {
    let base = text;
    let omitted: string[] = [];
    const omit = /^Omit<(.+),\s*((?:"[^"]+"(?:\s*\|\s*)?)+)>$/.exec(text);
    if (omit) {
      base = omit[1];
      omitted = Array.from(omit[2].matchAll(/"([^"]+)"/g), (m) => m[1]);
    }
    const native = /^(\w*)HTMLAttributes<HTML(\w*)Element>$/.exec(base);
    const what = native ? (
      <>native {native[2] ? <code>{`<${native[2].toLowerCase()}>`}</code> : "HTML"} attributes</>
    ) : (
      <code>{base}</code>
    );
    return (
      <>
        {what}
        {omitted.length > 0 && (
          <>
            , except{" "}
            {omitted.map((name, i) => (
              <Fragment key={name}>
                {i > 0 && ", "}
                <code>{name}</code>
              </Fragment>
            ))}
          </>
        )}
      </>
    );
  });
  return (
    <>
      plus{" "}
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && " and "}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/** Tooltip listing a union alias's documented members. */
function memberDocs(alias: string | undefined): string | undefined {
  const entry = alias ? generated.interfaces[alias] : undefined;
  if (!entry || entry.kind !== "alias" || !entry.members) return undefined;
  const lines = entry.members.filter((m) => m.description).map((m) => `${m.value} — ${m.description}`);
  return lines.length > 0 ? `${alias}\n${lines.join("\n")}` : undefined;
}

/* ---- components ------------------------------------------------------------ */

/** The original hand-written list, unchanged, for demos without `propTypes`. */
function LegacyProps({ notes }: { notes: PropNote[] }) {
  return (
    <dl className="demo__props">
      {notes.map((p) => (
        <div key={p.name} className="demo__prop">
          <dt>
            <code>{p.name}</code>
          </dt>
          <dd>
            <code className="demo__prop-type">{p.type}</code>
            {p.note && <span className="demo__prop-note">{p.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface PropsTableProps {
  /** Interface names from `generated/props.json`; unknown names are skipped. */
  propTypes?: string[];
  /** The demo's hand-written `meta.props`. */
  notes?: PropNote[];
}

export function PropsTable({ propTypes, notes = [] }: PropsTableProps) {
  const names = (propTypes ?? []).filter((n) => lookup(n));
  if (names.length === 0) return notes.length > 0 ? <LegacyProps notes={notes} /> : null;

  const { byRow, leftover } = attachNotes(names, notes);

  return (
    <div className="props-table">
      {names.map((name) => {
        const entry = lookup(name)!;
        return (
          <Fragment key={name}>
            <h3 className="props-table__heading">
              <code>{name}</code>
              {entry.extends.length > 0 && (
                <span className="props-table__extends">{describeExtends(entry.extends)}</span>
              )}
            </h3>
            {entry.description && <p className="props-table__intro">{inlineCode(entry.description)}</p>}
            <div className="props-table__head" aria-hidden="true">
              <span>Name</span>
              <span>Type</span>
              <span>Default</span>
            </div>
            {entry.props.map((p) => {
              // Rows inherited from an interface documented in this same section are
              // already listed there (the heading says "plus TextFieldProps, except …").
              if (p.inheritedFrom && names.includes(p.inheritedFrom)) return null;
              const hints = byRow.get(`${name}.${p.name}`);
              return (
                <div className="props-table__row" key={p.name}>
                  <div className="props-table__name">
                    <code>{p.name}</code>
                    {!p.optional && (
                      <abbr className="props-table__required" title="required">
                        *
                      </abbr>
                    )}
                    {p.inheritedFrom && <span className="props-table__from">from {p.inheritedFrom}</span>}
                  </div>
                  <div className="props-table__type">
                    <code title={memberDocs(p.alias)}>{p.type}</code>
                  </div>
                  <div className="props-table__default">
                    {p.default !== undefined ? <code>{p.default}</code> : <span aria-hidden="true">–</span>}
                  </div>
                  {(p.description || hints) && (
                    <div className="props-table__desc">
                      {p.description && <span>{inlineCode(p.description)}</span>}
                      {hints?.map((hint, i) => (
                        <span key={i} className="props-table__note">
                          {hint}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        );
      })}
      {leftover.length > 0 && (
        <>
          <h3 className="props-table__heading">
            <span className="props-table__extends">Also</span>
          </h3>
          {leftover.map((p) => (
            <div className="props-table__row" key={p.name}>
              <div className="props-table__name">
                <code>{p.name}</code>
              </div>
              <div className="props-table__type">
                <code>{p.type}</code>
              </div>
              <div className="props-table__default">
                <span aria-hidden="true">–</span>
              </div>
              {p.note && (
                <div className="props-table__desc">
                  <span className="props-table__note">{p.note}</span>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
