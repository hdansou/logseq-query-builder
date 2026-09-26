import { describe, expect, it } from "vitest";
import { contextPull, formatContext } from "./context";
import type { PropertyRef } from "./model";

const status: PropertyRef = { ident: ":user.property/status-1", title: "status", type: "default", cardinality: "one" };
const points: PropertyRef = { ident: ":user.property/points-1", title: "points", type: "number", cardinality: "one" };
const due: PropertyRef = { ident: ":user.property/due-1", title: "due", type: "date", cardinality: "one" };
const when: PropertyRef = { ident: ":user.property/when-1", title: "when", type: "datetime", cardinality: "one" };
const done: PropertyRef = { ident: ":user.property/done-1", title: "done", type: "checkbox", cardinality: "one" };
const who: PropertyRef = { ident: ":user.property/who-1", title: "who", type: "node", cardinality: "many" };

describe("contextPull", () => {
  it("pulls ref properties through their value entity and raw ones directly, deduplicated", () => {
    expect(contextPull([status, points, due, when, done, status])).toBe(
      "{:user.property/status-1 [:block/title]} {:user.property/points-1 [:logseq.property/value]} {:user.property/due-1 [:block/journal-day :block/title]} :user.property/when-1 :user.property/done-1",
    );
    expect(contextPull([])).toBe("");
  });
});

describe("formatContext", () => {
  it("renders 'title: value' pairs from the host's namespace-stripped pull map", () => {
    // keys as the host returns them: :block/* stripped, everything else the full ident
    const m = {
      ":user.property/status-1": { title: "Todo" },
      ":user.property/points-1": { ":logseq.property/value": 5 },
      ":user.property/due-1": { "journal-day": 20260925, title: "Sep 25th, 2026" },
      ":user.property/when-1": new Date(2026, 8, 25, 21, 23).getTime(),
      ":user.property/done-1": true,
      ":user.property/who-1": [{ title: "Maria" }, { title: "Tom" }],
    };
    expect(formatContext([status, points, due, when, done, who], m)).toBe("status: Todo · points: 5 · due: Sep 25th, 2026 · when: 2026-09-25 · done: yes · who: Maria, Tom");
  });
  it("skips properties the node does not have", () => {
    expect(formatContext([status, points], { ":user.property/points-1": { ":logseq.property/value": 2 } })).toBe("points: 2");
  });
});
