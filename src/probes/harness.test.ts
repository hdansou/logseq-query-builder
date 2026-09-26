import { describe, expect, it } from "vitest";
import { runProbe, runProbes, type ProbeResult } from "./harness";

describe("runProbe", () => {
  it("returns ok with the probe's detail and elapsed ms", async () => {
    let t = 100;
    const r = await runProbe("x", async () => ({ rows: 3 }), () => (t += 7));
    expect(r).toMatchObject({ probe: "x", ok: true, ms: 7, detail: { rows: 3 } });
    expect(r.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("turns a throw into ok:false with the message, never rejects", async () => {
    const r = await runProbe("boom", async () => {
      throw new Error("nope");
    });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatchObject({ error: "nope" });
  });
});

describe("runProbes", () => {
  it("runs the named probes in order and reports each", async () => {
    const seen: ProbeResult[] = [];
    const out = await runProbes(
      { a: async () => 1, b: async () => 2 },
      ["b", "a"],
      (r) => {
        seen.push(r);
      },
    );
    expect(out.map((r) => r.probe)).toEqual(["b", "a"]);
    expect(seen.map((r) => r.detail)).toEqual([2, 1]);
  });

  it("refuses an unknown probe name", async () => {
    await expect(runProbes({}, ["nope"], () => {})).rejects.toThrow("unknown probe: nope");
  });
});
