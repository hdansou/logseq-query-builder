import { describe, expect, it } from "vitest";
import { addRow, addTag, emptyQuery, setRow, setScope, type PropertyRef, type Query, type TagRef } from "./model";
import { nodeUuids, refresh } from "./restore";
import { withRef } from "./test-helpers";

const project: TagRef = { ident: ":user.class/project-1", title: "project" };
const task: TagRef = { ident: ":user.class/task-1", title: "task" };
const owner: PropertyRef = { ident: ":user.property/owner-1", title: "owner", type: "node", cardinality: "one" };

const built = (): Query => {
  let q = addRow(addTag(emptyQuery(), project));
  q = setRow(q, q.rows[0].id, { property: owner, op: "contains-any", values: [{ kind: "ref", uuid: "u-ada", title: "Ada" }] });
  q = setScope(q, { kind: "on-page", page: { uuid: "u-page", title: "Roadmap" } });
  q = withRef(q, { dir: "links-to", target: { kind: "node", uuid: "u-iris", title: "Iris" } });
  return withRef(q, { dir: "linked-from", target: { kind: "tag", tag: task, name: "", rows: [] } });
};
const all = {
  idents: new Map([[project.ident, "project"], [task.ident, "task"], [owner.ident, "owner"]]),
  nodes: new Map([["u-ada", "Ada"], ["u-page", "Roadmap"], ["u-iris", "Iris"]]),
};

describe("nodeUuids", () => {
  it("lists the scope page, node values and node targets once each", () => {
    expect(nodeUuids(built()).sort()).toEqual(["u-ada", "u-iris", "u-page"]);
    expect(nodeUuids(emptyQuery())).toEqual([]);
  });
});

describe("refresh", () => {
  it("returns the query unchanged when the graph still agrees", () => {
    const q = built();
    expect(refresh(q, all)).toEqual({ q, missing: [] });
  });
  it("takes the current title of a renamed tag, property, value, page and target", () => {
    const { q, missing } = refresh(built(), {
      idents: new Map([[project.ident, "Project"], [task.ident, "Task"], [owner.ident, "Owner"]]),
      nodes: new Map([["u-ada", "Ada L."], ["u-page", "Roadmap 2027"], ["u-iris", "Project Iris"]]),
    });
    expect(missing).toEqual([]);
    expect(q.tags[0].tag?.title).toBe("Project");
    expect(q.rows[0].property?.title).toBe("Owner");
    expect(q.rows[0].values[0]).toEqual({ kind: "ref", uuid: "u-ada", title: "Ada L." });
    expect(q.scope).toEqual({ kind: "on-page", page: { uuid: "u-page", title: "Roadmap 2027" } });
    expect(q.refs[0].target).toMatchObject({ title: "Project Iris" });
    expect(q.refs[1].target).toMatchObject({ tag: { title: "Task" } });
  });
  it("names what is gone, by kind and last known title, and leaves the chip in place", () => {
    const { q, missing } = refresh(built(), { idents: new Map([[project.ident, "project"]]), nodes: new Map([["u-page", "Roadmap"]]) });
    expect(missing).toEqual(["property “owner”", "node “Ada”", "node “Iris”", "tag “task”"]);
    expect(q.rows[0].property).toEqual(owner);
  });
});
