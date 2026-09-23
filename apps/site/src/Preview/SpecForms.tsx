import { Fragment, useState } from "react";
import { Button, List, ListItem, Picker, Segment, SegmentedControl, Switch, TextField } from "@3gs/ui";
import {
  buildFormUrl,
  fieldKey,
  initialFormValues,
  type FormValues,
  type NormalizedField,
  type NormalizedForm,
} from "./forms";

export interface SpecFormsProps {
  forms: NormalizedForm[];
  /**
   * Identifies the page the forms belong to. When it changes the fields go
   * back to the values the server sent — typing survives a re-render, never a
   * navigation.
   */
  pageKey: string;
  /**
   * The submit button was tapped. `url` is the page the GET form would load;
   * `undefined` means the form posts (or has no action) and can't be previewed.
   */
  onSubmit: (form: NormalizedForm, url: string | undefined) => void;
}

/**
 * The page's own forms as iOS 3 grouped form sections: one `<List>` per form,
 * one cell per control, a gel submit button as the last cell.
 *
 * The values live here, not in the spec: the spec is what the server saw, this
 * is what the visitor has typed. A `picker` choice reveals its drum inline
 * under the row (a modal sheet would hide the form it belongs to on a 320 px
 * screen, and the drum is only 3 rows tall).
 */
export function SpecForms({ forms, pageKey, onSubmit }: SpecFormsProps) {
  const [state, setState] = useState<{ key: string; values: FormValues }>(() => ({
    key: pageKey,
    values: initialFormValues(forms),
  }));
  /** Which `picker` choice has its drum open, as `formIndex:name`. */
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  // A new page: adjust during render rather than in an effect, so the fields
  // never flash the previous page's values (the React "derive on prop change"
  // pattern — it re-renders this component only).
  if (state.key !== pageKey) {
    setState({ key: pageKey, values: initialFormValues(forms) });
    setOpenPicker(null);
  }
  const values = state.key === pageKey ? state.values : initialFormValues(forms);

  const set = (key: string, value: string | boolean) =>
    setState((s) => ({ key: s.key, values: { ...s.values, [key]: value } }));

  const renderField = (formIndex: number, field: NormalizedField) => {
    const key = fieldKey(formIndex, field.name);
    const current = values[key];

    switch (field.kind) {
      case "text":
        return (
          <ListItem
            key={key}
            className="spec-field spec-field--text"
            title={
              <TextField
                label={field.label}
                type={field.inputType}
                placeholder={field.placeholder}
                required={field.required}
                value={typeof current === "string" ? current : ""}
                onChange={(e) => set(key, e.target.value)}
              />
            }
          />
        );

      case "textarea":
        return (
          <ListItem
            key={key}
            className="spec-field spec-field--textarea"
            title={
              <span className="spec-field__stack">
                <span className="spec-field__label">{field.label}</span>
                <textarea
                  className="spec-field__textarea"
                  aria-label={field.label}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={3}
                  value={typeof current === "string" ? current : ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </span>
            }
          />
        );

      case "toggle":
        return (
          <ListItem
            key={key}
            className="spec-field spec-field--toggle"
            title={field.label}
            accessory={
              <Switch label={field.label} checked={current === true} onChange={(next) => set(key, next)} />
            }
          />
        );

      case "choice": {
        const value = typeof current === "string" ? current : field.value;
        if (field.style === "segmented") {
          return (
            <ListItem
              key={key}
              className="spec-field spec-field--segmented"
              title={field.label}
              accessory={
                <SegmentedControl size="sm" label={field.label} value={value} onChange={(next) => set(key, next)}>
                  {field.options.map((option) => (
                    <Segment key={option.value} value={option.value}>
                      {option.label}
                    </Segment>
                  ))}
                </SegmentedControl>
              }
            />
          );
        }

        const open = openPicker === key;
        const selected = field.options.find((o) => o.value === value);
        return (
          <Fragment key={key}>
            <ListItem
              className="spec-field spec-field--picker-row"
              title={field.label}
              detail={selected?.label ?? value}
              accessory="chevron"
              selected={open}
              aria-expanded={open}
              onClick={() => setOpenPicker(open ? null : key)}
            />
            {open && (
              <ListItem
                className="spec-field spec-field--picker"
                title={
                  <Picker
                    rows={3}
                    label={field.label}
                    columns={[{ key: field.name, label: field.label, options: field.options }]}
                    value={{ [field.name]: value }}
                    onChange={(next) => set(key, next[field.name])}
                  />
                }
              />
            )}
          </Fragment>
        );
      }
    }
  };

  return (
    <>
      {forms.map((form, i) => (
        <List key={i} className="spec-form" header={form.title}>
          {form.fields.map((f) => renderField(i, f))}
          <ListItem
            className="spec-field spec-field--submit"
            title={
              <Button block variant="primary" onClick={() => onSubmit(form, buildFormUrl(form, i, values))}>
                {form.submitLabel}
              </Button>
            }
          />
        </List>
      ))}
    </>
  );
}
