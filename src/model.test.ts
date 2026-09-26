import { describe, expect, it } from "vitest";
import {
  addRef, addRow, addTag, emptyQuery, removeRef, removeRow, removeTag, setContent, setInherit, setJoin, setName,
  setRef, setRow, setScope, toggleNot, type PropertyRef, type Query, type TagRef,
} from "./model";

const project: TagRef = { ident: ":user.class/project-Kq9x2mzp", title: "project" };
const status: PropertyRef = { ident: ":user.property/status-Xab12cde", title: "status", type: "default", cardinality: "one" };

describe("emptyQuery", () => {
  it("has no name, no tags, no rows, no content, inheritance on", () => {
    expect(emptyQuery()).toEqual({ name: "", scope: { kind: "anywhere" }, tags: [], inherit: true, rows: [], content: null, refs: [] });
  });
});

describe("reducers are pure", () => {
  it("never mutate the input", () => {
    const q = emptyQuery();
    const q2 = addTag(q, project);
    expect(q.tags).toEqual([]);
    expect(q2.tags).toHaveLength(1);
  });
});

describe("tags", () => {
  it("adds with join AND and not=false; the first join is irrelevant but stored as AND", () => {
    const q = addTag(emptyQuery(), project);
    expect(q.tags[0]).toEqual({ tag: project, not: false, join: "and" });
  });
  it("addTag with null means 'any tag' (presence)", () => {
    const q = addTag(emptyQuery(), null);
    expect(q.tags[0].tag).toBeNull();
  });
  it("removes by index and toggles inherit", () => {
    const q = removeTag(addTag(addTag(emptyQuery(), project), null), 0);
    expect(q.tags.map((t) => t.tag)).toEqual([null]);
    expect(setInherit(q, false).inherit).toBe(false);
  });
});

describe("rows", () => {
  it("addRow appends an unfilled row with a unique id", () => {
    const q = addRow(addRow(emptyQuery()));
    expect(q.rows).toHaveLength(2);
    expect(q.rows[0].id).not.toEqual(q.rows[1].id);
    expect(q.rows[1]).toMatchObject({ property: null, op: null, values: [], not: false, join: "and" });
  });
  it("setRow patches one row by id and resets op/values when the property changes", () => {
    let q = addRow(emptyQuery());
    const id = q.rows[0].id;
    q = setRow(q, id, { property: status, op: "contains-any", values: [{ kind: "text", text: "Todo" }] });
    expect(q.rows[0].op).toBe("contains-any");
    q = setRow(q, id, { property: { ...status, ident: ":user.property/other-1", title: "other" } });
    expect(q.rows[0].op).toBeNull();
    expect(q.rows[0].values).toEqual([]);
  });
  it("toggleNot flips one row only; setJoin sets one row only", () => {
    let q = addRow(addRow(emptyQuery()));
    const [a, b] = q.rows.map((r) => r.id);
    q = toggleNot(q, b);
    q = setJoin(q, b, "or");
    expect(q.rows.map((r) => r.not)).toEqual([false, true]);
    expect(q.rows.map((r) => r.join)).toEqual(["and", "or"]);
    expect(toggleNot(q, a).rows[0].not).toBe(true);
  });
  it("removeRow drops by id", () => {
    let q = addRow(addRow(emptyQuery()));
    const [a] = q.rows.map((r) => r.id);
    q = removeRow(q, a);
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].id).not.toBe(a);
  });
});

describe("content and name", () => {
  it("setContent sets or clears; setName trims", () => {
    let q: Query = setContent(emptyQuery(), { op: "contains", value: "invoice" });
    expect(q.content).toEqual({ op: "contains", value: "invoice" });
    q = setContent(q, null);
    expect(q.content).toBeNull();
    expect(setName(q, "  Open projects ").name).toBe("Open projects");
  });
});

describe("scope", () => {
  it("defaults to anywhere and can be set to a page or the Library", () => {
    const q = setScope(emptyQuery(), { kind: "on-page", page: { uuid: "u", title: "Book" } });
    expect(q.scope).toEqual({ kind: "on-page", page: { uuid: "u", title: "Book" } });
    expect(setScope(q, { kind: "library" }).scope).toEqual({ kind: "library" });
  });
});

describe("reference rows", () => {
  it("addRef appends a row that links to nothing yet, AND, not negated", () => {
    const q = addRef(emptyQuery());
    expect(q.refs).toHaveLength(1);
    expect(q.refs[0]).toMatchObject({ dir: "links-to", target: null, not: false, join: "and" });
    expect(q.refs[0].id).toMatch(/^ref\d+$/);
  });
  it("setRef patches one row by id; removeRef drops it; both leave the input untouched", () => {
    const q1 = addRef(addRef(emptyQuery()));
    const [a, b] = q1.refs.map((r) => r.id);
    const q2 = setRef(q1, b, { dir: "ancestor-links-to", target: { kind: "tag", tag: project, name: "iris" }, not: true, join: "or" });
    expect(q2.refs[0]).toEqual(q1.refs[0]);
    expect(q2.refs[1]).toEqual({ id: b, dir: "ancestor-links-to", target: { kind: "tag", tag: project, name: "iris" }, not: true, join: "or" });
    expect(q1.refs[1].target).toBeNull();
    expect(removeRef(q2, a).refs.map((r) => r.id)).toEqual([b]);
  });
  it("a node target carries the node's uuid and title", () => {
    const q = addRef(emptyQuery());
    const q2 = setRef(q, q.refs[0].id, { target: { kind: "node", uuid: "u1", title: "Project Iris" } });
    expect(q2.refs[0].target).toEqual({ kind: "node", uuid: "u1", title: "Project Iris" });
  });
});
