/**
 * P0 probe harness. A probe is a named async function that returns whatever it observed;
 * the harness times it, catches failures, and hands a uniform result to a reporter.
 * Nothing here touches the Logseq API, so it is unit-testable.
 */
export type ProbeFn = () => Promise<unknown>;

export interface ProbeResult {
  probe: string;
  ok: boolean;
  ms: number;
  detail: unknown;
  at: string;
}

export type Reporter = (result: ProbeResult) => Promise<void> | void;

export async function runProbe(name: string, fn: ProbeFn, now: () => number = Date.now): Promise<ProbeResult> {
  const started = now();
  try {
    const detail = await fn();
    return { probe: name, ok: true, ms: now() - started, detail, at: new Date().toISOString() };
  } catch (e) {
    const detail = e instanceof Error ? { error: e.message, stack: e.stack } : { error: String(e) };
    return { probe: name, ok: false, ms: now() - started, detail, at: new Date().toISOString() };
  }
}

export async function runProbes(
  registry: Record<string, ProbeFn>,
  names: string[],
  report: Reporter,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const name of names) {
    const fn = registry[name];
    if (!fn) throw new Error(`unknown probe: ${name}`);
    const result = await runProbe(name, fn);
    await report(result);
    results.push(result);
  }
  return results;
}

/** Reporter that POSTs to the vite dev server's sink (see vite.config.ts). */
export const postToSink: Reporter = async (result) => {
  console.info("[qb probe]", result.probe, result.ok ? "ok" : "FAIL", result.ms + "ms", result.detail);
  await fetch("/__probe", { method: "POST", body: JSON.stringify(result) });
};
