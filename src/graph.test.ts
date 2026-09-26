import { describe, expect, it } from "vitest";
import { Graph, STRUCTURAL_TAGS, type Dq } from "./graph";

/** A fake datascriptQuery keyed by a substring of the query text. */
const fake = (table: Record<string, any[]>, log: string[] = []): Dq => async (query) => {
  log.push(query);
  const key = Object.keys(table).find((k) => query.includes(k));
  if (!key) throw new Error(`no fake for ${query}`);
  return table[key];
};

describe("Graph.tags (FEAT-11)", () => {
  // keys are matched in order, so the more specific count query comes first
  const table = {
    "(count ?b)": [[":user.class/project-1", 12], [":logseq.class/Task", 3], [":logseq.class/Page", 99]],
    ":block/tags :logseq.class/Tag] [?t :db/ident": [
      [":logseq.class/Task", "Task", "u-task"],
      [":logseq.class/Page", "Page", "u-page"],
      [":user.class/project-1", "project", "u-proj"],
      [":user.class/person-1", "person", "u-pers"],
      [":logseq.class/Property", "Property", "u-prop"],
    ],
  };
  it("lists tags most-used first, unused tags last with count 0, structural tags hidden", async () => {
    const g = new Graph(fake(table));
    expect(await g.tags()).toEqual([
      { ident: ":user.class/project-1", title: "project", uuid: "u-proj", count: 12 },
      { ident: ":logseq.class/Task", title: "Task", uuid: "u-task", count: 3 },
      { ident: ":user.class/person-1", title: "person", uuid: "u-pers", count: 0 },
    ]);
  });
  it("caches for the session until invalidated", async () => {
    const log: string[] = [];
    const g = new Graph(fake(table, log));
    await g.tags(); await g.tags();
    expect(log).toHaveLength(2);
    g.invalidate();
    await g.tags();
    expect(log).toHaveLength(4);
  });
  it("structural set is exactly the hidden built-ins from the grounding", () => {
    expect([...STRUCTURAL_TAGS].sort()).toEqual([
      ":logseq.class/Asset", ":logseq.class/Code-block", ":logseq.class/Comment", ":logseq.class/Comments",
      ":logseq.class/Math-block", ":logseq.class/Page", ":logseq.class/Pdf-annotation", ":logseq.class/Property",
      ":logseq.class/Quote-block", ":logseq.class/Root", ":logseq.class/Tag", ":logseq.class/Whiteboard",
    ]);
  });
});

describe("Graph.properties (FEAT-12)", () => {
  const table = {
    ":logseq.property.class/properties": [
      [":user.property/status-1", ":user.class/project-1"],
      [":user.property/status-1", ":logseq.class/Task"],
      [":user.property/deadline-1", ":logseq.class/Task"],
    ],
    // columns: ident title uuid type cardinality view-context built-in? public? hide? deleted-at
    ":block/tags :logseq.class/Property]": [
      [":user.property/status-1", "status", "u-s", "default", ":db.cardinality/one", ":none", false, false, false, false],
      [":user.property/deadline-1", "deadline", "u-d", "datetime", ":db.cardinality/one", ":none", false, false, false, false],
      [":user.property/assignee-1", "assignee", "u-a", "node", ":db.cardinality/many", ":none", false, false, false, false],
      [":user.property/notes-1", "notes", "u-n", "default", ":db.cardinality/one", ":none", false, false, false, false],
      [":logseq.property/weird-1", "weird", "u-w", "keyword", ":db.cardinality/one", ":none", true, true, false, false],
      [":logseq.property/enable-history?", "Enable property history", "u-e", "checkbox", ":db.cardinality/one", ":property", true, true, false, false],
      [":logseq.property.class/extends", "Extends", "u-x", "class", ":db.cardinality/many", ":class", true, true, false, false],
      [":logseq.property/priority", "Priority", "u-p", "default", ":db.cardinality/one", ":none", true, true, false, false],
      [":logseq.property/query", "Query", "u-q", "default", ":db.cardinality/one", ":block", true, true, true, false],
      [":logseq.property/secret", "Secret", "u-sec", "default", ":db.cardinality/one", ":none", true, false, false, false],
      [":user.property/gone-1", "gone", "u-g", "default", ":db.cardinality/one", ":none", false, false, false, 1234],
    ],
  };
  it("keeps public built-ins like Priority, drops hidden, deleted, non-public built-ins, unsupported types and settings-like built-ins", async () => {
    const g = new Graph(fake(table));
    const props = await g.properties();
    expect(props.map((p) => p.title)).toEqual(["Priority", "assignee", "deadline", "notes", "status"]);
    expect(props.find((p) => p.title === "status")).toEqual({
      ident: ":user.property/status-1", title: "status", uuid: "u-s", type: "default", cardinality: "one",
      owners: [":user.class/project-1", ":logseq.class/Task"],
    });
    expect(props.find((p) => p.title === "assignee")?.cardinality).toBe("many");
  });
  it("orders the selected tags' own properties first, then the rest alphabetically", async () => {
    const g = new Graph(fake(table));
    const ordered = await g.properties([":logseq.class/Task"]);
    expect(ordered.map((p) => p.title)).toEqual(["deadline", "status", "Priority", "assignee", "notes"]);
  });
});

describe("Graph.values / nodes / assets (FEAT-13)", () => {
  const status = { ident: ":user.property/status-1", title: "status", type: "default", cardinality: "one" } as const;
  const assignee = { ident: ":user.property/assignee-1", title: "assignee", type: "node", cardinality: "many" } as const;
  const table = {
    // :block/order is a fractional-index string in a real graph, never a number
    ":block/closed-value-property": [["cv-todo", "Todo", "a0"], ["cv-doing", "Doing", "a1"], ["cv-done", "Done", "a2"]],
    "(count-distinct ?b)": [["Todo", 5, "cv-todo"], ["Done", 2, "cv-done"], ["Blocked", 1, "open-1"]],
    "[?a :block/tags :logseq.class/Asset]": [["u-img", "photo.png"]],
    "clojure.string/includes? ?lt": [[{ uuid: "u1", title: "Maria", page: { uuid: "p1", title: "People" } }], [{ uuid: "u2", title: "Marian Keyes" }]],
  };
  it("values: closed choices in their order with counts (0 when unused), then open values by count", async () => {
    const g = new Graph(fake(table));
    expect(await g.values(status)).toEqual([
      { label: "Todo", count: 5, uuid: "cv-todo" },
      { label: "Doing", count: 0, uuid: "cv-doing" },
      { label: "Done", count: 2, uuid: "cv-done" },
      { label: "Blocked", count: 1, uuid: "open-1" },
    ]);
  });
  it("values: passes the property ident as an input, never interpolates it", async () => {
    const log: string[] = [];
    const inputs: unknown[][] = [];
    const g = new Graph(async (q, ...ins) => { log.push(q); inputs.push(ins); return table[Object.keys(table).find((k) => q.includes(k)) as keyof typeof table]; });
    await g.values(status);
    expect(inputs.every((i) => i[0] === ":user.property/status-1")).toBe(true);
  });
  it("nodes: title search is case-insensitive, embeds the needle as an escaped literal, optional tag constraint", async () => {
    const log: string[] = [];
    const g = new Graph(fake(table, log));
    const found = await g.nodes('Mar"ia');
    expect(found).toEqual([{ uuid: "u1", title: "Maria", page: { uuid: "p1", title: "People" } }, { uuid: "u2", title: "Marian Keyes", page: null }]);
    expect(log[0]).toContain(`[(clojure.string/includes? ?lt "mar\\"ia")]`);
    expect(log[0]).not.toContain(":block/tags");
    expect(log[0]).toContain("(not [?b :logseq.property/built-in? true])");
    await g.nodes("mar", ":user.class/person-1");
    expect(log[1]).toContain("[?b :block/tags :user.class/person-1]");
  });
  it("assets lists nodes tagged Asset", async () => {
    expect(await new Graph(fake(table)).assets()).toEqual([{ uuid: "u-img", title: "photo.png" }]);
  });
  it("values for a node property use the referenced node's title and uuid", async () => {
    const log: string[] = [];
    await new Graph(fake(table, log)).values(assignee);
    expect(log.find((q) => q.includes("count-distinct"))).toContain("[?v :block/title ?label] [?v :block/uuid ?u]");
  });
});
