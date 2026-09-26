import { describe, expect, it } from "vitest";
import { filterOptions, pickerKey, type Option, type PickerState } from "./picker";

const opts: Option<number>[] = [
  { id: "1", label: "project", value: 1 },
  { id: "2", label: "Person", value: 2 },
  { id: "3", label: "Big project", value: 3 },
  { id: "4", label: "task", value: 4 },
];

describe("filterOptions", () => {
  it("empty text keeps everything in order", () => {
    expect(filterOptions(opts, "").map((o) => o.id)).toEqual(["1", "2", "3", "4"]);
  });
  it("is case-insensitive, prefix matches first, then substring matches, original order within each", () => {
    expect(filterOptions(opts, "P").map((o) => o.id)).toEqual(["1", "2", "3"]);
    expect(filterOptions(opts, "proj").map((o) => o.id)).toEqual(["1", "3"]);
    expect(filterOptions(opts, "zzz")).toEqual([]);
  });
});

describe("pickerKey", () => {
  const st = (over: Partial<PickerState> = {}): PickerState => ({ open: true, index: 0, ...over });
  it("arrows move and wrap, and open a closed list", () => {
    expect(pickerKey(st(), "ArrowDown", 3)).toEqual({ state: { open: true, index: 1 } });
    expect(pickerKey(st({ index: 2 }), "ArrowDown", 3)).toEqual({ state: { open: true, index: 0 } });
    expect(pickerKey(st({ index: 0 }), "ArrowUp", 3)).toEqual({ state: { open: true, index: 2 } });
    expect(pickerKey(st({ open: false }), "ArrowDown", 3)).toEqual({ state: { open: true, index: 0 } });
  });
  it("Enter picks the highlighted option when the list is open and has options, else means free text", () => {
    expect(pickerKey(st({ index: 1 }), "Enter", 3)).toEqual({ state: { open: false, index: 1 }, action: "pick" });
    expect(pickerKey(st(), "Enter", 0)).toEqual({ state: { open: false, index: 0 }, action: "free" });
    expect(pickerKey(st({ open: false }), "Enter", 3)).toEqual({ state: { open: false, index: 0 }, action: "free" });
  });
  it("Escape closes an open list without picking (and is consumed); with a closed list it is not consumed", () => {
    expect(pickerKey(st(), "Escape", 3)).toEqual({ state: { open: false, index: 0 }, action: "close" });
    expect(pickerKey(st({ open: false }), "Escape", 3)).toEqual({ state: { open: false, index: 0 } });
  });
  it("Tab closes the list and lets focus move on", () => {
    expect(pickerKey(st(), "Tab", 3)).toEqual({ state: { open: false, index: 0 }, action: "advance" });
  });
});
