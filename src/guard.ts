import { contentActive, type FilterRow, type OperatorId, type Query, type RefRow, type TagClause } from "./model";
import { arityOf } from "./operators";

/**
 * Whether a query can run at all. A negation or an `or` branch cannot bind ?b by itself, so:
 * at least one positive clause must exist (the emitter puts positive clauses first), and anything
 * joined with OR must be positive. The UI shows `reason` in the amber bar and disables Insert.
 */
export type GuardResult = { ok: true } | { ok: false; reason: string };

const NEGATIVE_OPS: ReadonlySet<OperatorId> = new Set(["not-contains", "empty", "not-has"]);

/** A row takes part only when it is complete: property, operator and enough values. */
export function rowComplete(r: FilterRow): boolean {
  if (!r.property || !r.op) return false;
  const arity = arityOf(r.op);
  return arity === "many" ? r.values.length > 0 : r.values.length >= arity;
}

export const rowPositive = (r: FilterRow): boolean => !r.not && !NEGATIVE_OPS.has(r.op as OperatorId);
export const tagPositive = (t: TagClause): boolean => !t.not;
/** A reference row takes part once it has a target; it binds ?b unless negated. */
export const refComplete = (r: RefRow): boolean => r.target !== null;
export const refPositive = (r: RefRow): boolean => !r.not;

const EMPTY = "Add a tag, a filter, a reference or a content search.";
const POSITIVE = "A NOT clause needs a positive clause to narrow the results.";
const OR = "A NOT clause can only be combined with AND.";

export function guard(q: Query): GuardResult {
  const rows = q.rows.filter(rowComplete);
  const refs = q.refs.filter(refComplete);
  const scoped = q.scope.kind !== "anywhere";
  if (!scoped && q.tags.length === 0 && rows.length === 0 && refs.length === 0 && !contentActive(q.content)) return { ok: false, reason: EMPTY };

  if (q.tags.slice(1).some((t) => t.join === "or" && !tagPositive(t))) return { ok: false, reason: OR };
  if (rows.slice(1).some((r) => r.join === "or" && !rowPositive(r))) return { ok: false, reason: OR };
  if (refs.slice(1).some((r) => r.join === "or" && !refPositive(r))) return { ok: false, reason: OR };
  const positive = scoped || q.tags.some(tagPositive) || contentActive(q.content) || rows.some(rowPositive) || refs.some(refPositive);
  return positive ? { ok: true } : { ok: false, reason: POSITIVE };
}
