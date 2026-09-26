import type { GuardResult } from "./guard";
import type { Query } from "./model";
import type { Target } from "./ui/store";

/**
 * Insert = write the built query into the graph as a named #Query node. One plan, two shapes:
 * from the shortcut a new sibling is created after the editing block; from the slash command the
 * block itself is renamed. Then the same three writes: the Query tag, the query text, and the
 * builder state (JSON in a plugin-namespaced property) so the block can be reopened as chips.
 * The API calls were verified live (docs/probes.md, FEAT-2).
 */
export const STATE_KEY = "state";              // resolves to plugin.property.<id>/state on the host
export const QUERY_TAG = "logseq.class/Query";
export const QUERY_KEY = "logseq.property/query";

export type Step =
  | { op: "insert-sibling"; after: string; content: string }
  | { op: "rename"; uuid: string; content: string }
  | { op: "tag"; tag: string }
  | { op: "property"; key: string; value: string };

export function canInsert(s: { guard: GuardResult; name: string; target: Target | null }): GuardResult {
  if (!s.guard.ok) return s.guard;
  if (!s.name.trim()) return { ok: false, reason: "Give the query a name." };
  if (!s.target) return { ok: false, reason: "No target block: open the builder from a block or while editing one." };
  return { ok: true };
}

export function planInsert(target: Target, name: string, queryText: string, stateJson: string): Step[] {
  const first: Step = target.mode === "shortcut"
    ? { op: "insert-sibling", after: target.uuid, content: name }
    : { op: "rename", uuid: target.uuid, content: name };
  return [
    first,
    { op: "tag", tag: QUERY_TAG },
    { op: "property", key: QUERY_KEY, value: queryText },
    { op: "property", key: STATE_KEY, value: stateJson },
  ];
}

/** What the executor needs from the host; typed narrowly so tests can fake it. */
export interface InsertApi {
  insertBlock(after: string, content: string, opts: { sibling: boolean }): Promise<{ uuid: string } | null>;
  updateBlock(uuid: string, content: string): Promise<void>;
  addBlockTag(uuid: string, tag: string): Promise<void>;
  upsertBlockProperty(uuid: string, key: string, value: string): Promise<void>;
}

/** Runs a plan; returns the uuid of the query block. */
export async function runInsert(api: InsertApi, plan: Step[]): Promise<string> {
  let uuid: string | null = null;
  for (const step of plan) {
    switch (step.op) {
      case "insert-sibling": { const b = await api.insertBlock(step.after, step.content, { sibling: true }); if (!b) throw new Error("insertBlock returned nothing"); uuid = b.uuid; break; }
      case "rename": await api.updateBlock(step.uuid, step.content); uuid = step.uuid; break;
      case "tag": await api.addBlockTag(uuid!, step.tag); break;
      case "property": await api.upsertBlockProperty(uuid!, step.key, step.value); break;
    }
  }
  return uuid!;
}

const VERSION = 1;
export const serializeState = (q: Query) => JSON.stringify({ v: VERSION, query: q });

export function deserializeState(text: string): Query | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.v !== VERSION) return null;
    const q = parsed.query;
    if (!q || typeof q.name !== "string" || !Array.isArray(q.tags) || typeof q.inherit !== "boolean" || !Array.isArray(q.rows) || !("content" in q)) return null;
    return q as Query;
  } catch {
    return null;
  }
}
