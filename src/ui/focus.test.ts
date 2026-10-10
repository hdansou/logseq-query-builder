// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { focusTarget } from "./focus";

/**
 * Where the cursor goes when the panel opens or the frame regains focus. The host hands focus to
 * the frame asynchronously, so the panel re-asserts it a few times after opening; that must never
 * take focus away from a control the user has already reached (BUG-11: a tag picked within the
 * first second lost focus to the tag picker, whose list then reopened over the Filters zone).
 */
describe("focusTarget", () => {
  const setup = () => {
    document.body.innerHTML = `<div id="root"><input data-fid="tag-picker"><input data-fid="row-prop-r1"></div><input id="outside">`;
    return document.getElementById("root")!;
  };
  it("goes to the tag picker when nothing in the panel has focus", () => {
    const root = setup();
    expect(focusTarget(root, document.body, true)?.dataset.fid).toBe("tag-picker");
    expect(focusTarget(root, null, true)?.dataset.fid).toBe("tag-picker");
  });
  it("forced: still pulls focus from the host, never from a control inside the panel", () => {
    const root = setup();
    expect(focusTarget(root, document.getElementById("outside"), true)?.dataset.fid).toBe("tag-picker");
    expect(focusTarget(root, root.querySelector('[data-fid="row-prop-r1"]'), true)).toBeNull();
  });
  it("not forced: only fills an empty focus", () => {
    const root = setup();
    expect(focusTarget(root, document.body, false)?.dataset.fid).toBe("tag-picker");
    expect(focusTarget(root, document.getElementById("outside"), false)).toBeNull();
  });
});
