// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { handleDevMessage } from "./devhook";
import { Graph } from "./graph";
import { emptyQuery, type TagRef } from "./model";
import { renderContent } from "./ui/content";
import { renderRefs } from "./ui/refs";
import { createRenderer } from "./ui/render";
import { renderRows } from "./ui/rows";
import { renderScope } from "./ui/scope";
import { Store } from "./ui/store";
import { renderTags } from "./ui/tags";

const project: TagRef = { ident: ":user.class/project-1", title: "project" };

function panel() {
  document.body.innerHTML = '<div id="root"></div>';
  (globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s };
  const store = new Store({ preview: async () => [], debounceMs: 0 });
  const render = createRenderer(document.getElementById("root")!, { store, graph: new Graph(async () => []), insert: async () => {} },
    { scope: renderScope, tags: renderTags, rows: renderRows, refs: renderRefs, content: renderContent });
  store.subscribe(render); render(store.state);
  return store;
}

describe("dev hook", () => {
  it("reads state, sets a query, clicks and types by fid, lists fids, reports unknown controls", () => {
    const store = panel();
    expect(handleDevMessage(store, { qb: "state", id: "1" })).toMatchObject({ readback: "all nodes", results: [] });
    expect(handleDevMessage(store, { qb: "set", id: "2", query: { ...emptyQuery(), tags: [{ tag: project, not: false, join: "and" }] } })).toEqual({ ok: true });
    expect(store.state.readback).toBe("project nodes");
    expect(handleDevMessage(store, { qb: "click", id: "3", fid: "add-ref" })).toEqual({ ok: true });
    const fids = (handleDevMessage(store, { qb: "fids", id: "4" }) as { fids: string[] }).fids;
    const target = fids.find((f) => f.startsWith("ref-target-"))!;
    expect(handleDevMessage(store, { qb: "type", id: "5", fid: target, text: "iris" })).toEqual({ ok: true });
    expect((document.querySelector(`[data-fid="${target}"]`) as HTMLInputElement).value).toBe("iris");
    expect(handleDevMessage(store, { qb: "click", id: "6", fid: "nope" })).toEqual({ error: "no control nope" });
  });
});
