import { describe, expect, it } from "vitest";
import { OPERATORS, arityOf, controlFor, isTextOp, operatorsFor } from "./operators";
import type { PropertyType } from "./model";

const TYPES: PropertyType[] = ["default", "number", "url", "node", "asset", "date", "datetime", "checkbox"];

describe("operatorsFor: the spec's table, one row per type", () => {
  it("node: contains any/all, does not contain, is empty, is not empty (+ has/not-has presence)", () => {
    expect(operatorsFor("node")).toEqual(["contains-any", "contains-all", "not-contains", "empty", "not-empty", "has", "not-has"]);
  });
  it("text and URL add the two part-of-the-value operators, each taking one free text", () => {
    for (const t of ["default", "url"] as const)
      expect(operatorsFor(t)).toEqual(["contains-any", "contains-all", "not-contains", "text-includes", "text-starts", "empty", "not-empty", "has", "not-has"]);
    expect(arityOf("text-includes")).toBe(1);
    expect(isTextOp("text-starts")).toBe(true);
    expect(isTextOp("gt")).toBe(false);
  });
  it("a node timestamp offers the date operators only", () => {
    expect(operatorsFor("datetime", ":block/created-at")).toEqual(["eq", "before", "on-or-before", "after", "on-or-after", "between"]);
    expect(operatorsFor("datetime", ":user.property/due-1")).toContain("empty");
  });
  it("number adds greater than, less than, between", () => {
    expect(operatorsFor("number")).toEqual(["contains-any", "contains-all", "not-contains", "gt", "lt", "between", "empty", "not-empty", "has", "not-has"]);
  });
  it("asset has no 'does not contain'", () => {
    expect(operatorsFor("asset")).toEqual(["contains-any", "contains-all", "empty", "not-empty", "has", "not-has"]);
  });
  it("date and date-time: equals, before, on or before, after, on or after, between, empty, not empty", () => {
    for (const t of ["date", "datetime"] as const)
      expect(operatorsFor(t)).toEqual(["eq", "before", "on-or-before", "after", "on-or-after", "between", "empty", "not-empty", "has", "not-has"]);
  });
  it("checkbox: is true, is false only", () => {
    expect(operatorsFor("checkbox")).toEqual(["true", "false", "has", "not-has"]);
  });
  it("every type lists only operators that exist in OPERATORS", () => {
    for (const t of TYPES) for (const op of operatorsFor(t)) expect(OPERATORS[op]).toBeDefined();
  });
});

describe("arity", () => {
  it("between takes two values, presence/checkbox take none, comparisons one, contains many", () => {
    expect(arityOf("between")).toBe(2);
    expect(arityOf("empty")).toBe(0);
    expect(arityOf("true")).toBe(0);
    expect(arityOf("gt")).toBe(1);
    expect(arityOf("before")).toBe(1);
    expect(arityOf("contains-any")).toBe("many");
  });
});

describe("controlFor: the value control comes from the property type", () => {
  it("maps each type to one control kind; checkbox has none", () => {
    expect(controlFor("default")).toBe("text");
    expect(controlFor("url")).toBe("text");
    expect(controlFor("number")).toBe("number");
    expect(controlFor("node")).toBe("node");
    expect(controlFor("asset")).toBe("asset");
    expect(controlFor("date")).toBe("date");
    expect(controlFor("datetime")).toBe("date");
    expect(controlFor("checkbox")).toBe("none");
  });
});

describe("labels", () => {
  it("read as the spec writes them", () => {
    expect(OPERATORS["contains-any"].label).toBe("contains any");
    expect(OPERATORS["not-contains"].label).toBe("does not contain");
    expect(OPERATORS["on-or-before"].label).toBe("on or before");
    expect(OPERATORS["not-empty"].label).toBe("is not empty");
    expect(OPERATORS["not-has"].label).toBe("does not have");
  });
});
