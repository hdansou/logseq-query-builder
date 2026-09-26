import { absoluteLiteral, bounds, relativeInput, type Boundary } from "./dates";
import { guard, rowComplete, rowPositive, tagPositive } from "./guard";
import { str } from "./edn";
import type { ContentClause, DateValue, FilterRow, Join, PropertyRef, Query, TagClause, Value } from "./model";

/**
 * Builder state → Datalog. One emitter for the preview (narrow pull, inputs passed as strings,
 * rules passed as a string input) and for the inserted block (full pull, `:inputs` keywords,
 * `%` filled by the host). Every form here was verified live; see docs/probes.md.
 */
export interface Emitted {
  where: string[];
  inputs: string[];       // input keywords, e.g. ":+30d-end", in ?in1.. order
  rules: boolean;         // whether `%` (class-extends) is needed
  block: string;          // the :logseq.property/query text
  preview: { query: string; inputs: string[] };
}

/** Leading space on purpose: a string input starting with `[[` is taken for a page ref. */
export const RULES = ` [[(class-extends ?p ?c) [?c :logseq.property.class/extends ?p]]
 [(class-extends ?p ?c) [?t :logseq.property.class/extends ?p] (class-extends ?t ?c)]] `;

const PREVIEW_PULL = "(pull ?b [:block/uuid :block/title {:block/page [:block/uuid :block/title]}])";
const BLOCK_PULL = "(pull ?b [*])";

/**
 * Variables are numbered by clause: tag i uses ?tagI/?tI, row n uses ?vN/?xN/?eN (contains-all
 * values ?vN_K). Input vars ?in1.. are shared and deduplicated by keyword.
 */
class Ctx {
  private byInput = new Map<string, string>();
  inputs: string[] = [];
  rules = false;
  input(keyword: string) {
    const hit = this.byInput.get(keyword);
    if (hit) return hit;
    this.inputs.push(keyword);
    const v = `?in${this.inputs.length}`;
    this.byInput.set(keyword, v);
    return v;
  }
}

interface Clause { text: string; positive: boolean; join: Join }

/** Which attribute on a ref value entity carries the comparable scalar. */
function valueAttr(p: PropertyRef): string {
  switch (p.type) {
    case "number": return ":logseq.property/value";
    case "node": case "asset": return ":block/uuid";
    default: return ":block/title";
  }
}
const isRef = (p: PropertyRef) => p.type !== "datetime" && p.type !== "checkbox";

function literal(v: Value): string {
  switch (v.kind) {
    case "text": return str(v.text);
    case "number": return String(v.n);
    case "ref": return `#uuid "${v.uuid}"`;
    case "date": throw new Error("date values go through dateTerm");
  }
}

function dateTerm(d: DateValue, boundary: Boundary, ctx: Ctx): string {
  return d.kind === "relative" ? ctx.input(relativeInput(d.expr, boundary)) : String(absoluteLiteral(d.day, boundary));
}

function tagClause(t: TagClause, i: number, inherit: boolean, ctx: Ctx): Clause {
  let text: string;
  if (!t.tag) text = "[?b :block/tags _]";
  else if (!inherit) text = `[?b :block/tags ${t.tag.ident}]`;
  else {
    const tag = `?tag${i}`, tv = `?t${i}`;
    ctx.rules = true;
    text = `[${tag} :db/ident ${t.tag.ident}] [?b :block/tags ${tv}] (or [(= ${tv} ${tag})] (class-extends ${tag} ${tv}))`;
  }
  return { text: t.not ? `(not ${text})` : text, positive: tagPositive(t), join: t.join };
}

function rowClause(r: FilterRow, n: number, ctx: Ctx): Clause {
  const p = r.property!, P = p.ident, op = r.op!;
  const v = `?v${n}`, x = `?x${n}`, e = `?e${n}`;
  const set = (vals: Value[]) => `#{${vals.map(literal).join(" ")}}`;
  let text: string;
  switch (op) {
    case "contains-any":
      text = `[?b ${P} ${v}] [${v} ${valueAttr(p)} ${x}] [(contains? ${set(r.values)} ${x})]`; break;
    case "contains-all":
      text = r.values.map((val, k) => `[?b ${P} ${v}_${k + 1}] [${v}_${k + 1} ${valueAttr(p)} ${literal(val)}]`).join(" "); break;
    case "not-contains":
      text = `(not [?b ${P} ${v}] [${v} ${valueAttr(p)} ${x}] [(contains? ${set(r.values)} ${x})])`; break;
    case "gt": case "lt":
      text = `[?b ${P} ${v}] [${v} :logseq.property/value ${x}] [(${op === "gt" ? ">" : "<"} ${x} ${literal(r.values[0])})]`; break;
    case "between":
      text = p.type === "number"
        ? `[?b ${P} ${v}] [${v} :logseq.property/value ${x}] [(>= ${x} ${literal(r.values[0])})] [(<= ${x} ${literal(r.values[1])})]`
        : dateClause(r, n, ctx);
      break;
    case "eq": case "before": case "on-or-before": case "after": case "on-or-after":
      text = dateClause(r, n, ctx); break;
    case "empty":
      text = isRef(p) ? `(or (not [?b ${P} _]) [?b ${P} :logseq.property/empty-placeholder])` : `(not [?b ${P} _])`; break;
    case "not-empty":
      text = isRef(p) ? `[${e} :db/ident :logseq.property/empty-placeholder] [?b ${P} ${v}] [(not= ${v} ${e})]` : `[?b ${P} _]`; break;
    case "has": text = `[?b ${P} _]`; break;
    case "not-has": text = `(not [?b ${P} _])`; break;
    case "true": case "false": text = `[?b ${P} ${op}]`; break;
  }
  return { text: r.not ? `(not ${text})` : text, positive: rowPositive(r), join: r.join };
}

/** `:date` values are journal pages, so bind their day; `:datetime` values are the ms themselves. */
function dateClause(r: FilterRow, n: number, ctx: Ctx): string {
  const p = r.property!, dates = r.values.map((val) => (val as { kind: "date"; date: DateValue }).date);
  const g = p.type === "date" ? "day" : "ms";
  const v = `?v${n}`, x = `?x${n}`;
  const bind = g === "day" ? `[?b ${p.ident} ${v}] [${v} :block/journal-day ${x}]` : `[?b ${p.ident} ${x}]`;
  const cmps = bounds(r.op!, dates, g).map((b) => `[(${b.cmp} ${x} ${dateTerm(b.value, b.boundary, ctx)})]`);
  return [bind, ...cmps].join(" ");
}

function contentClause(c: ContentClause): Clause {
  const lower = `[?b :block/title ?title] [(clojure.string/lower-case ?title) ?lt]`;
  const v = str(c.value.toLowerCase());
  let text: string;
  switch (c.op) {
    case "contains": text = `${lower} [(clojure.string/includes? ?lt ${v})]`; break;
    case "not-contains": text = `${lower} (not [(clojure.string/includes? ?lt ${v})])`; break;
    case "starts-with": text = `${lower} [(clojure.string/starts-with? ?lt ${v})]`; break;
    case "matches": text = `[?b :block/title ?title] [(re-pattern ${str(c.value)}) ?re] [(re-find ?re ?title)]`; break;
  }
  return { text, positive: true, join: "and" };
}

const inputVars = (s: string) => [...new Set(s.match(/\?in\d+/g) ?? [])].sort();

/** Flat left-to-right composition: AND accumulates, OR nests the accumulation in an or-join. */
function fold(clauses: Clause[]): Clause[] {
  const out: Clause[] = [];
  for (const c of clauses) {
    if (out.length && c.join === "or") {
      const acc = out.splice(0).map((x) => x.text).join(" ");
      const vars = ["?b", ...inputVars(acc + c.text)].join(" ");
      out.push({ text: `(or-join [${vars}] (and ${acc}) (and ${c.text}))`, positive: true, join: "and" });
    } else out.push(c);
  }
  return out;
}

export function emit(q: Query): Emitted {
  const g = guard(q);
  if (!g.ok) throw new Error(`guard: ${g.reason}`);
  const ctx = new Ctx();
  const tags = fold(q.tags.map((t, i) => tagClause(t, i + 1, q.inherit, ctx)));
  const content = q.content ? [contentClause(q.content)] : [];
  const rows = fold(q.rows.filter(rowComplete).map((r, i) => rowClause(r, i + 1, ctx)));
  // Positive clauses bind ?b; negations must follow them. Order within a conjunction is free.
  const all = [...tags, ...content, ...rows];
  const where = [...all.filter((c) => c.positive), ...all.filter((c) => !c.positive)].map((c) => c.text);

  const ins = ctx.inputs.map((_, i) => `?in${i + 1}`);
  const inClause = ins.length || ctx.rules ? `:in $ ${[...ins, ...(ctx.rules ? ["%"] : [])].join(" ")}` : "";
  const block =
    `{:query [:find ${BLOCK_PULL}` + (inClause ? `\n ${inClause}` : "") + `\n :where\n ${where.join("\n ")}]` +
    (ctx.inputs.length ? `\n :inputs [${ctx.inputs.join(" ")}]` : "") + `}`;
  const preview = {
    query: `[:find ${PREVIEW_PULL}${inClause ? ` ${inClause}` : ""} :where ${where.join(" ")}]`,
    inputs: [...ctx.inputs, ...(ctx.rules ? [RULES] : [])],
  };
  return { where, inputs: ctx.inputs, rules: ctx.rules, block, preview };
}
