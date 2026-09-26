import { describe, expect, it } from "vitest";
import { addRef, addRow, addTag, emptyQuery, setContent, setJoin, setRef, setRow, setScope, setTag, toggleNot, type PropertyRef, type Query, type RefRow, type TagRef, type Value } from "./model";
import { readback } from "./readback";

const project: TagRef = { ident: ":user.class/project-1", title: "project" };
const person: TagRef = { ident: ":user.class/person-1", title: "person" };
const prop = (title: string, type: PropertyRef["type"]): PropertyRef => ({ ident: `:user.property/${title}-1`, title, type, cardinality: "many" });
const status = prop("status", "default"), assignee = prop("assignee", "node"), deadline = prop("deadline", "datetime"), points = prop("points", "number"), due = prop("due", "date"), done = prop("done", "checkbox");
const text = (t: string): Value => ({ kind: "text", text: t });
const ref = (title: string): Value => ({ kind: "ref", uuid: "u", title });
const rel = (expr: any): Value => ({ kind: "date", date: { kind: "relative", expr } });
const abs = (day: number): Value => ({ kind: "date", date: { kind: "absolute", day } });
const row = (q: Query, patch: Parameters<typeof setRow>[2], join: "and" | "or" = "and") => {
  const q2 = addRow(q);
  const id = q2.rows[q2.rows.length - 1].id;
  return setJoin(setRow(q2, id, patch), id, join);
};

describe("readback", () => {
  it("spec scenario 2", () => {
    let q = addTag(emptyQuery(), project);
    q = row(q, { property: assignee, op: "contains-any", values: [ref("Maria")] });
    q = row(q, { property: status, op: "not-contains", values: [text("done")] });
    q = row(q, { property: deadline, op: "on-or-before", values: [rel({ offset: 30, unit: "d" })] });
    expect(readback(q)).toBe("project nodes where assignee is Maria and status is not done and deadline is on or before 30 days from now");
  });
  it("no tag = all nodes; presence tags; OR and NOT tags", () => {
    expect(readback(row(emptyQuery(), { property: points, op: "gt", values: [{ kind: "number", n: 3 }] }))).toBe("all nodes where points is greater than 3");
    expect(readback(addTag(emptyQuery(), null))).toBe("tagged nodes");
    expect(readback(setTag(addTag(emptyQuery(), null), 0, { not: true }))).toBe("untagged nodes");
    expect(readback(setTag(addTag(addTag(emptyQuery(), project), person), 1, { join: "or" }))).toBe("project or person nodes");
    expect(readback(setTag(addTag(addTag(emptyQuery(), project), person), 1, { not: true }))).toBe("project and not person nodes");
  });
  it("several values, contains all, between, dates, checkbox, emptiness, presence", () => {
    const q = emptyQuery();
    expect(readback(row(q, { property: assignee, op: "contains-any", values: [ref("Maria"), ref("Tom"), ref("Priya")] }))).toBe("all nodes where assignee is any of Maria, Tom, Priya");
    expect(readback(row(q, { property: assignee, op: "contains-all", values: [ref("Maria"), ref("Tom")] }))).toBe("all nodes where assignee has all of Maria, Tom");
    expect(readback(row(q, { property: points, op: "between", values: [{ kind: "number", n: 2 }, { kind: "number", n: 3 }] }))).toBe("all nodes where points is between 2 and 3");
    expect(readback(row(q, { property: due, op: "between", values: [rel("today"), abs(20261002)] }))).toBe("all nodes where due is between today and 2 Oct 2026");
    expect(readback(row(q, { property: done, op: "true" }))).toBe("all nodes where done is true");
    expect(readback(row(q, { property: status, op: "empty" }))).toBe("all nodes where status is empty");
    expect(readback(row(q, { property: status, op: "not-has" }))).toBe("all nodes where status is not set");
  });
  it("OR between rows, NOT rows, and a content search at the end", () => {
    let q = row(addTag(emptyQuery(), project), { property: status, op: "contains-any", values: [text("Todo")] });
    q = row(q, { property: points, op: "gt", values: [{ kind: "number", n: 3 }] }, "or");
    q = toggleNot(q, q.rows[1].id);
    q = setContent(q, { op: "contains", value: "invoice" });
    expect(readback(q)).toBe('project nodes where status is Todo or not (points is greater than 3) and text contains "invoice"');
  });
  it("ignores unfilled rows and reads an empty query honestly", () => {
    expect(readback(emptyQuery())).toBe("all nodes");
    expect(readback(row(addTag(emptyQuery(), project), { property: status }))).toBe("project nodes");
  });
});

describe("readback with a scope", () => {
  it("names the page or the Library after the subject", () => {
    const artist: TagRef = { ident: ":user.class/artist-1", title: "artist" };
    expect(readback(addTag(setScope(emptyQuery(), { kind: "referenced-in", page: { uuid: "u", title: "Book" } }), artist))).toBe("artist nodes referenced in Book");
    expect(readback(setScope(emptyQuery(), { kind: "library" }))).toBe("all nodes in the Library");
    expect(readback(setScope(emptyQuery(), { kind: "on-page", page: { uuid: "u", title: "Book" } }))).toBe("all nodes on Book");
  });
});

describe("readback with reference rows", () => {
  const withRef = (q: Query, patch: Partial<Omit<RefRow, "id">>) => {
    const q2 = addRef(q);
    return setRef(q2, q2.refs[q2.refs.length - 1].id, patch);
  };
  const iris = { kind: "node", uuid: "u", title: "Project Iris" } as const;
  it("phrases the four directions after the subject, before the filters", () => {
    expect(readback(withRef(addTag(emptyQuery(), project), { dir: "links-to", target: iris }))).toBe("project nodes that link to Project Iris");
    expect(readback(withRef(emptyQuery(), { dir: "linked-from", target: iris }))).toBe("all nodes that are linked from Project Iris");
    expect(readback(withRef(emptyQuery(), { dir: "ancestor-links-to", target: iris }))).toBe("all nodes that have an ancestor linking to Project Iris");
    expect(readback(withRef(emptyQuery(), { dir: "under", target: iris }))).toBe("all nodes that are on a page under Project Iris");
    let q = withRef(addTag(emptyQuery(), project), { dir: "links-to", target: iris });
    q = row(q, { property: status, op: "contains-any", values: [text("Todo")] });
    expect(readback(q)).toBe("project nodes that link to Project Iris where status is Todo");
  });
  it("tag targets read as any <tag>, with the name condition; NOT and OR compose", () => {
    const anyProject = { kind: "tag", tag: project, name: "" } as const;
    expect(readback(withRef(emptyQuery(), { dir: "links-to", target: anyProject }))).toBe("all nodes that link to any project");
    expect(readback(withRef(emptyQuery(), { dir: "links-to", target: { ...anyProject, name: "iris" } }))).toBe('all nodes that link to any project named like "iris"');
    let q = withRef(emptyQuery(), { dir: "links-to", target: iris, not: true });
    expect(readback(q)).toBe("all nodes that do not link to Project Iris");
    expect(readback(withRef(emptyQuery(), { dir: "linked-from", target: iris, not: true }))).toBe("all nodes that are not linked from Project Iris");
    expect(readback(withRef(emptyQuery(), { dir: "ancestor-links-to", target: iris, not: true }))).toBe("all nodes that have no ancestor linking to Project Iris");
    expect(readback(withRef(emptyQuery(), { dir: "under", target: iris, not: true }))).toBe("all nodes that are not on a page under Project Iris");
    q = withRef(q, { dir: "under", target: anyProject, join: "or" });
    expect(readback(q)).toBe("all nodes that do not link to Project Iris or are on a page under any project");
  });
  it("skips rows without a target", () => {
    expect(readback(addRef(addTag(emptyQuery(), project)))).toBe("project nodes");
  });
});
