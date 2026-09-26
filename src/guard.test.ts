import { describe, expect, it } from "vitest";
import { guard } from "./guard";
import { addRow, addTag, emptyQuery, setContent, setJoin, setRow, setScope, setTag, toggleNot, type PropertyRef, type Query, type TagRef } from "./model";

const project: TagRef = { ident: ":user.class/project-1", title: "project" };
const status: PropertyRef = { ident: ":user.property/status-1", title: "status", type: "default", cardinality: "one" };
const row = (q: Query, patch: Parameters<typeof setRow>[2]) => {
  const q2 = addRow(q);
  return setRow(q2, q2.rows[q2.rows.length - 1].id, patch);
};
const todo = { kind: "text", text: "Todo" } as const;

describe("guard", () => {
  it("refuses an empty query", () => {
    expect(guard(emptyQuery())).toEqual({ ok: false, reason: "Add a tag, a filter or a content search." });
  });
  it("accepts a single positive tag, filter or content search", () => {
    expect(guard(addTag(emptyQuery(), project)).ok).toBe(true);
    expect(guard(row(emptyQuery(), { property: status, op: "contains-any", values: [todo] })).ok).toBe(true);
    expect(guard(setContent(emptyQuery(), { op: "contains", value: "x" })).ok).toBe(true);
  });
  it("refuses a query whose only clauses are negations (unbounded)", () => {
    const q = setTag(addTag(emptyQuery(), project), 0, { not: true });
    expect(guard(q)).toEqual({ ok: false, reason: "A NOT clause needs a positive clause to narrow the results." });
    const q2 = row(emptyQuery(), { property: status, op: "not-contains", values: [todo] });
    expect(guard(q2).ok).toBe(false);
    const q3 = row(emptyQuery(), { property: status, op: "empty" });
    expect(guard(q3).ok).toBe(false);
  });
  it("allows negative clauses anywhere once something positive exists (the emitter orders binding first)", () => {
    const q = row(addTag(emptyQuery(), project), { property: status, op: "empty" });
    expect(guard(q).ok).toBe(true);
    const q2 = row(setContent(emptyQuery(), { op: "not-contains", value: "x" }), { property: status, op: "not-has" });
    expect(guard(q2).ok).toBe(true);
    // spec scenario 5: NOT any tag, status is not empty
    const q3 = row(setTag(addTag(emptyQuery(), null), 0, { not: true }), { property: status, op: "not-empty" });
    expect(guard(q3).ok).toBe(true);
  });
  it("refuses a negative clause joined with OR, since that branch cannot bind on its own", () => {
    let q = row(row(emptyQuery(), { property: status, op: "contains-any", values: [todo] }), { property: status, op: "not-contains", values: [todo] });
    q = setJoin(q, q.rows[1].id, "or");
    expect(guard(q)).toEqual({ ok: false, reason: "A NOT clause can only be combined with AND." });
    let t = addTag(addTag(emptyQuery(), project), project);
    t = setTag(t, 1, { not: true, join: "or" });
    expect(guard(t).ok).toBe(false);
  });
  it("treats a NOT-toggled positive row as negative", () => {
    let q = row(emptyQuery(), { property: status, op: "contains-any", values: [todo] });
    q = toggleNot(q, q.rows[0].id);
    expect(guard(q).ok).toBe(false);
  });
  it("ignores unfilled rows (no property, no operator, or too few values)", () => {
    const q = row(addTag(emptyQuery(), project), { property: status });
    expect(guard(q).ok).toBe(true);
    const q2 = row(emptyQuery(), { property: status, op: "contains-any", values: [] });
    expect(guard(q2)).toEqual({ ok: false, reason: "Add a tag, a filter or a content search." });
  });
});

describe("guard with a scope", () => {
  it("a scope alone is a runnable, positive query, and lets NOT-only filters run", () => {
    expect(guard(setScope(emptyQuery(), { kind: "library" })).ok).toBe(true);
    const q = row(setScope(emptyQuery(), { kind: "referenced-in", page: { uuid: "u", title: "Book" } }), { property: status, op: "not-contains", values: [todo] });
    expect(guard(q).ok).toBe(true);
  });
});
