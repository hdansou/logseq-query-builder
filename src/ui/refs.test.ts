import { describe, expect, it } from "vitest";
import type { NodeInfo, TagInfo } from "../graph";
import { DIRECTIONS, targetOptions } from "./refs";

const tags: TagInfo[] = [
  { ident: ":user.class/project-1", title: "project", uuid: "tp", count: 18 },
  { ident: ":logseq.class/Journal", title: "Journal", uuid: "tj", count: 40 },
];
const nodes: NodeInfo[] = [
  { uuid: "n1", title: "Project Iris", page: null },
  { uuid: "n2", title: "Iris Phase Two", page: { uuid: "p", title: "Projects" } },
];

describe("reference target options", () => {
  it("lists tags first as 'any <tag>' with their counts, then nodes with their page", () => {
    const opts = targetOptions(tags, nodes);
    expect(opts.map((o) => o.label)).toEqual(["any project", "any Journal", "Project Iris", "Iris Phase Two"]);
    expect(opts[0]).toMatchObject({ id: ":user.class/project-1", hint: "18", value: { kind: "tag", tag: { ident: ":user.class/project-1", title: "project" }, name: "" } });
    expect(opts[2]).toMatchObject({ id: "n1", value: { kind: "node", uuid: "n1", title: "Project Iris" } });
    expect(opts[3].hint).toBe("Projects");
  });
  it("filters tags by the typed text (nodes come pre-filtered by the graph search)", () => {
    expect(targetOptions(tags, nodes, "jour").map((o) => o.label)).toEqual(["any Journal", "Project Iris", "Iris Phase Two"]);
  });
});

describe("directions", () => {
  it("offers the spec's four operators in its order, labelled as the prototype does", () => {
    expect(DIRECTIONS.map((d) => d.label)).toEqual(["links to", "is linked from", "ancestor links to", "on page under"]);
    expect(DIRECTIONS.map((d) => d.id)).toEqual(["links-to", "linked-from", "ancestor-links-to", "under"]);
  });
});
