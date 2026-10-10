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

const identByTitle = (g: string, cls: string, title: string): string => {
  const out = cli(g, `[:find ?i :where [?e :block/tags ${cls}] [?e :block/title ${JSON.stringify(title)}] [?e :db/ident ?i]]`);
  const m = /\[(:[\w.*+!?$%&=<>/-]+)\]/.exec(out);   // `:result #{[:user.class/Project-Xy12]}`
  if (!m) throw new Error(`no ${cls} titled ${title} on ${g}`);
  return m[1];
};

/**
 * Fixtures name tags, properties and pages by title and leave the ident / uuid empty: user idents
 * carry a random suffix that changes whenever a graph is reseeded, so they live on the graph only.
 */
function resolve(g: string, q: Query): Query {
  const tag = <T extends { ident: string; title: string }>(t: T): T => (t.ident ? t : { ...t, ident: identByTitle(g, ":logseq.class/Tag", t.title) });
  const prop = <T extends { ident: string; title: string }>(p: T): T => (p.ident ? p : { ...p, ident: identByTitle(g, ":logseq.class/Property", p.title) });
  const rows = (rs: Query["rows"]) => rs.map((r) => ({
    ...r,
    property: r.property ? prop(r.property) : r.property,
    values: r.values.map((v) => (v.kind === "ref" && !v.uuid ? { ...v, uuid: uuidByTitle(g, v.title) } : v)),
  }));
  return {
    ...q,
    scope: q.scope.kind === "on-page" && !q.scope.page.uuid ? { ...q.scope, page: { ...q.scope.page, uuid: uuidByTitle(g, q.scope.page.title) } } : q.scope,
    tags: q.tags.map((t) => (t.tag ? { ...t, tag: tag(t.tag) } : t)),
    rows: rows(q.rows),
    refs: q.refs.map((r) => {
      if (r.target?.kind === "node" && !r.target.uuid) return { ...r, target: { ...r.target, uuid: uuidByTitle(g, r.target.title) } };
      if (r.target?.kind === "tag") return { ...r, target: { ...r.target, tag: tag(r.target.tag), rows: rows(r.target.rows) } };
      return r;
    }),
  };
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
