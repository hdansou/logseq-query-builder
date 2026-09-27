import { absoluteLiteral, bounds, relativeInput, type Boundary } from "./dates";
import { guard, refComplete, refPositive, rowComplete, rowPositive, tagPositive } from "./guard";
import { contextPull } from "./context";
import { str } from "./edn";
import type { ContentClause, DateValue, FilterRow, Join, PropertyRef, Query, RefRow, Scope, TagClause, Value } from "./model";

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
 [(class-extends ?p ?c) [?t :logseq.property.class/extends ?p] (class-extends ?t ?c)]
 [(parent ?p ?c) [?c :block/parent ?p]]
 [(parent ?p ?c) [?t :block/parent ?p] (parent ?t ?c)]] `;

const previewPull = (q: Query) => {
  const ctx = contextPull(q.rows.flatMap((r) => (r.property ? [r.property] : [])));
  return `(pull ?b [:block/uuid :block/title {:block/page [:block/uuid :block/title]} {:block/refs [:block/uuid :block/title]}${ctx ? " " + ctx : ""}])`;
};
const BLOCK_PULL = "(pull ?b [*])";

/**
 * Identifiers embedded verbatim in the query text come from the graph (idents, uuids) or from a
 * block's saved state, which travels with a shared graph. Only a safe character set is accepted,
 * so a crafted value cannot close the literal and append clauses (fail fast, no repair).
 */
const uuidLit = (u: string): string => {
  if (!/^[0-9A-Za-z-]+$/.test(u)) throw new Error(`invalid uuid: ${JSON.stringify(u)}`);
  return `#uuid "${u}"`;
};
const ident = (i: string): string => {
  if (!/^:[\w.*+!?$%&=<>/-]+$/.test(i)) throw new Error(`invalid ident: ${JSON.stringify(i)}`);
  return i;
};

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
    case "ref": return uuidLit(v.uuid);
    case "date": throw new Error("date values go through dateTerm");
  }
}

function dateTerm(d: DateValue, boundary: Boundary, ctx: Ctx): string {
  return d.kind === "relative" ? ctx.input(relativeInput(d.expr, boundary)) : String(absoluteLiteral(d.day, boundary));
}

function tagClause(t: TagClause, i: number, inherit: boolean, ctx: Ctx): Clause {
  let text: string;
  if (!t.tag) text = "[?b :block/tags _]";
  else if (!inherit) text = `[?b :block/tags ${ident(t.tag.ident)}]`;
  else {
    const tag = `?tag${i}`, tv = `?t${i}`;
    ctx.rules = true;
    text = `[${tag} :db/ident ${ident(t.tag.ident)}] [?b :block/tags ${tv}] (or [(= ${tv} ${tag})] (class-extends ${tag} ${tv}))`;
  }
  return { text: t.not ? `(not ${text})` : text, positive: tagPositive(t), join: t.join };
}

/** `n` tags the row's variables (`1`, or `r1_2` for a target's second condition); `s` is the subject. */
function rowClause(r: FilterRow, n: string, ctx: Ctx, s = "?b"): Clause {
  const p = r.property!, P = ident(p.ident), op = r.op!;
  const v = `?v${n}`, x = `?x${n}`, e = `?e${n}`;
  const set = (vals: Value[]) => `#{${vals.map(literal).join(" ")}}`;
  let text: string;
  switch (op) {
    case "contains-any":
      text = `[${s} ${P} ${v}] [${v} ${valueAttr(p)} ${x}] [(contains? ${set(r.values)} ${x})]`; break;
    case "contains-all":
      text = r.values.map((val, k) => `[${s} ${P} ${v}_${k + 1}] [${v}_${k + 1} ${valueAttr(p)} ${literal(val)}]`).join(" "); break;
    case "not-contains":
      text = `(not [${s} ${P} ${v}] [${v} ${valueAttr(p)} ${x}] [(contains? ${set(r.values)} ${x})])`; break;
    case "gt": case "lt":
      text = `[${s} ${P} ${v}] [${v} :logseq.property/value ${x}] [(${op === "gt" ? ">" : "<"} ${x} ${literal(r.values[0])})]`; break;
    case "between":
      text = p.type === "number"
        ? `[${s} ${P} ${v}] [${v} :logseq.property/value ${x}] [(>= ${x} ${literal(r.values[0])})] [(<= ${x} ${literal(r.values[1])})]`
        : dateClause(r, n, ctx, s);
      break;
    case "eq": case "before": case "on-or-before": case "after": case "on-or-after":
      text = dateClause(r, n, ctx, s); break;
    case "empty":
      text = isRef(p) ? `(or (not [${s} ${P} _]) [${s} ${P} :logseq.property/empty-placeholder])` : `(not [${s} ${P} _])`; break;
    case "not-empty":
      text = isRef(p) ? `[${e} :db/ident :logseq.property/empty-placeholder] [${s} ${P} ${v}] [(not= ${v} ${e})]` : `[${s} ${P} _]`; break;
    case "has": text = `[${s} ${P} _]`; break;
    case "not-has": text = `(not [${s} ${P} _])`; break;
    case "true": case "false": text = `[${s} ${P} ${op}]`; break;
  }
  return { text: r.not ? `(not ${text})` : text, positive: rowPositive(r), join: r.join };
}

/** `:date` values are journal pages, so bind their day; `:datetime` values are the ms themselves. */
function dateClause(r: FilterRow, n: string, ctx: Ctx, s: string): string {
  const p = r.property!, dates = r.values.map((val) => (val as { kind: "date"; date: DateValue }).date);
  const g = p.type === "date" ? "day" : "ms";
  const v = `?v${n}`, x = `?x${n}`;
  const bind = g === "day" ? `[${s} ${ident(p.ident)} ${v}] [${v} :block/journal-day ${x}]` : `[${s} ${ident(p.ident)} ${x}]`;
  const cmps = bounds(r.op!, dates, g).map((b) => `[(${b.cmp} ${x} ${dateTerm(b.value, b.boundary, ctx)})]`);
  return [bind, ...cmps].join(" ");
}

/** Everything beneath `page` in the `:block/parent` tree: child pages and their blocks, any depth. */
function underClause(page: string, ctx: Ctx): string {
  ctx.rules = true;
  return `(parent ${page} ?b) (not [?b :logseq.property/created-from-property _])`;
}

/** Scope clauses bind ?b, so they are positive. `on-page`: ?b lives on the page. `library`: ?b is under the built-in Library page. */
function scopeClause(scope: Scope, ctx: Ctx): Clause | null {
  switch (scope.kind) {
    case "anywhere": return null;
    case "on-page":
      return { text: `[?src :block/uuid ${uuidLit(scope.page.uuid)}] [?b :block/page ?src]`, positive: true, join: "and" };
    case "library":
      return { text: `[?lib :block/name "library"] [?lib :logseq.property/built-in? true] ${underClause("?lib", ctx)}`, positive: true, join: "and" };
  }
}

/** Blocks on the host's hidden `$$$views` pages are not results, as in the Linked References panel. */
const hiddenClause = (n: number) => `(not [?b :block/page ?hp${n}] [?hp${n} :block/name ?hn${n}] [(clojure.string/starts-with? ?hn${n} "$$$")])`;

/**
 * Reference rows (SPEC §10). The target set binds ?rN: one node, or every node carrying a tag
 * (inherited like the tag selector), optionally narrowed by a title fragment. Then one clause per
 * direction. Tags applied to a block and its property keys sit in `:block/refs` too, so they are
 * excluded where they would read as links.
 */
function refClause(r: RefRow, n: number, inherit: boolean, ctx: Ctx): Clause {
  const t = `?r${n}`, target = r.target!;
  let bind: string;
  if (target.kind === "node") bind = `[${t} :block/uuid ${uuidLit(target.uuid)}]`;
  else {
    if (!inherit) bind = `[${t} :block/tags ${ident(target.tag.ident)}]`;
    else {
      ctx.rules = true;
      bind = `[?rtag${n} :db/ident ${ident(target.tag.ident)}] [${t} :block/tags ?rtv${n}] (or [(= ?rtv${n} ?rtag${n})] (class-extends ?rtag${n} ?rtv${n}))`;
    }
    if (target.name.trim()) bind += ` [${t} :block/title ?rt${n}] [(clojure.string/lower-case ?rt${n}) ?rl${n}] [(clojure.string/includes? ?rl${n} ${str(target.name.trim().toLowerCase())})]`;
    // Property conditions on the target set: the row emitter with ?rN as subject, positive ones first.
    const conds = fold(target.rows.filter(rowComplete).map((row, k) => rowClause(row, `r${n}_${k + 1}`, ctx, t)), t);
    for (const c of [...conds.filter((c) => c.positive), ...conds.filter((c) => !c.positive)]) bind += ` ${c.text}`;
  }
  let text: string;
  switch (r.dir) {
    case "links-to":
      text = `${bind} [?b :block/refs ${t}] (not [?b :block/tags ${t}]) ${hiddenClause(n)}`; break;
    case "linked-from":
      text = `${bind} (or [(identity ${t}) ?s${n}] [?s${n} :block/page ${t}]) [?s${n} :block/refs ?b] (not [?s${n} :block/tags ?b]) (not [?b :block/tags :logseq.class/Property])`; break;
    case "ancestor-links-to":
      ctx.rules = true;
      text = `${bind} [?a${n} :block/refs ${t}] (or-join [?a${n} ?b] [(identity ?a${n}) ?b] (parent ?a${n} ?b)) ${hiddenClause(n)}`; break;
    case "under":
      text = `${bind} ${underClause(t, ctx)}`; break;
  }
  return { text: r.not ? `(not ${text})` : text, positive: refPositive(r), join: r.join };
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

/** Flat left-to-right composition: AND accumulates, OR nests the accumulation in an or-join over the subject. */
function fold(clauses: Clause[], subject = "?b"): Clause[] {
  const out: Clause[] = [];
  for (const c of clauses) {
    if (out.length && c.join === "or") {
      const acc = out.splice(0).map((x) => x.text).join(" ");
      const vars = [subject, ...inputVars(acc + c.text)].join(" ");
      out.push({ text: `(or-join [${vars}] (and ${acc}) (and ${c.text}))`, positive: true, join: "and" });
    } else out.push(c);
  }
  return out;
}

export function emit(q: Query): Emitted {
  const g = guard(q);
  if (!g.ok) throw new Error(`guard: ${g.reason}`);
  const ctx = new Ctx();
  const scope = scopeClause(q.scope, ctx);
  const tags = fold(q.tags.map((t, i) => tagClause(t, i + 1, q.inherit, ctx)));
  const content = q.content ? [contentClause(q.content)] : [];
  const rows = fold(q.rows.filter(rowComplete).map((r, i) => rowClause(r, String(i + 1), ctx)));
  const refs = fold(q.refs.filter(refComplete).map((r, i) => refClause(r, i + 1, q.inherit, ctx)));
  // Positive clauses bind ?b; negations must follow them. Order within a conjunction is free.
  const all = [...(scope ? [scope] : []), ...tags, ...content, ...rows, ...refs];
  const where = [...all.filter((c) => c.positive), ...all.filter((c) => !c.positive)].map((c) => c.text);

  const ins = ctx.inputs.map((_, i) => `?in${i + 1}`);
  const inClause = ins.length || ctx.rules ? `:in $ ${[...ins, ...(ctx.rules ? ["%"] : [])].join(" ")}` : "";
  const block =
    `{:query [:find ${BLOCK_PULL}` + (inClause ? `\n ${inClause}` : "") + `\n :where\n ${where.join("\n ")}]` +
    (ctx.inputs.length ? `\n :inputs [${ctx.inputs.join(" ")}]` : "") + `}`;
  const preview = {
    query: `[:find ${previewPull(q)}${inClause ? ` ${inClause}` : ""} :where ${where.join(" ")}]`,
    inputs: [...ctx.inputs, ...(ctx.rules ? [RULES] : [])],
  };
  return { where, inputs: ctx.inputs, rules: ctx.rules, block, preview };
}
