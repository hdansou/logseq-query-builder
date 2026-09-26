import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emit } from "../src/emit";
import type { Query } from "../src/model";

/**
 * Emitter clauses run read-only on a CLI graph (`logseq query`, the same Datascript engine as the
 * host, which injects the `%` rules). Gated: `npm run probe -- <graph>` sets QB_PROBE_GRAPH;
 * `--record` sets QB_PROBE_RECORD and rewrites the expected counts in docs/probes-cli.json.
 */
const FILE = "docs/probes-cli.json";
interface Probe { name: string; graph: string; expected: number | null; query: Query }
const graph = process.env.QB_PROBE_GRAPH;
const record = process.env.QB_PROBE_RECORD === "1";

const cli = (g: string, q: string): string => execFileSync("logseq", ["query", "-g", g, "-o", "edn", "--query", q], { encoding: "utf8", timeout: 30000 });
const count = (edn: string): number => {
  const m = /:result \(\[(\d+)\]\)/.exec(edn) ?? /:result \(\)/.exec(edn);
  if (!m) throw new Error(`unexpected CLI output: ${edn.slice(0, 200)}`);
  return m[1] ? Number(m[1]) : 0;
};
const uuidByTitle = (g: string, title: string): string => {
  const out = cli(g, `[:find ?u :where [?b :block/title ${JSON.stringify(title)}] [?b :block/uuid ?u]]`);
  const m = /#uuid "([^"]+)"/.exec(out);
  if (!m) throw new Error(`no node titled ${title} on ${g}`);
  return m[1];
};

/** Fixtures name targets by title; the uuid lives on the graph, so resolve it before emitting. */
function resolve(g: string, q: Query): Query {
  return { ...q, refs: q.refs.map((r) => (r.target?.kind === "node" && !r.target.uuid ? { ...r, target: { ...r.target, uuid: uuidByTitle(g, r.target.title) } } : r)) };
}

describe.skipIf(!graph)("emitter clauses on a CLI graph", () => {
  const doc = JSON.parse(readFileSync(FILE, "utf8")) as { probes: Probe[] };
  const mine = doc.probes.filter((p) => p.graph === graph);
  it(`has probes for ${graph}`, () => { expect(mine.length).toBeGreaterThan(0); });
  for (const p of mine) {
    it(p.name, () => {
      const e = emit(resolve(graph!, p.query));
      if (e.inputs.length) throw new Error("date inputs are not resolved by the CLI; keep probes date-free");
      const observed = count(cli(graph!, `[:find (count-distinct ?b) :in $ %\n :where ${e.where.join("\n ")}]`));
      if (record || p.expected === null) { p.expected = observed; return; }
      expect(observed).toBe(p.expected);
    });
  }
  it("records observed counts when asked", () => {
    if (record || mine.some((p) => p.expected !== null)) writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
  });
});
