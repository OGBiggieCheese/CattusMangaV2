"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Minus, Plus, X } from "lucide-react";
import type { FilterValue, FilterValues, SourceFilter, TriState } from "@/lib/api";
import { Button } from "@/components/ui";

type Leaf = Exclude<SourceFilter, { __typename: "GroupFilter" }>;

/** Lee el parámetro `filtros` de la URL. */
export function parseFilters(raw: string | null): FilterValues {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** ¿Tiene la fuente algún filtro con estado (no solo cabeceras/separadores)? */
export const hasUsableFilters = (filters: SourceFilter[]): boolean =>
  filters.some((f) => (f.__typename === "GroupFilter" ? hasUsableFilters(f.filters) : !isDecoration(f)));

const isDecoration = (f: SourceFilter) => f.__typename === "HeaderFilter" || f.__typename === "SeparatorFilter";
const isChip = (f: SourceFilter) => f.__typename === "CheckBoxFilter" || f.__typename === "TriStateFilter";

/** Valor por defecto de un filtro, con la misma forma que FilterValue. */
function defaultOf(f: Leaf): FilterValue | null {
  switch (f.__typename) {
    case "SelectFilter":
      return { selectState: f.selectDefault };
    case "TextFilter":
      return { textState: f.textDefault };
    case "CheckBoxFilter":
      return { checkBoxState: f.checkBoxDefault };
    case "TriStateFilter":
      return { triState: f.triDefault };
    case "SortFilter":
      return f.sortDefault ? { sortState: f.sortDefault } : null;
    default:
      return null;
  }
}

const sameValue = (a: FilterValue | null, b: FilterValue) => JSON.stringify(a) === JSON.stringify(b);

function leafAt(filters: SourceFilter[], key: string): Leaf | null {
  const [pos, child] = key.split(".").map(Number);
  const f = filters[pos];
  if (!f) return null;
  if (f.__typename === "GroupFilter") return child === undefined ? null : (f.filters[child] as Leaf) ?? null;
  return child === undefined ? f : null;
}

/** Texto corto que describe un filtro activo, p. ej. "+Acción" o "Orden: Popularidad ↓". */
function describe(f: Leaf, v: FilterValue): string {
  switch (f.__typename) {
    case "TriStateFilter":
      return `${v.triState === "EXCLUDE" ? "−" : v.triState === "INCLUDE" ? "+" : ""}${f.name}`;
    case "CheckBoxFilter":
      return v.checkBoxState ? f.name : `Sin ${f.name}`;
    case "SelectFilter":
      return `${f.name}: ${f.values[v.selectState ?? 0] ?? "?"}`;
    case "TextFilter":
      return `${f.name}: «${v.textState}»`;
    case "SortFilter":
      return `${f.name}: ${f.values[v.sortState?.index ?? 0] ?? "?"} ${v.sortState?.ascending ? "↑" : "↓"}`;
    default:
      return f.name;
  }
}

/** Píldoras con los filtros aplicados; cada una se puede quitar por separado. */
export function ActiveFilters({
  filters,
  values,
  onChange,
}: {
  filters: SourceFilter[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}) {
  const entries = Object.entries(values).flatMap(([key, v]) => {
    const f = leafAt(filters, key);
    return f ? [{ key, label: describe(f, v), v }] : [];
  });
  if (!entries.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
      <span className="mr-1 text-muted">Filtros:</span>
      {entries.map(({ key, label, v }) => (
        <button
          key={key}
          onClick={() => {
            const next = { ...values };
            delete next[key];
            onChange(next);
          }}
          title="Quitar filtro"
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            v.triState === "EXCLUDE" ? "bg-danger/15 text-danger" : "bg-accent-soft text-accent"
          }`}
        >
          {label} <X className="size-3" />
        </button>
      ))}
      <button className="ml-1 text-accent hover:underline" onClick={() => onChange({})}>
        Quitar todos
      </button>
    </div>
  );
}

/** Panel con todos los filtros que declara la extensión. Los cambios se aplican al pulsar «Aplicar». */
export function FilterPanel({
  filters,
  values,
  onApply,
}: {
  filters: SourceFilter[];
  values: FilterValues;
  onApply: (values: FilterValues) => void;
}) {
  const [draft, setDraft] = useState(values);

  const set = (key: string, f: Leaf, v: FilterValue) =>
    setDraft((d) => {
      const next = { ...d };
      if (sameValue(defaultOf(f), v)) delete next[key];
      else next[key] = v;
      return next;
    });

  // Los checkbox/tri-estado consecutivos se agrupan en una misma fila de chips.
  const blocks: { key: string; items: [string, SourceFilter][] }[] = [];
  filters.forEach((f, i) => {
    const last = blocks.at(-1);
    if (isChip(f) && last && isChip(last.items[0][1])) last.items.push([String(i), f]);
    else blocks.push({ key: String(i), items: [[String(i), f]] });
  });

  return (
    <form
      className="mt-4 border-t border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map(({ key, items }) => {
          const [, first] = items[0];
          if (isChip(first))
            return (
              <div key={key} className="col-span-full flex flex-wrap gap-1.5">
                {items.map(([k, f]) => (
                  <FilterField key={k} filter={f as Leaf} id={k} draft={draft} set={set} />
                ))}
              </div>
            );
          if (first.__typename === "GroupFilter") return <Group key={key} group={first} id={key} draft={draft} set={set} />;
          return <FilterField key={key} filter={first} id={key} draft={draft} set={set} />;
        })}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({})} disabled={!Object.keys(draft).length}>
          Restablecer
        </Button>
        <Button type="submit" variant="primary" size="sm">
          Aplicar filtros
        </Button>
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  draft: FilterValues;
  set: (key: string, f: Leaf, v: FilterValue) => void;
};

function Group({ group, id, ...rest }: FieldProps & { group: Extract<SourceFilter, { __typename: "GroupFilter" }> }) {
  const chips = group.filters.every(isChip);
  const active = group.filters.filter((_, j) => rest.draft[`${id}.${j}`]).length;
  return (
    <fieldset className="col-span-full">
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {group.name}
        {active > 0 && <span className="ml-1.5 text-accent">· {active}</span>}
      </legend>
      <div className={chips ? "flex max-h-72 flex-wrap gap-1.5 overflow-y-auto" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        {group.filters.map((f, j) =>
          // Suwayomi solo admite un nivel de anidación.
          f.__typename === "GroupFilter" ? null : <FilterField key={j} filter={f} id={`${id}.${j}`} {...rest} />,
        )}
      </div>
    </fieldset>
  );
}

const NEXT_TRI: Record<TriState, TriState> = { IGNORE: "INCLUDE", INCLUDE: "EXCLUDE", EXCLUDE: "IGNORE" };
const LABEL = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";
const INPUT = "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none transition focus:border-accent";

function FilterField({ filter: f, id, draft, set }: FieldProps & { filter: Leaf }) {
  const v = draft[id] ?? defaultOf(f) ?? {};

  switch (f.__typename) {
    case "HeaderFilter":
      return <p className="col-span-full text-xs text-muted">{f.name}</p>;
    case "SeparatorFilter":
      return <hr className="col-span-full border-border" />;

    case "TriStateFilter": {
      const state = v.triState ?? "IGNORE";
      return (
        <button
          type="button"
          onClick={() => set(id, f, { triState: NEXT_TRI[state] })}
          title={state === "IGNORE" ? "Clic: incluir" : state === "INCLUDE" ? "Clic: excluir" : "Clic: ignorar"}
          className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition ${
            state === "INCLUDE"
              ? "border-success bg-success/15 text-success"
              : state === "EXCLUDE"
                ? "border-danger bg-danger/15 text-danger line-through"
                : "border-border bg-surface text-muted hover:text-fg"
          }`}
        >
          {state === "INCLUDE" ? <Plus className="size-3" /> : state === "EXCLUDE" ? <Minus className="size-3" /> : null}
          {f.name}
        </button>
      );
    }

    case "CheckBoxFilter": {
      const on = !!v.checkBoxState;
      return (
        <button
          type="button"
          onClick={() => set(id, f, { checkBoxState: !on })}
          className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition ${
            on ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-fg"
          }`}
        >
          {on && <Check className="size-3" />}
          {f.name}
        </button>
      );
    }

    case "SelectFilter":
      return (
        <label className="block">
          <span className={LABEL}>{f.name}</span>
          <select className={INPUT} value={v.selectState ?? 0} onChange={(e) => set(id, f, { selectState: +e.target.value })}>
            {f.values.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
      );

    case "TextFilter":
      return (
        <label className="block">
          <span className={LABEL}>{f.name}</span>
          <input className={INPUT} value={v.textState ?? ""} onChange={(e) => set(id, f, { textState: e.target.value })} />
        </label>
      );

    case "SortFilter": {
      const sort = v.sortState ?? { index: 0, ascending: false };
      return (
        <div>
          <span className={LABEL}>{f.name}</span>
          <div className="flex gap-2">
            <select
              className={INPUT}
              value={v.sortState ? sort.index : ""}
              onChange={(e) => set(id, f, { sortState: { ...sort, index: +e.target.value } })}
            >
              {!v.sortState && <option value="">Predeterminado</option>}
              {f.values.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => set(id, f, { sortState: { ...sort, ascending: !sort.ascending } })}
              title={sort.ascending ? "Ascendente" : "Descendente"}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:text-fg"
            >
              {sort.ascending ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </button>
          </div>
        </div>
      );
    }
  }
}
