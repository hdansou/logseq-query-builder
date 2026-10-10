import { describe, expect, it } from "vitest";
import { withRef } from "./test-helpers";
import { RULES, emit } from "./emit";
import { addRef, addRow, addTag, emptyQuery, setContent, setInherit, setJoin, setName, setRef, setRow, setScope, setTag, toggleNot, type PropertyRef, type Query, type RefRow, type TagRef, type Value } from "./model";

// Idents carry the graph's random suffixes; the emitter embeds whatever it is given.
const task: TagRef = { ident: ":logseq.class/Task", title: "Task" };
const project: TagRef = { ident: ":user.class/project-Kq9x2mzp", title: "project" };
const prop = (title: string, type: PropertyRef["type"], cardinality: PropertyRef["cardinality"] = "one"): PropertyRef =>
  ({ ident: `:user.property/${title}-Xab12cde`, title, type, cardinality });
const priority = prop("priority", "default");
const status = prop("status", "default");
const assignee = prop("assignee", "node", "many");
const deadline = prop("deadline", "datetime");
const scheduled = prop("scheduled", "datetime");
const due = prop("due", "date");
const points = prop("points", "number");
const done = prop("done", "checkbox");
const text = (t: string): Value => ({ kind: "text", text: t });
const num = (n: number): Value => ({ kind: "number", n });
const ref = (uuid: string, title: string): Value => ({ kind: "ref", uuid, title });
const rel = (expr: any): Value => ({ kind: "date", date: { kind: "relative", expr } });
const abs = (day: number): Value => ({ kind: "date", date: { kind: "absolute", day } });
const row = (q: Query, patch: Parameters<typeof setRow>[2], join: "and" | "or" = "and") => {
  const q2 = addRow(q);
  const id = q2.rows[q2.rows.length - 1].id;
  return setJoin(setRow(q2, id, patch), id, join);
};
const P = (p: PropertyRef) => p.ident;
const INHERIT = (t: TagRef, n = 1) =>
  `[?tag${n} :db/ident ${t.ident}] [?b :block/tags ?t${n}] (or [(= ?t${n} ?tag${n})] (class-extends ?tag${n} ?t${n}))`;

describe("spec scenarios", () => {
  it("1. urgent tasks: tag task, priority contains any urgent", () => {
    const q = row(addTag(emptyQuery(), task), { property: priority, op: "contains-any", values: [text("urgent")] });
    const e = emit(q);
    expect(e.where).toEqual([INHERIT(task), `[?b ${P(priority)} ?v1] [?v1 :block/title ?x1] [(contains? #{"urgent"} ?x1)]`]);
    expect(e.inputs).toEqual([]);
    expect(e.rules).toBe(true);
  });

  it("2. Maria's open projects due within 30 days — full block text", () => {
    let q = setName(addTag(emptyQuery(), project), "Maria's open projects");
    q = row(q, { property: assignee, op: "contains-any", values: [ref("0c2f0000-0000-4000-8000-000000000001", "Maria")] });
    q = row(q, { property: status, op: "not-contains", values: [text("done")] });
    q = row(q, { property: deadline, op: "on-or-before", values: [rel({ offset: 30, unit: "d" })] });
    const e = emit(q);
    expect(e.block).toBe(`{:query [:find (pull ?b [*])
 :in $ ?in1 %
 :where
 ${INHERIT(project)}
 [?b ${P(assignee)} ?v1] [?v1 :block/uuid ?x1] [(contains? #{#uuid "0c2f0000-0000-4000-8000-000000000001"} ?x1)]
 [?b ${P(deadline)} ?x3] [(<= ?x3 ?in1)]
 (not [?b ${P(status)} ?v2] [?v2 :block/title ?x2] [(contains? #{"done"} ?x2)])]
 :inputs [:+30d-end]}`);
    expect(e.preview.inputs).toEqual([":+30d-end", RULES]);
    expect(e.preview.query).toContain(`:find (pull ?b [:block/uuid :block/title {:block/page [:block/uuid :block/title]} {:block/refs [:block/uuid :block/title]} {${P(assignee)} [:block/title]} {${P(status)} [:block/title]} ${P(deadline)}]) :in $ ?in1 % :where`);
  });

  it("3. anything assigned to one of three people (no tag); contains all needs all three", () => {
    const people = [ref("u1", "Maria"), ref("u2", "Tom"), ref("u3", "Priya")];
    const any = emit(row(emptyQuery(), { property: assignee, op: "contains-any", values: people }));
    expect(any.where).toEqual([`[?b ${P(assignee)} ?v1] [?v1 :block/uuid ?x1] [(contains? #{#uuid "u1" #uuid "u2" #uuid "u3"} ?x1)]`]);
    expect(any.rules).toBe(false);
    const all = emit(row(emptyQuery(), { property: assignee, op: "contains-all", values: people }));
    expect(all.where).toEqual([`[?b ${P(assignee)} ?v1_1] [?v1_1 :block/uuid #uuid "u1"] [?b ${P(assignee)} ?v1_2] [?v1_2 :block/uuid #uuid "u2"] [?b ${P(assignee)} ?v1_3] [?v1_3 :block/uuid #uuid "u3"]`]);
  });

  it("4. tasks scheduled between today and +7d that mention invoice", () => {
    let q = row(addTag(emptyQuery(), task), { property: scheduled, op: "between", values: [rel("today"), rel({ offset: 7, unit: "d" })] });
    q = setContent(q, { op: "contains", value: "Invoice" });
    const e = emit(q);
    expect(e.where).toEqual([
      INHERIT(task),
      `[?b :block/title ?title] [(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt "invoice")] (not [?b :logseq.property/created-from-property _])`,
      `[?b ${P(scheduled)} ?x1] [(>= ?x1 ?in1)] [(<= ?x1 ?in2)]`,
    ]);
    expect(e.inputs).toEqual([":start-of-today-ms", ":+7d-end"]);
  });

  it("5. untagged nodes with a status set: the NOT tag is emitted after the binding row", () => {
    let q = setTag(addTag(emptyQuery(), null), 0, { not: true });
    q = row(q, { property: status, op: "not-empty" });
    expect(emit(q).where).toEqual([
      `[?e1 :db/ident :logseq.property/empty-placeholder] [?b ${P(status)} ?v1] [(not= ?v1 ?e1)]`,
      `(not [?b :block/tags _])`,
    ]);
  });
});

describe("tags", () => {
  it("exact match when inheritance is off; presence with a null tag", () => {
    expect(emit(setInherit(addTag(emptyQuery(), project), false)).where).toEqual([`[?b :block/tags ${project.ident}]`]);
    expect(emit(addTag(emptyQuery(), null)).where[0]).toMatch(/^\[\?b :block\/tags \?any1\] /);   // see "any tag (presence)"
  });
  it("AND concatenates, OR wraps in or-join, NOT wraps in not", () => {
    let q = addTag(addTag(emptyQuery(), task), project);
    expect(emit(setInherit(q, false)).where).toEqual([`[?b :block/tags ${task.ident}]`, `[?b :block/tags ${project.ident}]`]);
    q = setTag(q, 1, { join: "or" });
    expect(emit(setInherit(q, false)).where).toEqual([`(or-join [?b] (and [?b :block/tags ${task.ident}]) (and [?b :block/tags ${project.ident}]))`]);
    q = setTag(addTag(addTag(emptyQuery(), task), project), 1, { not: true });
    expect(emit(setInherit(q, false)).where).toEqual([`[?b :block/tags ${task.ident}]`, `(not [?b :block/tags ${project.ident}])`]);
  });
});

describe("operators, one form each (the rows verified live in docs/probes.md)", () => {
  const one = (p: PropertyRef, op: any, values: Value[] = []) => emit(row(addTag(emptyQuery(), task), { property: p, op, values })).where[1];
  it("text contains any / all / does not contain", () => {
    expect(one(status, "contains-any", [text("Todo"), text("Done")])).toBe(`[?b ${P(status)} ?v1] [?v1 :block/title ?x1] [(contains? #{"Todo" "Done"} ?x1)]`);
    expect(one(status, "contains-all", [text("red"), text("blue")])).toBe(`[?b ${P(status)} ?v1_1] [?v1_1 :block/title "red"] [?b ${P(status)} ?v1_2] [?v1_2 :block/title "blue"]`);
    expect(one(status, "not-contains", [text("Todo")])).toBe(`(not [?b ${P(status)} ?v1] [?v1 :block/title ?x1] [(contains? #{"Todo"} ?x1)])`);
  });
  it("number contains / greater / less / between", () => {
    expect(one(points, "contains-any", [num(3), num(5)])).toBe(`[?b ${P(points)} ?v1] [?v1 :logseq.property/value ?x1] [(contains? #{3 5} ?x1)]`);
    expect(one(points, "gt", [num(3)])).toBe(`[?b ${P(points)} ?v1] [?v1 :logseq.property/value ?x1] [(> ?x1 3)]`);
    expect(one(points, "lt", [num(3)])).toBe(`[?b ${P(points)} ?v1] [?v1 :logseq.property/value ?x1] [(< ?x1 3)]`);
    expect(one(points, "between", [num(2), num(3)])).toBe(`[?b ${P(points)} ?v1] [?v1 :logseq.property/value ?x1] [(>= ?x1 2)] [(<= ?x1 3)]`);
  });
  it("checkbox true / false", () => {
    expect(one(done, "true")).toBe(`[?b ${P(done)} true]`);
    expect(one(done, "false")).toBe(`[?b ${P(done)} false]`);
  });
  it("is empty / is not empty differ for ref and raw types", () => {
    expect(one(status, "empty")).toBe(`(or (not [?b ${P(status)} _]) [?b ${P(status)} :logseq.property/empty-placeholder])`);
    expect(one(status, "not-empty")).toBe(`[?e1 :db/ident :logseq.property/empty-placeholder] [?b ${P(status)} ?v1] [(not= ?v1 ?e1)]`);
    expect(one(done, "empty")).toBe(`(not [?b ${P(done)} _])`);
    expect(one(deadline, "not-empty")).toBe(`[?b ${P(deadline)} _]`);
  });
  it("has / does not have", () => {
    expect(one(status, "has")).toBe(`[?b ${P(status)} _]`);
    expect(one(status, "not-has")).toBe(`(not [?b ${P(status)} _])`);
  });
  it("date (journal-day) operators with relative and absolute values", () => {
    expect(one(due, "eq", [rel("today")])).toBe(`[?b ${P(due)} ?v1] [?v1 :block/journal-day ?x1] [(= ?x1 ?in1)]`);
    expect(one(due, "before", [abs(20261002)])).toBe(`[?b ${P(due)} ?v1] [?v1 :block/journal-day ?x1] [(< ?x1 20261002)]`);
    expect(one(due, "after", [rel({ offset: -7, unit: "d" })])).toBe(`[?b ${P(due)} ?v1] [?v1 :block/journal-day ?x1] [(> ?x1 ?in1)]`);
    expect(one(due, "between", [rel("today"), rel({ offset: 7, unit: "d" })])).toBe(`[?b ${P(due)} ?v1] [?v1 :block/journal-day ?x1] [(>= ?x1 ?in1)] [(<= ?x1 ?in2)]`);
  });
  it("datetime operators at day granularity", () => {
    expect(one(deadline, "eq", [rel("today")])).toBe(`[?b ${P(deadline)} ?x1] [(>= ?x1 ?in1)] [(<= ?x1 ?in2)]`);
    expect(one(deadline, "before", [rel({ offset: -3, unit: "d" })])).toBe(`[?b ${P(deadline)} ?x1] [(< ?x1 ?in1)]`);
    expect(one(deadline, "after", [rel({ offset: 3, unit: "d" })])).toBe(`[?b ${P(deadline)} ?x1] [(> ?x1 ?in1)]`);
    const e = emit(row(addTag(emptyQuery(), task), { property: deadline, op: "eq", values: [abs(20260925)] }));
    expect(e.where[1]).toBe(`[?b ${P(deadline)} ?x1] [(>= ?x1 ${new Date(2026, 8, 25).getTime()})] [(<= ?x1 ${new Date(2026, 8, 25, 23, 59, 59, 999).getTime()})]`);
  });
  it("inputs are collected in order and deduplicated", () => {
    let q = row(addTag(emptyQuery(), task), { property: deadline, op: "before", values: [rel({ offset: -3, unit: "d" })] });
    q = row(q, { property: due, op: "eq", values: [rel("today")] });
    q = row(q, { property: deadline, op: "on-or-after", values: [rel({ offset: -3, unit: "d" })] });
    expect(emit(q).inputs).toEqual([":-3d-start", ":today"]);
  });
  it("a NOT row wraps the whole fragment", () => {
    let q = row(addTag(emptyQuery(), task), { property: points, op: "gt", values: [num(3)] });
    q = toggleNot(q, q.rows[0].id);
    expect(emit(q).where[1]).toBe(`(not [?b ${P(points)} ?v1] [?v1 :logseq.property/value ?x1] [(> ?x1 3)])`);
  });
  it("OR between rows becomes or-join carrying the input vars the branches use", () => {
    let q = row(emptyQuery(), { property: due, op: "eq", values: [rel("today")] });
    q = row(q, { property: points, op: "gt", values: [num(3)] }, "or");
    expect(emit(q).where).toEqual([
      `(or-join [?b ?in1] (and [?b ${P(due)} ?v1] [?v1 :block/journal-day ?x1] [(= ?x1 ?in1)]) (and [?b ${P(points)} ?v2] [?v2 :logseq.property/value ?x2] [(> ?x2 3)]))`,
    ]);
  });
  it("escapes quotes and backslashes in text values", () => {
    expect(one(status, "contains-any", [text('say "hi" \\ bye')])).toContain(`#{"say \\"hi\\" \\\\ bye"}`);
  });
});

describe("any tag (presence)", () => {
  // "Any tag" means the user's tagged nodes. Every property and tag page carries a tag itself
  // (Property, Tag), built-in pages are tagged too, and closed values are tagged entities: on a
  // graph with 27 tagged user nodes the bare clause returned 185 (e2e S17, BUG-14).
  const ANY = `[?b :block/tags ?any1] (not [?b :block/tags :logseq.class/Property]) (not [?b :block/tags :logseq.class/Tag]) (not [?b :logseq.property/built-in? true]) (not [?b :logseq.property/created-from-property _])`;
  it("binds the user's tagged nodes, not the schema", () => {
    expect(emit(addTag(emptyQuery(), null)).where).toEqual([ANY]);
  });
  it("NOT any tag = untagged, once something positive binds ?b", () => {
    const q = setTag(addTag(addTag(emptyQuery(), task), null), 1, { not: true });
    expect(emit(q).where[1]).toBe(`(not [?b :block/tags _])`);
  });
});

describe("content search", () => {
  const c = (op: any, value: string) => emit(setContent(addTag(emptyQuery(), task), { op, value })).where[1];
  // Property values are entities with a title too (text values, closed values such as Priority's
  // "High"); a content search over the graph must not surface them as nodes (e2e S5, 2026-10-09).
  const NO_VALUES = `(not [?b :logseq.property/created-from-property _])`;
  it("contains / does not contain / starts with are case-insensitive; matches is a re-pattern; property values are excluded", () => {
    expect(c("contains", "Invoice")).toBe(`[?b :block/title ?title] [(clojure.string/lower-case ?title) ?lt] [(clojure.string/includes? ?lt "invoice")] ${NO_VALUES}`);
    expect(c("not-contains", "x")).toBe(`[?b :block/title ?title] [(clojure.string/lower-case ?title) ?lt] (not [(clojure.string/includes? ?lt "x")]) ${NO_VALUES}`);
    expect(c("starts-with", "Alpha")).toBe(`[?b :block/title ?title] [(clojure.string/lower-case ?title) ?lt] [(clojure.string/starts-with? ?lt "alpha")] ${NO_VALUES}`);
    expect(c("matches", "inv.*ce")).toBe(`[?b :block/title ?title] [(re-pattern "inv.*ce") ?re] [(re-find ?re ?title)] ${NO_VALUES}`);
  });
});

describe("block text without inputs or rules", () => {
  it("omits :in and :inputs", () => {
    const e = emit(setInherit(addTag(emptyQuery(), task), false));
    expect(e.block).toBe(`{:query [:find (pull ?b [*])\n :where\n [?b :block/tags :logseq.class/Task]]}`);
    expect(e.preview.inputs).toEqual([]);
  });
  it("throws on a query the guard refuses (callers check the guard first)", () => {
    expect(() => emit(emptyQuery())).toThrow(/guard/);
  });
});

describe("scopes", () => {
  const artist: TagRef = { ident: ":user.class/artist-1", title: "artist" };
  it("on-page: the blocks that live on the page, property values excluded", () => {
    const e = emit(setScope(emptyQuery(), { kind: "on-page", page: { uuid: "b00k", title: "Book" } }));
    expect(e.where).toEqual([`[?src :block/uuid #uuid "b00k"] [?b :block/page ?src] (not [?b :logseq.property/created-from-property _])`]);
    expect(e.rules).toBe(false);
  });
  it("library: everything under the built-in Library page via the parent rule (child pages and their blocks), property values excluded", () => {
    const e = emit(setScope(emptyQuery(), { kind: "library" }));
    expect(e.where).toEqual([`[?lib :block/name "library"] [?lib :logseq.property/built-in? true] (parent ?lib ?b) (not [?b :logseq.property/created-from-property _])`]);
    expect(e.rules).toBe(true);
    expect(RULES).toContain("(parent ?p ?c)");
  });
});

describe("reference rows (SPEC §10)", () => {
  const iris = { kind: "node", uuid: "1r15", title: "Project Iris" } as const;
  const NODE = `[?r1 :block/uuid #uuid "1r15"]`;
  const TAG = `[?rtag1 :db/ident ${project.ident}] [?r1 :block/tags ?rtv1] (or [(= ?rtv1 ?rtag1)] (class-extends ?rtag1 ?rtv1))`;
  const HIDDEN = `(not [?b :block/page ?hp1] [?hp1 :block/name ?hn1] [(clojure.string/starts-with? ?hn1 "$$$")])`;

  it("links to a node: direct refs, the target's own objects and hidden view blocks excluded", () => {
    const e = emit(withRef(emptyQuery(), { dir: "links-to", target: iris }));
    expect(e.where).toEqual([`${NODE} [?b :block/refs ?r1] (not [?b :block/tags ?r1]) ${HIDDEN}`]);
    expect(e.rules).toBe(false);
  });
  it("is linked from a node: the page and its blocks link to ?b; applied tags and property keys are not links", () => {
    const e = emit(withRef(emptyQuery(), { dir: "linked-from", target: iris }));
    expect(e.where).toEqual([`${NODE} (or [(identity ?r1) ?s1] [?s1 :block/page ?r1]) [?s1 :block/refs ?b] (not [?s1 :block/tags ?b]) (not [?b :block/tags :logseq.class/Property])`]);
  });
  it("ancestor links to: the node itself or any ancestor links, via the parent rule", () => {
    const e = emit(withRef(emptyQuery(), { dir: "ancestor-links-to", target: iris }));
    expect(e.where).toEqual([`${NODE} [?a1 :block/refs ?r1] (or-join [?a1 ?b] [(identity ?a1) ?b] (parent ?a1 ?b)) ${HIDDEN}`]);
    expect(e.rules).toBe(true);
  });
  it("on page under: every descendant of the target in the parent tree, property values excluded", () => {
    const e = emit(withRef(emptyQuery(), { dir: "under", target: iris }));
    expect(e.where).toEqual([`${NODE} (parent ?r1 ?b) (not [?b :logseq.property/created-from-property _])`]);
    expect(e.rules).toBe(true);
  });
  it("a tag target uses tag inheritance like the tag selector, and an optional name condition", () => {
    const q = withRef(emptyQuery(), { dir: "links-to", target: { kind: "tag", tag: project, name: "", rows: [] } });
    expect(emit(q).where).toEqual([`${TAG} [?b :block/refs ?r1] (not [?b :block/tags ?r1]) ${HIDDEN}`]);
    expect(emit(q).rules).toBe(true);
    const named = withRef(emptyQuery(), { dir: "links-to", target: { kind: "tag", tag: project, name: "Iris", rows: [] } });
    expect(emit(named).where).toEqual([`${TAG} [?r1 :block/title ?rt1] [(clojure.string/lower-case ?rt1) ?rl1] [(clojure.string/includes? ?rl1 "iris")] [?b :block/refs ?r1] (not [?b :block/tags ?r1]) ${HIDDEN}`]);
    const exact = setInherit(named, false);
    expect(emit(exact).where[0]).toMatch(/^\[\?r1 :block\/tags :user\.class\/project-Kq9x2mzp\] \[\?r1 :block\/title/);
  });
  it("NOT wraps the whole row and orders it after the positive clauses; rows join AND/OR like filters", () => {
    let q = addTag(emptyQuery(), task);
    q = withRef(q, { dir: "links-to", target: iris, not: true });
    const e = emit(q);
    expect(e.where).toEqual([INHERIT(task), `(not ${NODE} [?b :block/refs ?r1] (not [?b :block/tags ?r1]) ${HIDDEN})`]);
    let q2 = withRef(emptyQuery(), { dir: "links-to", target: iris });
    q2 = withRef(q2, { dir: "under", target: { kind: "node", uuid: "acme", title: "Acme" }, join: "or" });
    expect(emit(q2).where).toEqual([`(or-join [?b] (and ${NODE} [?b :block/refs ?r1] (not [?b :block/tags ?r1]) ${HIDDEN}) (and [?r2 :block/uuid #uuid "acme"] (parent ?r2 ?b) (not [?b :logseq.property/created-from-property _])))`]);
  });
  it("an incomplete row (no target) is skipped", () => {
    const q = addRef(addTag(emptyQuery(), task));
    expect(emit(q).where).toEqual([INHERIT(task)]);
  });
});

describe("filtered target set (SPEC: a tag plus property or name conditions)", () => {
  const TAG = `[?rtag1 :db/ident ${project.ident}] [?r1 :block/tags ?rtv1] (or [(= ?rtv1 ?rtag1)] (class-extends ?rtag1 ?rtv1))`;
  const HIDDEN = `(not [?b :block/page ?hp1] [?hp1 :block/name ?hn1] [(clojure.string/starts-with? ?hn1 "$$$")])`;
  const trow = (patch: Parameters<typeof setRow>[2], join: "and" | "or" = "and") => ({ id: `t${Math.random()}`, property: null, op: null, values: [], not: false, join, ...patch });
  it("a property condition narrows the target set with the row emitter, subject ?rN, variables suffixed rN_k", () => {
    const q = withRef(emptyQuery(), { dir: "links-to", target: { kind: "tag", tag: project, name: "", rows: [trow({ property: status, op: "contains-any", values: [text("Todo")] })] } });
    expect(emit(q).where).toEqual([`${TAG} [?r1 ${P(status)} ?vr1_1] [?vr1_1 :block/title ?xr1_1] [(contains? #{"Todo"} ?xr1_1)] [?b :block/refs ?r1] (not [?b :block/tags ?r1]) ${HIDDEN}`]);
  });
  it("name and conditions combine; NOT and OR rows fold on the target variable; incomplete rows are skipped", () => {
    const rows = [
      trow({ property: status, op: "contains-any", values: [text("Todo")] }),
      trow({ property: points, op: "gt", values: [num(3)], not: true }),
      trow({ property: status }),   // incomplete
    ];
    const q = withRef(emptyQuery(), { dir: "under", target: { kind: "tag", tag: project, name: "Iris", rows } });
    expect(emit(q).where).toEqual([`${TAG} [?r1 :block/title ?rt1] [(clojure.string/lower-case ?rt1) ?rl1] [(clojure.string/includes? ?rl1 "iris")] [?r1 ${P(status)} ?vr1_1] [?vr1_1 :block/title ?xr1_1] [(contains? #{"Todo"} ?xr1_1)] (not [?r1 ${P(points)} ?vr1_2] [?vr1_2 :logseq.property/value ?xr1_2] [(> ?xr1_2 3)]) (parent ?r1 ?b) (not [?b :logseq.property/created-from-property _])`]);
    const or = withRef(emptyQuery(), { dir: "links-to", target: { kind: "tag", tag: project, name: "", rows: [rows[0], trow({ property: points, op: "gt", values: [num(3)] }, "or")] } });
    expect(emit(or).where[0]).toContain(`(or-join [?r1] (and [?r1 ${P(status)} ?vr1_1] [?vr1_1 :block/title ?xr1_1] [(contains? #{"Todo"} ?xr1_1)]) (and [?r1 ${P(points)} ?vr1_2] [?vr1_2 :logseq.property/value ?xr1_2] [(> ?xr1_2 3)]))`);
  });
  it("a date condition on the target shares the query's inputs", () => {
    const q = withRef(emptyQuery(), { dir: "links-to", target: { kind: "tag", tag: project, name: "", rows: [trow({ property: deadline, op: "on-or-before", values: [rel({ offset: 30, unit: "d" })] })] } });
    const e = emit(q);
    expect(e.inputs).toEqual([":+30d-end"]);   // on-or-before on a datetime: end of that day
    expect(e.where[0]).toContain(`[?r1 ${P(deadline)} ?xr1_1] [(<= ?xr1_1 ?in1)]`);
  });
});

describe("identifiers from the graph or a saved state cannot break out of the query text (SEC-001)", () => {
  it("refuses a uuid or an ident outside the safe character set", () => {
    const bad = { kind: "node", uuid: 'x"] [?b :block/title ?t', title: "evil" } as const;
    const q = addRef(emptyQuery());
    expect(() => emit(setRef(q, q.refs[0].id, { dir: "links-to", target: bad }))).toThrow(/invalid uuid/);
    expect(() => emit(setScope(emptyQuery(), { kind: "on-page", page: { uuid: "a b", title: "x" } }))).toThrow(/invalid uuid/);
    expect(() => emit(addTag(emptyQuery(), { ident: ":user.class/x] [?b", title: "x" }))).toThrow(/invalid ident/);
    expect(() => emit(row(emptyQuery(), { property: { ...status, ident: "status" }, op: "has" }))).toThrow(/invalid ident/);
    expect(() => emit(row(emptyQuery(), { property: assignee, op: "contains-any", values: [ref("6ab8332f-ece6-4b85-a59e-b9fa705a4eca", "Maria")] }))).not.toThrow();
  });
});
