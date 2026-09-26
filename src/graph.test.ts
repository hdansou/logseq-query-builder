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
    ":block/tags :logseq.class/Property]": [
      [":user.property/status-1", "status", "u-s", "default", ":db.cardinality/one"],
      [":user.property/deadline-1", "deadline", "u-d", "datetime", ":db.cardinality/one"],
      [":user.property/assignee-1", "assignee", "u-a", "node", ":db.cardinality/many"],
      [":user.property/notes-1", "notes", "u-n", "default", ":db.cardinality/one"],
      [":logseq.property/weird-1", "weird", "u-w", "keyword", ":db.cardinality/one"],
    ],
  };
  it("returns type, cardinality and owner tags; drops types the builder has no control for", async () => {
    const g = new Graph(fake(table));
    const props = await g.properties();
    expect(props.map((p) => p.title)).toEqual(["assignee", "deadline", "notes", "status"]);
    expect(props.find((p) => p.title === "status")).toEqual({
      ident: ":user.property/status-1", title: "status", uuid: "u-s", type: "default", cardinality: "one",
      owners: [":user.class/project-1", ":logseq.class/Task"],
    });
    expect(props.find((p) => p.title === "assignee")?.cardinality).toBe("many");
  });
  it("orders the selected tags' own properties first, then the rest alphabetically", async () => {
    const g = new Graph(fake(table));
    const ordered = await g.properties([":logseq.class/Task"]);
    expect(ordered.map((p) => p.title)).toEqual(["deadline", "status", "assignee", "notes"]);
  });
});
