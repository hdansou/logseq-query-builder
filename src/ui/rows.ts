import { parseRelative } from "../dates";
import type { PropertyInfo } from "../graph";
import { removeRow, setJoin, setRow, toggleNot, type FilterRow, type OperatorId, type Value } from "../model";
import { OPERATORS, arityOf, controlFor, operatorsFor } from "../operators";
import { valueText } from "../readback";
import { createPicker, type Option } from "./picker";
import type { Ctx, ZoneRenderer } from "./render";

/** Filter rows: property · operator · value, with per-row AND/OR and NOT. Controls come from operators.ts. */

const el = (tag: string, cls?: string, text?: string) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

/** AND/OR as a toggle button: Enter or click flips it, no native popup to fight the keyboard. */
export function joinToggle(fid: string, join: "and" | "or", onChange: (j: "and" | "or") => void) {
  const b = el("button", "tog on join", join.toUpperCase()) as HTMLButtonElement;
  b.dataset.fid = fid; b.title = "Toggle AND / OR";
  b.addEventListener("click", () => onChange(join === "and" ? "or" : "and"));
  return b;
}

/** Text typed into a date control: a relative expression or an ISO day. */
export function parseDateText(text: string): Value | null {
  const rel = parseRelative(text);
  if (rel) return { kind: "date", date: { kind: "relative", expr: rel } };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (m) return { kind: "date", date: { kind: "absolute", day: Number(m[1] + m[2] + m[3]) } };
  return null;
}

const DATE_SHORTCUTS = ["today", "tomorrow", "yesterday", "-7d", "+7d", "-30d", "+30d", "-1w", "+1m"];
function dateText(v: Value | undefined): string {
  if (!v || v.kind !== "date") return "";
  if (v.date.kind === "relative") return typeof v.date.expr === "string" ? v.date.expr : `${v.date.expr.offset > 0 ? "+" : ""}${v.date.expr.offset}${v.date.expr.unit}`;
  const d = String(v.date.day);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function scalarInput(kind: "number" | "date", fid: string, current: Value | undefined, onValue: (v: Value | null) => void) {
  const input = document.createElement("input");
  input.dataset.fid = fid;
  if (kind === "number") {
    input.type = "number"; input.className = "num"; input.placeholder = "number";
    input.value = current?.kind === "number" ? String(current.n) : "";
    input.addEventListener("change", () => onValue(input.value === "" ? null : { kind: "number", n: Number(input.value) }));
  } else {
    input.type = "text"; input.className = "date"; input.placeholder = "today, -7d, 2026-10-02";
    input.setAttribute("list", "qb-date-shortcuts");
    input.autocomplete = "off";
    input.value = dateText(current);
    input.addEventListener("change", () => { const v = parseDateText(input.value); if (v || input.value.trim() === "") onValue(v); else input.setCustomValidity("today, tomorrow, yesterday, ±Nd/w/m/y, or YYYY-MM-DD"); });
    input.addEventListener("input", () => input.setCustomValidity(""));
  }
  return input;
}

function ensureDatalist() {
  if (document.getElementById("qb-date-shortcuts")) return;
  const dl = document.createElement("datalist"); dl.id = "qb-date-shortcuts";
  for (const s of DATE_SHORTCUTS) { const o = document.createElement("option"); o.value = s; dl.appendChild(o); }
  document.body.appendChild(dl);
}

function valueControls(r: FilterRow, { store, graph }: Ctx): HTMLElement[] {
  const p = r.property!, op = r.op!, arity = arityOf(op), control = controlFor(p.type);
  const setValues = (values: Value[]) => store.update((q) => setRow(q, r.id, { values }));
  const setAt = (i: number) => (v: Value | null) => { const values = [...r.values]; if (v) values[i] = v; else values.splice(i, 1); setValues(values); };
  if (arity === 0 || control === "none") return [];

  if (arity === 1 || arity === 2) {
    const kind = control === "date" ? "date" : "number";
    if (kind === "date") ensureDatalist();
    const out: HTMLElement[] = [scalarInput(kind, `row-val-${r.id}`, r.values[0], setAt(0))];
    if (arity === 2) out.push(el("span", "", "and"), scalarInput(kind, `row-val2-${r.id}`, r.values[1], setAt(1)));
    return out;
  }

  // arity "many": chips + a picker (text/number allow free entry; node/asset pick real nodes)
  const out: HTMLElement[] = r.values.map((v, k) => {
    const chip = el("span", "chip"); chip.appendChild(el("span", "", valueText(v)));
    const x = el("button", "x", "×") as HTMLButtonElement; x.dataset.fid = `row-chip-${r.id}-${k}`; x.title = "Remove value";
    x.addEventListener("click", () => setValues(r.values.filter((_, j) => j !== k)));
    chip.appendChild(x);
    return chip;
  });
  const add = (v: Value) => setValues([...r.values, v]);
  const has = (v: Value) => r.values.some((x) => valueText(x) === valueText(v));
  const pickerFor = (): HTMLElement => {
    const fid = `row-vpick-${r.id}`;
    switch (control) {
      case "node": return createPicker<Value>({
        fid, placeholder: "search nodes…", width: "180px",
        search: async (t) => (await graph.nodes(t)).map((n) => ({ id: n.uuid, label: n.title, hint: n.page?.title, value: { kind: "ref", uuid: n.uuid, title: n.title } })),
        onPick: (o) => { if (!has(o.value)) add(o.value); },
      });
      case "asset": return createPicker<Value>({
        fid, placeholder: "asset…", width: "180px",
        options: async () => (await graph.assets()).map((a) => ({ id: a.uuid, label: a.title, value: { kind: "ref", uuid: a.uuid, title: a.title } })),
        onPick: (o) => { if (!has(o.value)) add(o.value); },
      });
      default: {
        const toValue = (label: string): Value => (control === "number" ? { kind: "number", n: Number(label) } : { kind: "text", text: label });
        return createPicker<Value>({
          fid, placeholder: control === "number" ? "number…" : "value…", width: "160px",
          options: async () => (await graph.values(p)).map((v) => ({ id: v.uuid, label: v.label, hint: `${v.count}`, value: toValue(v.label) })),
          onPick: (o) => { if (!has(o.value)) add(o.value); },
          onFree: (t) => { if (control === "number" && Number.isNaN(Number(t))) return; const v = toValue(t); if (!has(v)) add(v); },
        });
      }
    }
  };
  out.push(pickerFor());
  return out;
}

function renderRow(r: FilterRow, i: number, s: Parameters<ZoneRenderer>[1], ctx: Ctx): HTMLElement {
  const { store, graph } = ctx;
  const line = el("div", "row");
  if (i > 0) line.appendChild(joinToggle(`row-join-${r.id}`, r.join, (j) => store.update((q) => setJoin(q, r.id, j))));
  else line.appendChild(el("span", "spacer", "where"));

  const not = el("button", "tog" + (r.not ? " on" : ""), r.not ? "NOT" : "IS") as HTMLButtonElement;
  not.dataset.fid = `row-not-${r.id}`; not.title = "Toggle NOT";
  not.addEventListener("click", () => store.update((q) => toggleNot(q, r.id)));
  line.appendChild(not);

  const selectedTags = s.q.tags.flatMap((t) => (t.tag ? [t.tag.ident] : []));
  line.appendChild(createPicker<PropertyInfo>({
    fid: `row-prop-${r.id}`, placeholder: "property…", initial: r.property?.title ?? "", showAllOnFocus: true, width: "150px",
    options: async () => (await graph.properties(selectedTags)).map((p) => ({
      id: p.ident, label: p.title, hint: p.owners.some((o) => selectedTags.includes(o)) ? `${p.type} · ${s.q.tags.find((t) => t.tag && p.owners.includes(t.tag.ident))?.tag?.title}` : p.type, value: p,
    })),
    // Picking a property also picks the type's first operator, so the value control appears at once.
    onPick: (o) => {
      store.update((q) => setRow(q, r.id, { property: { ident: o.value.ident, title: o.value.title, type: o.value.type, cardinality: o.value.cardinality }, op: operatorsFor(o.value.type)[0], values: [] }));
      document.querySelector<HTMLElement>(`[data-fid="row-op-${r.id}"]`)?.focus();   // render is synchronous
    },
  }));

  if (r.property) {
    const type = r.property.type;
    line.appendChild(createPicker<OperatorId>({
      fid: `row-op-${r.id}`, placeholder: "operator…", initial: r.op ? OPERATORS[r.op].label : "", showAllOnFocus: true, width: "130px",
      options: async () => operatorsFor(type).map((id) => ({ id, label: OPERATORS[id].label, value: id })),
      onPick: (o) => {
        const keep = r.op && arityOf(r.op) === arityOf(o.value);
        store.update((q) => setRow(q, r.id, { op: o.value, values: keep ? r.values : [] }));
        (document.querySelector<HTMLElement>(`[data-fid="row-val-${r.id}"], [data-fid="row-vpick-${r.id}"]`) ?? document.querySelector<HTMLElement>(`[data-fid="row-x-${r.id}"]`))?.focus();
      },
    }));
  }
  if (r.property && r.op) for (const c of valueControls(r, ctx)) line.appendChild(c);

  const x = el("button", "x", "×") as HTMLButtonElement; x.dataset.fid = `row-x-${r.id}`; x.title = "Remove filter";
  x.addEventListener("click", () => store.update((q) => removeRow(q, r.id)));
  line.appendChild(x);
  return line;
}

/** Put the cursor in a row's property picker (the store renders synchronously, so no timer). */
export function focusRow(id: string) {
  document.querySelector<HTMLElement>(`[data-fid="row-prop-${id}"]`)?.focus();
}

export const renderRows: ZoneRenderer = (root, s, ctx) => {
  root.innerHTML = "";
  const label = el("div", "zone-label", "Filters");
  const hint = el("span", "hint", "AND / OR per row, flat left to right"); label.appendChild(hint);
  root.appendChild(label);
  s.q.rows.forEach((r, i) => root.appendChild(renderRow(r, i, s, ctx)));
  const add = el("button", "btn", s.q.rows.length ? "+ filter" : "+ add a filter") as HTMLButtonElement;
  add.dataset.fid = "add-row";
  add.addEventListener("click", () => focusRow(ctx.store.addRow()));
  root.appendChild(add);
};
