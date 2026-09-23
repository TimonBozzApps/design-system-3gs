/**
 * The interactive half of a `ScreenSpec`: the page's search form and its own
 * forms — normalisation, and the URLs a submission builds.
 *
 * Kept apart from `SpecScreen` so the renderer, the JSX generator and the
 * navigation stack all agree on one set of rules, and so the URL building can
 * be read (and reasoned about) without the rendering around it. Everything
 * here is total: a partial, hostile or future server spec degrades to
 * "nothing to show" rather than throwing.
 */
import type { SpecField, SpecForm, SpecSearch } from "../../../../api/_lib/spec";

/* ---- value guards (shared with SpecScreen) ------------------------------ */

export const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

export const httpUrl = (v: unknown): string | undefined => {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};

export const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/* ---- limits ------------------------------------------------------------- */

/** Scope buttons fit across 320 px only three at a time. */
export const MAX_SCOPES = 3;
/** A preview is a caricature — more than a few forms is a different page. */
export const MAX_FORMS = 3;
/** Rows per form; a 40-field checkout stops being a screen. */
export const MAX_FIELDS = 10;
/** Options on one drum / segmented control. */
export const MAX_OPTIONS = 40;
/** A segmented control only stays readable with this many short options. */
export const MAX_SEGMENTS = 3;

/* ---- normalised shapes -------------------------------------------------- */

/** A scope button. `value` is unique within the bar; `href` makes it navigate. */
export interface NormalizedScope {
  value: string;
  label: string;
  href?: string;
}

export interface NormalizedSearch {
  placeholder: string;
  scopes: NormalizedScope[];
  action?: string;
  method: "get" | "post";
  /** Query parameter name; `q` when the server didn't say. */
  param: string;
  hidden: Array<{ name: string; value: string }>;
  /**
   * Whether a typed query can be previewed at all: a GET form with an action.
   * A POST search (or one we never found the form for) can only be opened on
   * the real site.
   */
  submittable: boolean;
}

export type TextInputType = "text" | "email" | "password" | "search" | "tel" | "url" | "number" | "date";

const INPUT_TYPES: readonly TextInputType[] = ["text", "email", "password", "search", "tel", "url", "number", "date"];

export type NormalizedField =
  | {
      kind: "text";
      name: string;
      label: string;
      inputType: TextInputType;
      placeholder?: string;
      value: string;
      required: boolean;
    }
  | { kind: "textarea"; name: string; label: string; placeholder?: string; value: string; required: boolean }
  | { kind: "toggle"; name: string; label: string; value: boolean }
  | {
      kind: "choice";
      name: string;
      label: string;
      options: Array<{ label: string; value: string }>;
      value: string;
      style: "segmented" | "picker";
    };

export interface NormalizedForm {
  title: string;
  action?: string;
  method: "get" | "post";
  fields: NormalizedField[];
  submitLabel: string;
  /** A GET form with an action: submitting it really loads the result page. */
  submittable: boolean;
}

/** Field values of every form on a screen, keyed by {@link fieldKey}. */
export type FormValues = Record<string, string | boolean>;

/** Form values are flat across a screen, so two forms can share a field name. */
export const fieldKey = (formIndex: number, name: string): string => `${formIndex}:${name}`;

/* ---- normalisation ------------------------------------------------------ */

const method = (v: unknown): "get" | "post" => (String(v).toLowerCase() === "post" ? "post" : "get");

/** Labels can repeat on a page; a `SegmentedControl` value can't. */
function uniqueValue(label: string, taken: Set<string>): string {
  let value = label;
  for (let i = 2; taken.has(value); i++) value = `${label} ${i}`;
  taken.add(value);
  return value;
}

export function normalizeSearch(search: SpecSearch | undefined): NormalizedSearch | undefined {
  const placeholder = str(search?.placeholder);
  if (!placeholder) return undefined;

  const taken = new Set<string>();
  const scopes: NormalizedScope[] = [];
  for (const scope of list<{ label?: unknown; href?: unknown }>(search?.scopes)) {
    const label = str(scope?.label);
    if (!label) continue;
    scopes.push({ value: uniqueValue(label, taken), label, href: httpUrl(scope?.href) });
    if (scopes.length === MAX_SCOPES) break;
  }

  const action = httpUrl(search?.action);
  const m = method(search?.method);
  return {
    placeholder,
    scopes,
    action,
    method: m,
    param: str(search?.param) ?? "q",
    hidden: list<{ name?: unknown; value?: unknown }>(search?.hidden)
      .map((h) => ({ name: str(h?.name), value: typeof h?.value === "string" ? h.value : "" }))
      .filter((h): h is { name: string; value: string } => h.name !== undefined),
    submittable: action !== undefined && m === "get",
  };
}

function normalizeField(field: SpecField | undefined): NormalizedField | null {
  if (!field || typeof field !== "object") return null;
  const name = str(field.name);
  if (!name) return null;
  const label = str(field.label) ?? name;

  switch (field.kind) {
    case "text": {
      const inputType = INPUT_TYPES.find((t) => t === field.inputType) ?? "text";
      return {
        kind: "text",
        name,
        label,
        inputType,
        placeholder: str(field.placeholder),
        value: typeof field.value === "string" ? field.value : "",
        required: field.required === true,
      };
    }
    case "textarea":
      return {
        kind: "textarea",
        name,
        label,
        placeholder: str(field.placeholder),
        value: typeof field.value === "string" ? field.value : "",
        required: field.required === true,
      };
    case "toggle":
      return { kind: "toggle", name, label, value: field.value === true };
    case "choice": {
      const options = list<{ label?: unknown; value?: unknown }>(field.options)
        .map((o) => {
          const value = typeof o?.value === "string" ? o.value : undefined;
          const optLabel = str(o?.label) ?? str(value);
          return value !== undefined && optLabel !== undefined ? { label: optLabel, value } : null;
        })
        .filter((o): o is { label: string; value: string } => o !== null)
        .slice(0, MAX_OPTIONS);
      if (options.length === 0) return null;
      const value = options.some((o) => o.value === field.value) ? (field.value as string) : options[0].value;
      // A long list can't be segmented however the server styled it — 320 px.
      const style = field.style === "segmented" && options.length <= MAX_SEGMENTS ? "segmented" : "picker";
      return { kind: "choice", name, label, options, value, style };
    }
    default:
      return null;
  }
}

export function normalizeForms(forms: SpecForm[] | undefined): NormalizedForm[] {
  const out: NormalizedForm[] = [];
  for (const form of list<SpecForm>(forms)) {
    if (!form || typeof form !== "object") continue;
    const seen = new Set<string>();
    const fields: NormalizedField[] = [];
    for (const raw of list<SpecField>(form.fields)) {
      const field = normalizeField(raw);
      // One row per control name: a spec that repeats one would fight itself.
      if (!field || seen.has(field.name)) continue;
      seen.add(field.name);
      fields.push(field);
      if (fields.length === MAX_FIELDS) break;
    }
    if (fields.length === 0) continue;
    const action = httpUrl(form.action);
    const m = method(form.method);
    out.push({
      title: str(form.title) ?? "Form",
      action,
      method: m,
      fields,
      submitLabel: str(form.submitLabel) ?? "Submit",
      submittable: action !== undefined && m === "get",
    });
    if (out.length === MAX_FORMS) break;
  }
  return out;
}

/* ---- the URLs a submission builds --------------------------------------- */

/**
 * Where a typed query goes: the form's action carrying its hidden fields and
 * the query under the form's own parameter name. `undefined` when the site's
 * search can't be previewed (POST, or no action was found) — the caller says
 * so instead of navigating.
 *
 * Parameters already in the action are kept (a real browser would drop them,
 * but a preview is better off over-specified than pointing at a naked path).
 */
export function buildSearchUrl(search: NormalizedSearch, query: string): string | undefined {
  if (!search.submittable || !search.action) return undefined;
  try {
    const url = new URL(search.action);
    for (const { name, value } of search.hidden) url.searchParams.set(name, value);
    url.searchParams.set(search.param, query);
    return url.href;
  } catch {
    return undefined;
  }
}

/** The values a form starts with, ready for `useState`. */
export function initialFormValues(forms: NormalizedForm[]): FormValues {
  const values: FormValues = {};
  forms.forEach((form, i) => {
    for (const field of form.fields) values[fieldKey(i, field.name)] = field.value;
  });
  return values;
}

/**
 * What a GET form submits: every field as a query parameter on the action.
 * Unchecked toggles are dropped, exactly like an unchecked checkbox.
 * `undefined` for a POST form or one without an action — nothing to preview.
 */
export function buildFormUrl(form: NormalizedForm, formIndex: number, values: FormValues): string | undefined {
  if (!form.submittable || !form.action) return undefined;
  try {
    const url = new URL(form.action);
    for (const field of form.fields) {
      const value = values[fieldKey(formIndex, field.name)];
      if (field.kind === "toggle") {
        if (value === true) url.searchParams.set(field.name, "on");
        else url.searchParams.delete(field.name);
      } else {
        url.searchParams.set(field.name, typeof value === "string" ? value : "");
      }
    }
    return url.href;
  } catch {
    return undefined;
  }
}
