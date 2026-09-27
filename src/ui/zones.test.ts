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
