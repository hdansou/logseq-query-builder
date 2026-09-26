import "@logseq/libs";
import { postToSink, runProbes, type ProbeFn } from "./harness";

/** Registry filled in by FEAT-1..4. Each probe returns what it observed. */
export const probes: Record<string, ProbeFn> = {};

/**
 * Dev-only palette commands. One command per probe so a single probe can be re-run,
 * plus "run all" which skips `seed`.
 */
export function registerProbeCommands() {
  for (const name of Object.keys(probes)) {
    logseq.App.registerCommandPalette({ key: `qb-probe-${name}`, label: `Query Builder: probe ${name}` }, () =>
      runProbes(probes, [name], postToSink),
    );
  }
  logseq.App.registerCommandPalette({ key: "qb-probe-all", label: "Query Builder: probe ALL (except seed)" }, () =>
    runProbes(probes, Object.keys(probes).filter((n) => n !== "seed"), postToSink),
  );
}
