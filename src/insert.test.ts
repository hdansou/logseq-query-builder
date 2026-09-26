import { describe, expect, it } from "vitest";
import { STATE_KEY, canInsert, deserializeState, planInsert, serializeState, stateSchemaFor } from "./insert";
import { addRow, addTag, emptyQuery, setName, setRow, type PropertyRef, type Query, type TagRef } from "./model";

const project: TagRef = { ident: ":user.class/project-1", title: "project" };
const status: PropertyRef = { ident: ":user.property/status-1", title: "status", type: "default", cardinality: "one" };
const built = (): Query => {
  let q = setName(addTag(emptyQuery(), project), "Open projects");
  q = addRow(q);
  return setRow(q, q.rows[0].id, { property: status, op: "not-contains", values: [{ kind: "text", text: "done" }] });
};

describe("canInsert", () => {
  it("needs a passing guard, a name and a target", () => {
    expect(canInsert({ guard: { ok: true }, name: "x", target: { uuid: "u", mode: "slash" } })).toEqual({ ok: true });
    expect(canInsert({ guard: { ok: false, reason: "r" }, name: "x", target: { uuid: "u", mode: "slash" } })).toEqual({ ok: false, reason: "r" });
    expect(canInsert({ guard: { ok: true }, name: "  ", target: { uuid: "u", mode: "slash" } })).toEqual({ ok: false, reason: "Give the query a name." });
    expect(canInsert({ guard: { ok: true }, name: "x", target: null })).toEqual({ ok: false, reason: "No target block: open the builder from a block or while editing one." });
  });
});

describe("planInsert: the API sequence verified live in docs/probes.md", () => {
  it("shortcut path: new sibling after the editing block, then tag, query, state", () => {
    const plan = planInsert({ uuid: "edit-1", mode: "shortcut" }, "Open projects", "{:query …}", '{"v":1}');
    expect(plan).toEqual([
      { op: "insert-sibling", after: "edit-1", content: "Open projects" },
      { op: "tag", tag: "logseq.class/Query" },
      { op: "property", key: "logseq.property/query", value: "{:query …}" },
      { op: "property", key: STATE_KEY, value: '{"v":1}' },
    ]);
  });
  it("slash path: the block itself gets the name as content, then the same three writes", () => {
    const plan = planInsert({ uuid: "b-1", mode: "slash" }, "Open projects", "{:query …}", '{"v":1}');
    expect(plan[0]).toEqual({ op: "rename", uuid: "b-1", content: "Open projects" });
    expect(plan.slice(1).map((s) => s.op)).toEqual(["tag", "property", "property"]);
  });
});

describe("state round trip", () => {
  it("serialises the query and reads it back identically", () => {
    const q = built();
    expect(deserializeState(serializeState(q))).toEqual(q);
  });
  it("refuses anything that is not a v1 state", () => {
    expect(deserializeState("not json")).toBeNull();
    expect(deserializeState(JSON.stringify({ v: 2, query: {} }))).toBeNull();
    expect(deserializeState(JSON.stringify({ v: 1, query: { name: "x" } }))).toBeNull();
    const old = { v: 1, query: { name: "x", tags: [], inherit: true, rows: [], content: null } };
    expect(deserializeState(JSON.stringify(old))?.scope).toEqual({ kind: "anywhere" });
    expect(deserializeState("")).toBeNull();
  });
});

describe("stateSchemaFor", () => {
  it("creates hidden, hides an existing visible one without touching its type, leaves a hidden one alone", () => {
    expect(stateSchemaFor(null)).toEqual({ type: "string", hide: true });
    expect(stateSchemaFor({ type: "default" })).toEqual({ hide: true });
    expect(stateSchemaFor({ type: "string", hide: true })).toBeNull();
  });
});
