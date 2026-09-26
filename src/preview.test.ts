import { describe, expect, it } from "vitest";
import type { Emitted } from "./emit";
import { PAGE_SIZE, normalize, page, runPreview } from "./preview";

const emitted = (query: string, inputs: string[]): Emitted =>
  ({ where: [], inputs: [], rules: false, block: "", preview: { query, inputs } });

describe("normalize", () => {
  it("turns pull rows (namespaces already stripped by the host) into result rows, sorted by title", () => {
    const rows = [
      [{ uuid: "u2", title: "Beta", content: "Beta", page: { uuid: "p", title: "QB Scratch" } }],
      [{ uuid: "u1", title: "Alpha", content: "Alpha" }],
    ];
    expect(normalize(rows).map(({ raw, ...r }) => r)).toEqual([
      { uuid: "u1", title: "Alpha", page: null },
      { uuid: "u2", title: "Beta", page: { uuid: "p", title: "QB Scratch" } },
    ]);
    expect(normalize(rows)[0].raw).toBe(rows[1][0]);
  });
  it("throws on a shape it does not recognise rather than rendering blanks", () => {
    expect(() => normalize([["just a string"]])).toThrow(/pull map/);
  });
});

describe("runPreview", () => {
  it("passes the emitted query and inputs (keywords and the rules string) straight through", async () => {
    const calls: unknown[][] = [];
    const dq = async (q: string, ...ins: unknown[]) => { calls.push([q, ...ins]); return [[{ uuid: "u", title: "T" }]]; };
    const out = await runPreview(emitted("[:find …]", [":today", " [[rules]] "]), dq);
    expect(calls).toEqual([["[:find …]", ":today", " [[rules]] "]]);
    expect(out.map(({ raw, ...r }) => r)).toEqual([{ uuid: "u", title: "T", page: null }]);
  });
});

describe("page", () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ uuid: `u${i}`, title: `T${i}`, page: null, raw: {} }));
  it("shows the first 10, then 10 more per load-more, and reports what is left", () => {
    expect(PAGE_SIZE).toBe(10);
    expect(page(rows, 1)).toEqual({ shown: rows.slice(0, 10), remaining: 13, total: 23 });
    expect(page(rows, 2)).toEqual({ shown: rows.slice(0, 20), remaining: 3, total: 23 });
    expect(page(rows, 3).remaining).toBe(0);
    expect(page([], 1)).toEqual({ shown: [], remaining: 0, total: 0 });
  });
});

describe("normalize resolves [[uuid]] links through the pulled refs", () => {
  it("shows the referenced node's title instead of its uuid", () => {
    const rows = [[{ uuid: "u", title: "Mentions [[abc]] inline", refs: [{ uuid: "abc", title: "Project Iris" }] }]];
    expect(normalize(rows)[0].title).toBe("Mentions [[Project Iris]] inline");
  });
});
