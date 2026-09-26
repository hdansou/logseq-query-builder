import "@logseq/libs";
import { postToSink, runProbes, type ProbeFn } from "./harness";
import { seed } from "./seed";
import { inputsProbe, runForms } from "./forms";
import { insertProbe, latencyProbe, panelProbe, themeProbe } from "./more";

/** Registry filled in by FEAT-1..4. Each probe returns what it observed. */
export const probes: Record<string, ProbeFn> = {
  seed,
  inputs: inputsProbe,
  forms: runForms,
  insert: insertProbe,
  panel: panelProbe,
  theme: themeProbe,
  latency: latencyProbe,
};

/**
 * Dev-only palette commands. One command per probe so a single probe can be re-run,
 * plus "run all", which skips the ones with side effects (`seed`, `insert`, `panel`).
 */
export function registerProbeCommands() {
  for (const name of Object.keys(probes)) {
    logseq.App.registerCommandPalette({ key: `qb-probe-${name}`, label: `Query Builder: probe ${name}` }, () =>
      runProbes(probes, [name], postToSink),
    );
  }
  logseq.App.registerCommandPalette({ key: "qb-probe-all", label: "Query Builder: probe ALL (except seed)" }, () =>
    runProbes(probes, Object.keys(probes).filter((n) => !["seed", "insert", "panel"].includes(n)), postToSink),
  );
}
