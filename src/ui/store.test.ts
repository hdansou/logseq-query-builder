import { describe, expect, it, vi } from "vitest";
import { Store, targetFromEvent } from "./store";
import type { PropertyRef, TagRef } from "../model";

const project: TagRef = { ident: ":user.class/project-1", title: "project" };
const status: PropertyRef = { ident: ":user.property/status-1", title: "status", type: "default", cardinality: "one" };

describe("targetFromEvent", () => {
  it("shortcut with an editing block, shortcut without, slash command", () => {
    expect(targetFromEvent("shortcut", { uuid: "u1" })).toEqual({ uuid: "u1", mode: "shortcut" });
    expect(targetFromEvent("shortcut", {})).toBeNull();
    expect(targetFromEvent("shortcut", { uuid: undefined })).toBeNull();
    expect(targetFromEvent("slash", { uuid: "u2" })).toEqual({ uuid: "u2", mode: "slash" });
  });
});

describe("Store", () => {
  it("starts empty, notifies subscribers on every update, exposes guard and readback", () => {
    const s = new Store({ preview: async () => [] });
    const seen: number[] = [];
    s.subscribe((st) => seen.push(st.q.tags.length));
    s.update((q) => ({ ...q, tags: [{ tag: project, not: false, join: "and" }] }));
    expect(seen).toEqual([1]);
    expect(s.state.guard.ok).toBe(true);
    expect(s.state.readback).toBe("project nodes");
    expect(new Store({ preview: async () => [] }).state.guard.ok).toBe(false);
  });

  it("debounces the preview 300 ms after the last change and only runs when the guard passes", async () => {
    vi.useFakeTimers();
    const preview = vi.fn(async () => [{ uuid: "u", title: "T", page: null }]);
    const s = new Store({ preview });
    s.update((q) => ({ ...q, tags: [{ tag: project, not: false, join: "and" }] }));
    s.update((q) => ({ ...q, inherit: false }));
    expect(preview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(299);
    expect(preview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(preview).toHaveBeenCalledTimes(1);
    expect(s.state.results).toHaveLength(1);
    expect(s.state.loading).toBe(false);
    s.update((q) => ({ ...q, tags: [] }));
    await vi.advanceTimersByTimeAsync(300);
    expect(preview).toHaveBeenCalledTimes(1);
    expect(s.state.results).toEqual([]);
    vi.useRealTimers();
  });

  it("keeps the preview error instead of blank results", async () => {
    vi.useFakeTimers();
    const s = new Store({ preview: async () => { throw new Error("boom"); } });
    s.update((q) => ({ ...q, tags: [{ tag: project, not: false, join: "and" }] }));
    await vi.advanceTimersByTimeAsync(300);
    expect(s.state.error).toBe("boom");
    vi.useRealTimers();
  });

  it("setName keeps the text as typed, including a trailing space mid-word", () => {
    const s = new Store({ preview: async () => [] });
    s.setName("Open ");
    expect(s.state.q.name).toBe("Open ");
  });

  it("resets pages to 1 on change and loadMore increments", () => {
    const s = new Store({ preview: async () => [] });
    s.loadMore(); s.loadMore();
    expect(s.state.pages).toBe(3);
    s.update((q) => ({ ...q, tags: [{ tag: project, not: false, join: "and" }] }));
    expect(s.state.pages).toBe(1);
  });

  it("open() sets target and resets the query; close() keeps the query for reopening", () => {
    const s = new Store({ preview: async () => [] });
    s.update((q) => ({ ...q, tags: [{ tag: project, not: false, join: "and" }] }));
    s.open({ uuid: "u1", mode: "slash" });
    expect(s.state.target).toEqual({ uuid: "u1", mode: "slash" });
    expect(s.state.q.tags).toEqual([]);
    s.update((q) => ({ ...q, rows: [{ id: "r", property: status, op: "empty", values: [], not: false, join: "and" }] }));
    s.close();
    expect(s.state.q.rows).toHaveLength(1);
  });
});
