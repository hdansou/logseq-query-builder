// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { setRef, setRow, type PropertyRef, type TagRef } from "../model";
import { renderPanel } from "./test-panel";
import type { Store } from "./store";

/**
 * The panel rendered into a headless DOM from a store, so what is on screen can be asserted
 * without Chrome. Regression tests for the re-render bugs found live (BUG-3, 4, 5, 7).
 */
const project: TagRef = { ident: ":user.class/project-1", title: "project" };
const status: PropertyRef = { ident: ":user.property/status-1", title: "Status", type: "default", cardinality: "one" };

const q = (sel: string) => document.querySelector<HTMLElement>(sel);
const fid = (id: string) => q(`[data-fid="${id}"]`) as HTMLInputElement | null;
const text = () => document.getElementById("root")!.textContent ?? "";


describe("frame", () => {
  it("keeps the footer as the last child of the root and the results inside the scrolling body (BUG-5)", () => {
    const { root } = renderPanel();
    expect(root.lastElementChild?.id).toBe("footer");
    expect(q("#body #results")).not.toBeNull();
    expect((fid("insert") as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows the raw typed name, spaces included, and the suggestion only when nothing is typed (BUG-7)", () => {
    const { store } = renderPanel();
    expect(fid("name")!.value).toBe("");
    store.setName("Open ");
    expect(fid("name")!.value).toBe("Open ");
    store.setName("");
    store.update((qq) => ({ ...qq, tags: [{ tag: project, not: false, join: "and" }] }));
    expect(fid("name")!.value).toBe("project nodes");
    expect(fid("name")!.tagName).toBe("TEXTAREA");
  });
});

describe("pickers across a re-render (BUG-9)", () => {
  // One tag on the graph, so the tag picker has something to pick.
  const graph = async (query: string) =>
    query.includes("(count ?b)") ? [[":user.class/project-1", 12]]
    : query.includes(":logseq.class/Tag]") ? [[":user.class/project-1", "project", "u-proj"]]
    : [];
  const settle = () => new Promise((r) => setTimeout(r, 0));
  const listOf = (el: HTMLElement) => el.parentElement!.querySelector("ul")!;

  it("a tag picked with the mouse does not reopen the tag list over the Filters zone", async () => {
    renderPanel(graph);
    const input = fid("tag-picker")!;
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); await settle();
    expect(listOf(input).hidden).toBe(false);
    listOf(input).querySelector("li")!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await settle();   // the restored picker's focus handler refreshes asynchronously
    // The store re-rendered (chip on screen); focus stayed in the fresh picker, but its list is closed.
    expect(text()).toContain("project");
    const after = fid("tag-picker")!;
    expect(document.activeElement).toBe(after);
    expect(listOf(after).hidden).toBe(true);
  });
  it("the tag picker opens its list on typing or ArrowDown, not on focus alone (BUG-12: the open list covered the zones below)", async () => {
    renderPanel(graph);
    const input = fid("tag-picker")!;
    input.focus(); await settle();
    expect(listOf(input).hidden).toBe(true);
    input.value = "pro"; input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    expect(listOf(input).hidden).toBe(false);
    expect(listOf(input).textContent).toContain("project");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(listOf(input).hidden).toBe(true);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })); await settle();
    expect(listOf(input).hidden).toBe(false);
  });
  it("a list that was open stays open when results arrive mid-choice", async () => {
    const { store } = renderPanel(graph);
    store.update((qq) => setRow({ ...qq, rows: [{ id: "r1", property: null, op: null, values: [], not: false, join: "and" }] }, "r1", { property: status, op: "contains-any" }));
    const op = fid("row-op-r1")!;
    op.focus(); await settle();
    expect(listOf(op).hidden).toBe(false);
    store.update((qq) => ({ ...qq }));   // a re-render for an unrelated reason (the preview came back)
    await settle();
    const after = fid("row-op-r1")!;
    expect(document.activeElement).toBe(after);
    expect(listOf(after).hidden).toBe(false);
  });
});

describe("content zone", () => {
  it("keeps an operator chosen before any text is typed (BUG-15: it snapped back to 'contains' on the re-render)", () => {
    const { store } = renderPanel();
    const sel = fid("content-op") as unknown as HTMLSelectElement;
    sel.value = "starts-with"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect((fid("content-op") as unknown as HTMLSelectElement).value).toBe("starts-with");
    store.update((qq) => ({ ...qq, tags: [{ tag: project, not: false, join: "and" }] }));   // any other re-render
    expect((fid("content-op") as unknown as HTMLSelectElement).value).toBe("starts-with");
    expect(store.state.guard.ok).toBe(true);
    expect(fid("name")!.value).toBe("project nodes");   // an operator without text is not a filter yet
    const input = fid("content-text")!;
    input.value = "Decision:"; input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.state.q.content).toEqual({ op: "starts-with", value: "Decision:" });
    expect(fid("name")!.value).toBe('project nodes where text starts with "Decision:"');
  });
});

describe("references zone", () => {
  let store: Store;
  beforeEach(() => { ({ store } = renderPanel()); });

  it("starts with an add button; a row has a direction picker, a target picker and a remove button", () => {
    expect(fid("add-ref")!.textContent).toBe("+ add a reference");
    const id = store.addRef();
    expect(fid(`ref-dir-${id}`)!.value).toBe("links to");
    expect(fid(`ref-target-${id}`)!.placeholder).toBe("any tag, or a node…");
    expect(fid(`ref-x-${id}`)).not.toBeNull();
    expect(text()).toContain("that");
  });

  it("a tag target renders a chip, a name condition and the condition button; a condition row reads 'whose'", () => {
    const id = store.addRef();
    store.update((qq) => setRef(qq, id, { target: { kind: "tag", tag: project, name: "", rows: [] } }));
    expect(text()).toContain("any project");
    expect(fid(`ref-name-${id}`)!.placeholder).toBe("named like…");
    expect(fid(`ref-cond-${id}`)!.textContent).toBe("+ condition on the target");
    fid(`ref-cond-${id}`)!.click();
    expect(text()).toContain("whose");
    const prop = q(`[data-fid^="trow-${id}-prop-"]`) as HTMLInputElement;
    expect(prop.placeholder).toBe("property…");
    expect(document.activeElement).toBe(prop);
  });

  it("text being typed into a picker survives a re-render (BUG-3)", () => {
    const id = store.addRef();
    const target = fid(`ref-target-${id}`)!;
    target.focus();
    target.value = "qb refs";
    target.dispatchEvent(new Event("input"));   // the picker marks the text as being composed
    store.setName("x");                          // any store change re-renders the whole panel
    const again = fid(`ref-target-${id}`)!;
    expect(again.value).toBe("qb refs");
    expect(document.activeElement).toBe(again);
  });

  it("a freshly picked property keeps its label across the re-render the pick causes (BUG-4)", () => {
    const rowId = store.addRow();
    const prop = fid(`row-prop-${rowId}`)!;
    prop.focus();
    prop.value = "";                              // what the picker leaves after a pick: cleared, not "typing"
    store.update((qq) => setRow(qq, rowId, { property: status, op: "contains-any", values: [] }));
    expect(fid(`row-prop-${rowId}`)!.value).toBe("Status");
  });
});
