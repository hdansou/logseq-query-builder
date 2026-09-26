/**
 * Builder state. Plain data, pure reducers. Nothing here knows about Datalog or the DOM:
 * emit.ts turns a Query into a query, ui/* turns it into controls.
 */
export type PropertyType = "default" | "number" | "url" | "node" | "asset" | "date" | "datetime" | "checkbox";
export type Cardinality = "one" | "many";
export type Join = "and" | "or";

export interface TagRef { ident: string; title: string }
export interface PropertyRef { ident: string; title: string; type: PropertyType; cardinality: Cardinality }

/** `tag: null` = "any tag" (presence); with `not` it is "untagged". */
export interface TagClause { tag: TagRef | null; not: boolean; join: Join }

export type OperatorId =
  | "contains-any" | "contains-all" | "not-contains"
  | "gt" | "lt" | "between"
  | "eq" | "before" | "on-or-before" | "after" | "on-or-after"
  | "empty" | "not-empty" | "has" | "not-has"
  | "true" | "false";

export type RelativeExpr = "today" | "tomorrow" | "yesterday" | { offset: number; unit: "d" | "w" | "m" | "y" };
export type DateValue = { kind: "absolute"; day: number } | { kind: "relative"; expr: RelativeExpr };

export type Value =
  | { kind: "text"; text: string }
  | { kind: "number"; n: number }
  | { kind: "ref"; uuid: string; title: string }
  | { kind: "date"; date: DateValue };

export interface FilterRow {
  id: string;
  property: PropertyRef | null;
  op: OperatorId | null;
  values: Value[];
  not: boolean;
  join: Join;
}

export type ContentOp = "contains" | "not-contains" | "starts-with" | "matches";
export interface ContentClause { op: ContentOp; value: string }

/**
 * Where to look. `on-page`: the blocks that live on one page. `referenced-in`: nodes referenced
 * from the blocks of one page (the "artists mentioned in my #book page" case). `library`: pages
 * inside the built-in Library and the blocks on them (membership is the :block/parent tree).
 */
export type PageRef = { uuid: string; title: string };
export type Scope =
  | { kind: "anywhere" }
  | { kind: "on-page"; page: PageRef }
  | { kind: "referenced-in"; page: PageRef }
  | { kind: "library" };

/**
 * Reference rows (spec § Reference querying). Direction is the operator; the target is one node,
 * or every node carrying a tag (with inheritance, optionally narrowed by a name fragment). One hop.
 * `under`: the node lives on the target page or on a page beneath it in the page tree.
 */
export type RefDirection = "links-to" | "linked-from" | "ancestor-links-to" | "under";
export type RefTarget =
  | { kind: "node"; uuid: string; title: string }
  | { kind: "tag"; tag: TagRef; name: string };   // name "" = no condition
export interface RefRow { id: string; dir: RefDirection; target: RefTarget | null; not: boolean; join: Join }

export interface Query {
  name: string;
  scope: Scope;
  tags: TagClause[];
  inherit: boolean;
  rows: FilterRow[];
  content: ContentClause | null;
  refs: RefRow[];
}

export const emptyQuery = (): Query => ({ name: "", scope: { kind: "anywhere" }, tags: [], inherit: true, rows: [], content: null, refs: [] });
export const setScope = (q: Query, scope: Scope): Query => ({ ...q, scope });

let nextId = 0;
const newId = () => `row${++nextId}`;
let nextRefId = 0;
const newRefId = () => `ref${++nextRefId}`;

export const addRef = (q: Query): Query =>
  ({ ...q, refs: [...q.refs, { id: newRefId(), dir: "links-to", target: null, not: false, join: "and" }] });
export const removeRef = (q: Query, id: string): Query => ({ ...q, refs: q.refs.filter((r) => r.id !== id) });
export const setRef = (q: Query, id: string, patch: Partial<Omit<RefRow, "id">>): Query =>
  ({ ...q, refs: q.refs.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

export const addTag = (q: Query, tag: TagRef | null): Query =>
  ({ ...q, tags: [...q.tags, { tag, not: false, join: "and" }] });
export const removeTag = (q: Query, index: number): Query =>
  ({ ...q, tags: q.tags.filter((_, i) => i !== index) });
export const setTag = (q: Query, index: number, patch: Partial<TagClause>): Query =>
  ({ ...q, tags: q.tags.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
export const setInherit = (q: Query, inherit: boolean): Query => ({ ...q, inherit });

export const addRow = (q: Query): Query =>
  ({ ...q, rows: [...q.rows, { id: newId(), property: null, op: null, values: [], not: false, join: "and" }] });
export const removeRow = (q: Query, id: string): Query => ({ ...q, rows: q.rows.filter((r) => r.id !== id) });

const patchRow = (q: Query, id: string, f: (r: FilterRow) => FilterRow): Query =>
  ({ ...q, rows: q.rows.map((r) => (r.id === id ? f(r) : r)) });

/** Changing the property invalidates operator and values, since both depend on its type. */
export const setRow = (q: Query, id: string, patch: Partial<Omit<FilterRow, "id">>): Query =>
  patchRow(q, id, (r) => {
    const propertyChanged = patch.property !== undefined && patch.property?.ident !== r.property?.ident;
    return { ...r, ...(propertyChanged ? { op: null, values: [] } : {}), ...patch, id: r.id };
  });
export const toggleNot = (q: Query, id: string): Query => patchRow(q, id, (r) => ({ ...r, not: !r.not }));
export const setJoin = (q: Query, id: string, join: Join): Query => patchRow(q, id, (r) => ({ ...r, join }));

export const setContent = (q: Query, content: ContentClause | null): Query => ({ ...q, content });
export const setName = (q: Query, name: string): Query => ({ ...q, name: name.trim() });
