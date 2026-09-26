import type { PropertyRef, PropertyType, TagRef } from "./model";

/**
 * The graph's vocabulary, fetched live and cached for the session. Every method is a datalog
 * query through an injected `dq` (datascriptQuery in the plugin, a fake in tests). Nothing here
 * guesses an ident: everything is read from the graph.
 */
export type Dq = (query: string, ...inputs: unknown[]) => Promise<any[]>;

export interface TagInfo extends TagRef { uuid: string; count: number }
export interface PropertyInfo extends PropertyRef { uuid: string; owners: string[] }

const BUILDER_TYPES: ReadonlySet<string> = new Set(["default", "number", "url", "node", "asset", "date", "datetime", "checkbox"]);

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

  /**
   * User-visible properties (the host's own hidden rule: deleted, hidden, or built-in-and-not-public
   * are dropped) with their owner tags. With `selected` tag idents, those tags' properties come first.
   */
  async properties(selected: string[] = []): Promise<PropertyInfo[]> {
    const [rows, owners] = await Promise.all([
      this.cached(`[:find ?i ?title ?u ?type ?card :where [?p :block/tags :logseq.class/Property] [?p :db/ident ?i] [?p :block/title ?title] [?p :block/uuid ?u] [?p :logseq.property/type ?type] [?p :db/cardinality ?card] (not [?p :logseq.property/deleted-at _]) (not [?p :logseq.property/hide? true]) (or (not [?p :logseq.property/built-in? true]) [?p :logseq.property/public? true])]`),
      this.cached(`[:find ?pi ?ci :where [?c :logseq.property.class/properties ?p] [?p :db/ident ?pi] [?c :db/ident ?ci]]`),
    ]);
    const ownersOf = new Map<string, string[]>();
    for (const [pi, ci] of owners) ownersOf.set(String(pi), [...(ownersOf.get(String(pi)) ?? []), String(ci)]);
    const sel = new Set(selected);
    return rows
      .filter((r: any[]) => BUILDER_TYPES.has(String(r[3])))
      .map((r: any[]): PropertyInfo => ({
        ident: String(r[0]), title: String(r[1]), uuid: String(r[2]), type: String(r[3]) as PropertyType,
        cardinality: String(r[4]).endsWith("many") ? "many" : "one", owners: ownersOf.get(String(r[0])) ?? [],
      }))
      .sort((a, b) => {
        const ao = a.owners.some((o) => sel.has(o)) ? 0 : 1, bo = b.owners.some((o) => sel.has(o)) ? 0 : 1;
        return ao - bo || a.title.localeCompare(b.title);
      });
  }
}
