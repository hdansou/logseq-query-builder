// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { handleDevMessage } from "./devhook";
import { emptyQuery, type TagRef } from "./model";
import { renderPanel } from "./ui/test-panel";

const project: TagRef = { ident: ":user.class/project-1", title: "project" };


describe("dev hook", () => {
  it("reads state, sets a query, clicks and types by fid, lists fids, reports unknown controls", async () => {
    const { store } = renderPanel();
    expect(await handleDevMessage(store, { qb: "state", id: "1" })).toMatchObject({ readback: "all nodes", results: [] });
    expect(await handleDevMessage(store, { qb: "set", id: "2", query: { ...emptyQuery(), tags: [{ tag: project, not: false, join: "and" }] } })).toEqual({ ok: true });
    expect(store.state.readback).toBe("project nodes");
    expect(await handleDevMessage(store, { qb: "click", id: "3", fid: "add-ref" })).toEqual({ ok: true });
    const fids = ((await handleDevMessage(store, { qb: "fids", id: "4" })) as { fids: string[] }).fids;
    const target = fids.find((f) => f.startsWith("ref-target-"))!;
    expect(await handleDevMessage(store, { qb: "type", id: "5", fid: target, text: "iris" })).toEqual({ ok: true });
    expect((document.querySelector(`[data-fid="${target}"]`) as HTMLInputElement).value).toBe("iris");
    expect(await handleDevMessage(store, { qb: "click", id: "6", fid: "nope" })).toEqual({ error: "no control nope" });
  });
});
