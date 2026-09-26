// npm run probe -- <graph> [--record]: run the emitter's clauses on a CLI graph (see probes/cli.test.ts).
import { spawnSync } from "node:child_process";
const args = process.argv.slice(2);
const graph = args.find((a) => !a.startsWith("--"));
if (!graph) { console.error("usage: npm run probe -- <graph> [--record]"); process.exit(2); }
const env = { ...process.env, QB_PROBE_GRAPH: graph, ...(args.includes("--record") ? { QB_PROBE_RECORD: "1" } : {}) };
const r = spawnSync("npx", ["vitest", "run", "probes/cli.test.ts"], { stdio: "inherit", env });
process.exit(r.status ?? 1);
