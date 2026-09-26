import { describe, expect, it } from "vitest";
import { absoluteLiteral, bounds, describeRelative, parseRelative, relativeInput } from "./dates";

describe("parseRelative: what the value control accepts", () => {
  it("named days and signed offsets with a unit", () => {
    expect(parseRelative("today")).toBe("today");
    expect(parseRelative("Tomorrow")).toBe("tomorrow");
    expect(parseRelative("-7d")).toEqual({ offset: -7, unit: "d" });
    expect(parseRelative("+2w")).toEqual({ offset: 2, unit: "w" });
    expect(parseRelative("-1m")).toEqual({ offset: -1, unit: "m" });
    expect(parseRelative("+1y")).toEqual({ offset: 1, unit: "y" });
  });
  it("rejects what the host cannot resolve: week/month boundaries, bare numbers, unknown units", () => {
    expect(parseRelative("start of week")).toBeNull();
    expect(parseRelative("end of month")).toBeNull();
    expect(parseRelative("-7")).toBeNull();
    expect(parseRelative("+3h")).toBeNull();
    expect(parseRelative("7d")).toBeNull();
  });
});

describe("relativeInput: the native input keyword, live-verified forms only", () => {
  it("day granularity (journal-day ints)", () => {
    expect(relativeInput("today", "day")).toBe(":today");
    expect(relativeInput("tomorrow", "day")).toBe(":tomorrow");
    expect(relativeInput("yesterday", "day")).toBe(":yesterday");
    expect(relativeInput({ offset: -7, unit: "d" }, "day")).toBe(":-7d");
    expect(relativeInput({ offset: 30, unit: "d" }, "day")).toBe(":+30d");
    expect(relativeInput({ offset: -1, unit: "y" }, "day")).toBe(":-1y");
  });
  it("ms at the start or end of that day (for datetime properties)", () => {
    expect(relativeInput("today", "start")).toBe(":start-of-today-ms");
    expect(relativeInput("today", "end")).toBe(":end-of-today-ms");
    expect(relativeInput("tomorrow", "start")).toBe(":+1d-start");
    expect(relativeInput("yesterday", "end")).toBe(":-1d-end");
    expect(relativeInput({ offset: 7, unit: "d" }, "start")).toBe(":+7d-start");
    expect(relativeInput({ offset: 7, unit: "d" }, "end")).toBe(":+7d-end");
  });
});

describe("absoluteLiteral", () => {
  it("journal-day int for day granularity, local ms at the day boundary otherwise", () => {
    expect(absoluteLiteral(20260925, "day")).toBe(20260925);
    expect(absoluteLiteral(20260925, "start")).toBe(new Date(2026, 8, 25, 0, 0, 0, 0).getTime());
    expect(absoluteLiteral(20260925, "end")).toBe(new Date(2026, 8, 25, 23, 59, 59, 999).getTime());
  });
});

describe("bounds: the one definition of day-granularity comparison", () => {
  const A = { kind: "relative", expr: "today" } as const;
  const B = { kind: "absolute", day: 20261002 } as const;
  it("datetime (ms): equals spans the day, before/after are strict against the day's edges", () => {
    expect(bounds("eq", [A], "ms")).toEqual([{ cmp: ">=", value: A, boundary: "start" }, { cmp: "<=", value: A, boundary: "end" }]);
    expect(bounds("before", [A], "ms")).toEqual([{ cmp: "<", value: A, boundary: "start" }]);
    expect(bounds("on-or-before", [A], "ms")).toEqual([{ cmp: "<=", value: A, boundary: "end" }]);
    expect(bounds("after", [A], "ms")).toEqual([{ cmp: ">", value: A, boundary: "end" }]);
    expect(bounds("on-or-after", [A], "ms")).toEqual([{ cmp: ">=", value: A, boundary: "start" }]);
    expect(bounds("between", [A, B], "ms")).toEqual([{ cmp: ">=", value: A, boundary: "start" }, { cmp: "<=", value: B, boundary: "end" }]);
  });
  it("date (journal-day ints): plain comparisons, between inclusive", () => {
    expect(bounds("eq", [A], "day")).toEqual([{ cmp: "=", value: A, boundary: "day" }]);
    expect(bounds("before", [A], "day")).toEqual([{ cmp: "<", value: A, boundary: "day" }]);
    expect(bounds("between", [A, B], "day")).toEqual([{ cmp: ">=", value: A, boundary: "day" }, { cmp: "<=", value: B, boundary: "day" }]);
  });
});

describe("describeRelative", () => {
  it("reads naturally", () => {
    expect(describeRelative("today")).toBe("today");
    expect(describeRelative({ offset: -7, unit: "d" })).toBe("7 days ago");
    expect(describeRelative({ offset: 1, unit: "w" })).toBe("1 week from now");
    expect(describeRelative({ offset: 30, unit: "d" })).toBe("30 days from now");
    expect(describeRelative({ offset: -1, unit: "y" })).toBe("1 year ago");
  });
});
