import type { TagRef } from "./model";

/**
 * The graph's vocabulary, fetched live and cached for the session. Every method is a datalog
 * query through an injected `dq` (datascriptQuery in the plugin, a fake in tests). Nothing here
 * guesses an ident: everything is read from the graph.
 */
export type Dq = (query: string, ...inputs: unknown[]) => Promise<any[]>;

export interface TagInfo extends TagRef { uuid: string; count: number }

/** Built-in classes nobody filters by (SPEC § Grounding 3). */
export const STRUCTURAL_TAGS: ReadonlySet<string> = new Set([
  ":logseq.class/Root", ":logseq.class/Tag", ":logseq.class/Property", ":logseq.class/Page", ":logseq.class/Asset",
  ":logseq.class/Whiteboard", ":logseq.class/Pdf-annotation", ":logseq.class/Code-block", ":logseq.class/Quote-block",
  ":logseq.class/Math-block", ":logseq.class/Comments", ":logseq.class/Comment",
]);

export class Graph {
  private cache = new Map<string, Promise<any[]>>();
  constructor(private dq: Dq) {}

  invalidate() { this.cache.clear(); }

  private cached(query: string, ...inputs: unknown[]): Promise<any[]> {
    const key = query + JSON.stringify(inputs);
    let hit = this.cache.get(key);
    if (!hit) {
      hit = this.dq(query, ...inputs);
      this.cache.set(key, hit);
    }
    return hit;
  }

  /** All user-facing tags, most-used first; unused tags last with count 0. */
  async tags(): Promise<TagInfo[]> {
    const [all, counts] = await Promise.all([
      this.cached(`[:find ?i ?title ?u :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?t :block/title ?title] [?t :block/uuid ?u] (not [?t :logseq.property/deleted-at _])]`),
      this.cached(`[:find ?i (count ?b) :where [?t :block/tags :logseq.class/Tag] [?t :db/ident ?i] [?b :block/tags ?t]]`),
    ]);
    const count = new Map(counts.map((r: any[]) => [String(r[0]), Number(r[1])]));
    return all
      .map((r: any[]) => ({ ident: String(r[0]), title: String(r[1]), uuid: String(r[2]), count: count.get(String(r[0])) ?? 0 }))
      .filter((t) => !STRUCTURAL_TAGS.has(t.ident))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  }
}
