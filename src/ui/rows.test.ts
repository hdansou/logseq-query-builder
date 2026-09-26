import { describe, expect, it } from "vitest";
import { parseDateText } from "./rows";

describe("parseDateText (the date control's text)", () => {
  it("accepts relative expressions and ISO days, rejects the rest", () => {
    expect(parseDateText("today")).toEqual({ kind: "date", date: { kind: "relative", expr: "today" } });
    expect(parseDateText("-7d")).toEqual({ kind: "date", date: { kind: "relative", expr: { offset: -7, unit: "d" } } });
    expect(parseDateText("2026-10-02")).toEqual({ kind: "date", date: { kind: "absolute", day: 20261002 } });
    expect(parseDateText("next week")).toBeNull();
    expect(parseDateText("10/02/2026")).toBeNull();
  });
});
