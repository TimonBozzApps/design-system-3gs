#!/usr/bin/env node
/**
 * Extracts the public prop tables of `@3gs/ui` from its TypeScript types and
 * writes them to `apps/site/src/generated/props.json` for the showcase.
 *
 *   pnpm --filter site props        (also runs as predev / prebuild)
 *
 * Every interface / type alias exported from `packages/ui/src/index.ts` is
 * recorded. Interfaces (and aliases of object types) list their properties —
 * only those declared under `packages/ui/src`, so inherited DOM / React
 * attributes are summarised by `extends` instead of listed. Union and other
 * non-object aliases are recorded as `{ kind: "alias", type }`.
 *
 * Property defaults come from a `@default` JSDoc tag, else from the
 * component's destructuring (`{ variant = "default" }`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_DIR = resolve(ROOT, "packages/ui");
const LIB_SRC = resolve(LIB_DIR, "src");
const ENTRY = resolve(LIB_SRC, "index.ts");
const OUT = resolve(ROOT, "apps/site/src/generated/props.json");

const started = performance.now();

/* ---- program ------------------------------------------------------------ */

const configPath = resolve(LIB_DIR, "tsconfig.json");
const parsed = ts.getParsedCommandLineOfConfigFile(configPath, undefined, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic(d) {
    throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  },
});
if (!parsed) throw new Error(`Could not parse ${configPath}`);

const program = ts.createProgram({
  rootNames: [ENTRY],
  options: { ...parsed.options, noEmit: true, declaration: false, composite: false, incremental: false },
});
const checker = program.getTypeChecker();
const entry = program.getSourceFile(ENTRY);
if (!entry) throw new Error(`Entry file not in program: ${ENTRY}`);

/* ---- helpers ------------------------------------------------------------ */

const isInLib = (file) => {
  const rel = relative(LIB_SRC, file.fileName);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep) && !file.fileName.includes(`${sep}node_modules${sep}`);
};

const TYPE_FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias;

/** Collapse a multi-line source snippet into one line. */
const oneLine = (text) => text.replace(/\s*\n\s*/g, " ").trim();

/** First paragraph of a JSDoc block, joined onto one line. */
function firstParagraph(text) {
  const para = text.trim().split(/\n\s*\n/)[0] ?? "";
  return oneLine(para);
}

/** The `// comment` trailing a declaration on the same source line, if any. */
function trailingLineComment(decl) {
  const file = decl.getSourceFile();
  const text = file.text;
  const lineEnd = text.indexOf("\n", decl.end);
  const rest = text.slice(decl.end, lineEnd === -1 ? undefined : lineEnd);
  const m = /^\s*\/\/\s*(.*?)\s*$/.exec(rest);
  return m ? m[1] : "";
}

function describeSymbol(sym, decl) {
  const doc = firstParagraph(ts.displayPartsToString(sym.getDocumentationComment(checker)));
  if (doc) return doc;
  return decl ? trailingLineComment(decl) : "";
}

function defaultTag(sym) {
  const tag = sym.getJsDocTags(checker).find((t) => t.name === "default");
  return tag ? oneLine(ts.displayPartsToString(tag.text ?? [])) : undefined;
}

/** Type of a property without the `| undefined` that `?` adds under strictNullChecks. */
function propertyTypeText(sym, decl) {
  let type;
  if (decl && (ts.isPropertySignature(decl) || ts.isPropertyDeclaration(decl)) && decl.type) {
    type = checker.getTypeFromTypeNode(decl.type);
  } else {
    type = checker.getTypeOfSymbolAtLocation(sym, decl ?? entry);
  }
  let text = checker.typeToString(type, undefined, TYPE_FLAGS);
  if (sym.flags & ts.SymbolFlags.Optional) {
    text = text.replace(/^undefined \| /, "").replace(/ \| undefined$/, "");
  }
  return text;
}

/** The interface / type-literal / alias declaration a property is declared in. */
function owningTypeName(decl) {
  let node = decl.parent;
  while (node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return node.name.text;
    if (ts.isTypeLiteralNode(node) && node.parent && ts.isTypeAliasDeclaration(node.parent)) {
      return node.parent.name.text;
    }
    node = node.parent;
  }
  return undefined;
}

/* ---- defaults from destructuring ---------------------------------------- */

/**
 * `{ [ownerTypeName]: { [propName]: "initializer text" } }` gathered from every
 * object-binding pattern in the library (function params and `const { … } = props`).
 * The destructured value's type is resolved by the checker, so patterns typed
 * through `forwardRef<…, Props>` / `Omit<Props, …>` still map back to the
 * interface that declares each property.
 */
const destructuredDefaults = new Map();

function collectDefaults(file) {
  const visit = (node) => {
    if (ts.isObjectBindingPattern(node)) {
      const type = checker.getTypeAtLocation(node);
      for (const el of node.elements) {
        if (!el.initializer || el.dotDotDotToken) continue;
        const nameNode = el.propertyName ?? el.name;
        if (!ts.isIdentifier(nameNode) && !ts.isStringLiteral(nameNode)) continue;
        const prop = checker.getPropertyOfType(type, nameNode.text);
        const decl = prop?.declarations?.[0];
        if (!decl || !isInLib(decl.getSourceFile())) continue;
        const owner = owningTypeName(decl);
        if (!owner) continue;
        let byProp = destructuredDefaults.get(owner);
        if (!byProp) destructuredDefaults.set(owner, (byProp = new Map()));
        if (!byProp.has(nameNode.text)) byProp.set(nameNode.text, oneLine(el.initializer.getText(file)));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

for (const file of program.getSourceFiles()) if (isInLib(file)) collectDefaults(file);

/* ---- exports ------------------------------------------------------------ */

const moduleSymbol = checker.getSymbolAtLocation(entry);
if (!moduleSymbol) throw new Error("index.ts has no module symbol");

const interfaces = {};
let propCount = 0;

for (const exported of checker.getExportsOfModule(moduleSymbol)) {
  const sym = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  if (!(sym.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias))) continue;

  const decl = sym.declarations?.find((d) => ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d));
  if (!decl || !isInLib(decl.getSourceFile())) continue;

  const name = exported.name;
  const type = checker.getDeclaredTypeOfSymbol(sym);
  const description = describeSymbol(sym, decl);

  // Properties declared in the library (inherited DOM / React attrs are dropped).
  const props = [];
  for (const prop of checker.getPropertiesOfType(type)) {
    const decls = prop.declarations ?? [];
    const propDecl = decls.find((d) => owningTypeName(d) === name) ?? decls[0];
    if (!propDecl || !isInLib(propDecl.getSourceFile())) continue;
    const owner = owningTypeName(propDecl);
    const entryProps = {
      name: prop.name,
      type: propertyTypeText(prop, propDecl),
      optional: Boolean(prop.flags & ts.SymbolFlags.Optional),
      description: describeSymbol(prop, propDecl),
    };
    const def = defaultTag(prop) ?? destructuredDefaults.get(owner)?.get(prop.name);
    if (def !== undefined) entryProps.default = def;
    if (owner && owner !== name) entryProps.inheritedFrom = owner;
    props.push({ ...entryProps, _own: owner === name, _pos: propDecl.pos, _file: propDecl.getSourceFile().fileName });
  }
  props.sort((a, b) => Number(b._own) - Number(a._own) || a._file.localeCompare(b._file) || a._pos - b._pos);
  for (const p of props) {
    delete p._own;
    delete p._pos;
    delete p._file;
  }

  if (ts.isInterfaceDeclaration(decl)) {
    const heritage = (decl.heritageClauses ?? [])
      .filter((c) => c.token === ts.SyntaxKind.ExtendsKeyword)
      .flatMap((c) => c.types.map((t) => oneLine(t.getText(decl.getSourceFile()))));
    interfaces[name] = { kind: "interface", extends: heritage, description, props };
  } else if (props.length > 0) {
    interfaces[name] = { kind: "type", extends: [], description, props };
  } else {
    const typeText = checker.typeToString(type, undefined, TYPE_FLAGS);
    const alias = { kind: "alias", type: typeText, description };
    // Per-member docs of a documented union (`/** dark gel */ | "default"`).
    if (ts.isUnionTypeNode(decl.type)) {
      const file = decl.getSourceFile();
      const members = decl.type.types.map((member) => {
        const ranges = ts.getLeadingCommentRanges(file.text, member.getFullStart()) ?? [];
        const docs = ranges
          .map((r) => file.text.slice(r.pos, r.end))
          .map((c) => c.replace(/^\/\*\*?|\*\/$/g, "").replace(/^\s*\*\s?/gm, "").replace(/^\/\/\s?/, "").trim())
          .filter(Boolean);
        return { value: oneLine(member.getText(file)), description: oneLine(docs.join(" ")) };
      });
      if (members.some((m) => m.description)) alias.members = members;
    }
    interfaces[name] = alias;
  }
  propCount += props.length;
}

/* ---- write --------------------------------------------------------------- */

const sorted = Object.fromEntries(Object.keys(interfaces).sort().map((k) => [k, interfaces[k]]));
const output = { generatedAt: new Date().toISOString(), interfaces: sorted };

// Only rewrite when the extracted shape changed, so predev doesn't churn the committed file.
let previous;
if (existsSync(OUT)) {
  try {
    previous = JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    previous = undefined;
  }
}
const unchanged = previous && JSON.stringify(previous.interfaces) === JSON.stringify(sorted);
if (!unchanged) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
}

const n = Object.keys(sorted).length;
const ms = Math.round(performance.now() - started);
console.log(
  `props: ${n} interfaces, ${propCount} props → ${relative(process.cwd(), OUT)} ${unchanged ? "(unchanged)" : "(written)"} in ${ms} ms`,
);
